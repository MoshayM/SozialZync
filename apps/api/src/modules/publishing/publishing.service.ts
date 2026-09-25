import { Injectable, ForbiddenException, BadRequestException, NotFoundException, Logger, HttpException } from '@nestjs/common';
import { createReadStream } from 'fs';
import type { youtube_v3 } from 'googleapis';
import type { Prisma, VideoStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { StorageService } from '../media/storage.service';

// @reason: EditProject not in generated Prisma client — same dynamic accessor pattern as editor.service.ts
const ep = (p: PrismaService) => (p as unknown as Record<string, unknown>)['editProject'] as {
  findUnique: (args: unknown) => Promise<unknown | null>;
};

/**
 * YouTube A/S (Altered or Synthetic) disclosure — googleapis@144 typings
 * predate the field, but videos.insert/update accept it
 * (developers.google.com/youtube/v3/docs/videos → status.containsSyntheticMedia).
 */
type VideoStatusWithDisclosure = youtube_v3.Schema$VideoStatus & { containsSyntheticMedia?: boolean };

/**
 * Human-readable disclosure appended to the description when the platform
 * label is set — keeps the disclosure visible even where the label isn't
 * rendered (embeds, third-party clients). Policy:
 * support.google.com/youtube/answer/14328491
 */
const AI_DISCLOSURE_LABEL =
  'Altered or synthetic content: this video includes AI-generated media (voice, visuals, or music).';

export interface PublishOptions {
  videoId: string;
  channelId?: string;
  title: string;
  description: string;
  tags: string[];
  categoryId?: string;
  scheduledAt?: Date;
  /** Absolute path to a local video file. Use this OR r2Key, not both. */
  videoFilePath?: string;
  /** R2 object key for the video. StorageService.ensure() will download it locally before upload. */
  r2Key?: string;
  /**
   * BCP-47 audio language of the uploaded media — always the SOURCE video's
   * original language, never a translation. Left unset when unknown so
   * YouTube doesn't get told a wrong language; viewers only hear another
   * language if they switch audio tracks themselves.
   */
  defaultAudioLanguage?: string;
  /**
   * YouTube AI-disclosure policy (support.google.com/youtube/answer/14328491):
   * set when the upload contains realistic AI-generated or meaningfully
   * altered media (TTS narration, generated visuals/music). Sets the
   * platform "Altered or synthetic content" label AND appends a clear
   * disclosure line to the description.
   */
  containsSyntheticMedia?: boolean;
  /** Absolute local path to a JPEG/PNG thumbnail to upload via thumbnails.set() after video insert. */
  thumbnailFilePath?: string;
}

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly storage: StorageService,
  ) {}

  async publish(opts: PublishOptions, approvalId: string): Promise<string> {
    this.logger.log(`[Publish] Start — videoId=${opts.videoId} channelId=${opts.channelId ?? 'none'}`);

    const approval = await this.prisma.approval.findFirst({
      where: { id: approvalId, status: 'APPROVED' },
    });
    if (!approval) {
      this.logger.warn(`[Publish] No approved approval — approvalId=${approvalId}`);
      throw new ForbiddenException('Human approval required before publishing. Approval not found or not approved.');
    }
    this.logger.log(`[Publish] Approval verified — approvalId=${approvalId}`);

    let resolvedPath = opts.videoFilePath;
    if (!resolvedPath && opts.r2Key) {
      const available = await this.storage.ensure(opts.r2Key);
      if (!available) {
        throw new BadRequestException(`Video asset not found in storage (r2Key: ${opts.r2Key})`);
      }
      resolvedPath = this.storage.resolve(opts.r2Key);
    }

    if (!resolvedPath) {
      throw new BadRequestException(
        'Provide videoFilePath or r2Key to publish. ' +
        'Run the render pipeline to produce an r2Key from the content pipeline.',
      );
    }

    if (!opts.channelId) {
      throw new BadRequestException('A connected channel is required to publish to YouTube.');
    }

    this.logger.log(`[Publish] Token check — channelId=${opts.channelId}`);
    const { youtube } = await this.channels.buildAuthedYouTube(opts.channelId);

    const publishAt = opts.scheduledAt?.toISOString();
    const status: VideoStatusWithDisclosure = publishAt
      ? { privacyStatus: 'private', publishAt }
      : { privacyStatus: 'public' };
    if (opts.containsSyntheticMedia) status.containsSyntheticMedia = true;

    const description =
      opts.containsSyntheticMedia && !/altered or synthetic content/i.test(opts.description)
        ? `${opts.description}\n\n${AI_DISCLOSURE_LABEL}`.trim()
        : opts.description;

    this.logger.log(`[Publish] Upload request — channelId=${opts.channelId} title="${opts.title}"`);

    let res;
    try {
      res = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: opts.title,
            description,
            tags: opts.tags,
            categoryId: opts.categoryId ?? '22',
            ...(opts.defaultAudioLanguage ? { defaultAudioLanguage: opts.defaultAudioLanguage } : {}),
          },
          status,
        },
        media: { mimeType: 'video/mp4', body: createReadStream(resolvedPath) },
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`[Publish] Upload error — channelId=${opts.channelId}`);
      // Mark video + project as FAILED so the UI reflects the error state
      const failedVideo = await this.prisma.video.update({
        where: { id: opts.videoId },
        data: { status: 'FAILED' as VideoStatus },
        select: { projectId: true },
      }).catch(() => null);
      if (failedVideo?.projectId) {
        await this.prisma.project.update({
          where: { id: failedVideo.projectId },
          data: { publishingStatus: 'FAILED' },
        }).catch(() => null);
      }
      await this.channels.handleGoogleError(opts.channelId, err);
    }

    const youtubeVideoId = res!.data.id!;
    this.logger.log(`[Publish] Upload complete — youtubeVideoId=${youtubeVideoId}`);

    // Upload custom thumbnail if provided (non-fatal — video is already on YouTube)
    if (opts.thumbnailFilePath) {
      try {
        await youtube.thumbnails.set({
          videoId: youtubeVideoId,
          media: { mimeType: 'image/jpeg', body: createReadStream(opts.thumbnailFilePath) },
        });
        this.logger.log(`[Publish] Thumbnail uploaded — youtubeVideoId=${youtubeVideoId}`);
      } catch (thumbErr) {
        this.logger.warn(`[Publish] Thumbnail upload failed (non-fatal) — ${thumbErr instanceof Error ? thumbErr.message : thumbErr}`);
      }
    }

    const video = await this.prisma.video.update({
      where: { id: opts.videoId },
      data: {
        youtubeVideoId,
        description,
        status: opts.scheduledAt ? 'SCHEDULED' : 'PUBLISHED',
        publishedAt: opts.scheduledAt ? null : new Date(),
        scheduledAt: opts.scheduledAt,
      },
      select: { projectId: true },
    });

    // Propagate publishing state back to the project
    if (video.projectId) {
      await this.prisma.project.update({
        where: { id: video.projectId },
        data: { publishingStatus: opts.scheduledAt ? 'SCHEDULED' : 'PUBLISHED' },
      });
    }

    return youtubeVideoId;
  }

  /**
   * Scheduler tracking list: videos that have entered the publish pipeline
   * (SCHEDULED / PUBLISHED / FAILED), scoped to the requesting user via
   * channel ownership. A video's effective date is publishedAt when set,
   * otherwise scheduledAt — the from/to range filters on that.
   */
  /** Unified row shape returned by listTracked (videos + published shorts). */
  private toTrackingItem<T extends {
    id: string; title: string; status: VideoStatus; youtubeVideoId: string | null;
    thumbnailUrl: string | null; scheduledAt: Date | null; publishedAt: Date | null;
    viewCount: number; likeCount: number; commentCount: number; createdAt: Date;
    channel: { id: string; title: string }; project: { id: string; title: string };
  }>(v: T, source: 'VIDEO' | 'SHORT') {
    return { ...v, source };
  }

  async listTracked(
    userId: string,
    opts: {
      channelId?: string;
      status?: VideoStatus[];
      from?: Date;
      to?: Date;
      q?: string;
      take?: number;
      skip?: number;
    },
  ) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
    const skip = Math.max(opts.skip ?? 0, 0);

    const dateRange: Prisma.DateTimeNullableFilter | undefined =
      opts.from || opts.to
        ? { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) }
        : undefined;

    const statusFilter: VideoStatus[] = opts.status?.length
      ? opts.status
      : ['SCHEDULED', 'PUBLISHED', 'FAILED'];
    const includePublished = statusFilter.includes('PUBLISHED' as VideoStatus);

    const videoWhere: Prisma.VideoWhereInput = {
      channel: { userId },
      status: { in: statusFilter },
      ...(opts.channelId ? { channelId: opts.channelId } : {}),
      ...(opts.q ? { title: { contains: opts.q, mode: 'insensitive' } } : {}),
      ...(dateRange
        ? { OR: [{ publishedAt: dateRange }, { publishedAt: null, scheduledAt: dateRange }] }
        : {}),
    };

    const [allVideos, allShorts] = await Promise.all([
      this.prisma.video.findMany({
        where: videoWhere,
        orderBy: [
          { publishedAt: { sort: 'desc', nulls: 'first' } },
          { scheduledAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: 500,
        select: {
          id: true, title: true, status: true, youtubeVideoId: true, thumbnailUrl: true,
          scheduledAt: true, publishedAt: true, viewCount: true, likeCount: true,
          commentCount: true, createdAt: true,
          channel: { select: { id: true, title: true } },
          project: { select: { id: true, title: true } },
        },
      }),
      includePublished
        ? this.prisma.shortClip.findMany({
            where: {
              project: {
                channel: { userId },
                ...(opts.channelId ? { channelId: opts.channelId } : {}),
              },
              status: 'PUBLISHED',
              ...(opts.q
                ? {
                    OR: [
                      { topicSegment: { title: { contains: opts.q, mode: 'insensitive' } } },
                      { chapter: { title: { contains: opts.q, mode: 'insensitive' } } },
                      { project: { title: { contains: opts.q, mode: 'insensitive' } } },
                    ],
                  }
                : {}),
              ...(dateRange ? { exports: { some: { publishedAt: dateRange } } } : {}),
            },
            select: {
              id: true, status: true, createdAt: true, updatedAt: true,
              project: { select: { id: true, title: true, channel: { select: { id: true, title: true } } } },
              topicSegment: { select: { title: true } },
              chapter: { select: { title: true } },
              exports: { orderBy: { createdAt: 'desc' }, take: 1, select: { publishedAt: true, publishTargetId: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const videoItems = allVideos.map((v) => this.toTrackingItem(v, 'VIDEO'));

    const shortItems = allShorts.map((clip) =>
      this.toTrackingItem(
        {
          id: clip.id,
          title: clip.topicSegment?.title ?? clip.chapter?.title ?? `${clip.project.title} (Short)`,
          status: 'PUBLISHED' as VideoStatus,
          youtubeVideoId: clip.exports[0]?.publishTargetId ?? null,
          thumbnailUrl: null,
          scheduledAt: null,
          publishedAt: clip.exports[0]?.publishedAt ?? clip.updatedAt,
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          createdAt: clip.createdAt,
          channel: clip.project.channel ?? { id: '', title: 'Unknown' },
          project: { id: clip.project.id, title: clip.project.title },
        },
        'SHORT',
      ),
    );

    const combined = [...videoItems, ...shortItems].sort((a, b) => {
      const da = a.publishedAt ?? a.scheduledAt;
      const db = b.publishedAt ?? b.scheduledAt;
      return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
    });

    return { data: combined.slice(skip, skip + take), total: combined.length, take, skip };
  }

  /** Headline counts for the scheduler page, scoped like listTracked. */
  async trackingSummary(userId: string, channelId?: string) {
    const base: Prisma.VideoWhereInput = {
      channel: { userId },
      ...(channelId ? { channelId } : {}),
    };
    const shortsBase: Prisma.ShortClipWhereInput = {
      project: { channel: { userId }, ...(channelId ? { channelId } : {}) },
      status: 'PUBLISHED',
    };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [scheduled, upcoming7d, publishedVideos, publishedVideosThisMonth, failed, publishedShorts, publishedShortsThisMonth] =
      await this.prisma.$transaction([
        this.prisma.video.count({ where: { ...base, status: 'SCHEDULED' } }),
        this.prisma.video.count({
          where: {
            ...base,
            status: 'SCHEDULED',
            scheduledAt: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.video.count({ where: { ...base, status: 'PUBLISHED' } }),
        this.prisma.video.count({
          where: { ...base, status: 'PUBLISHED', publishedAt: { gte: monthStart } },
        }),
        this.prisma.video.count({ where: { ...base, status: 'FAILED' } }),
        this.prisma.shortClip.count({ where: shortsBase }),
        this.prisma.shortClip.count({
          where: { ...shortsBase, exports: { some: { publishedAt: { gte: monthStart } } } },
        }),
      ]);

    return {
      scheduled,
      upcoming7d,
      published: publishedVideos + publishedShorts,
      publishedThisMonth: publishedVideosThisMonth + publishedShortsThisMonth,
      failed,
    };
  }

  async getVideoStats(channelId: string, youtubeVideoId: string) {
    const { youtube } = await this.channels.buildAuthedYouTube(channelId);
    const res = await youtube.videos.list({
      part: ['statistics'],
      id: [youtubeVideoId],
    });
    return res.data.items?.[0]?.statistics;
  }

  /**
   * Returns everything the frontend needs to decide whether a project can be
   * published from its render output: the latest READY render, the latest
   * APPROVED approval, and the project's Video record (if one exists).
   * Returns null for any part that is not yet available.
   */
  async getProjectPublishReady(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { channel: { select: { id: true, title: true, active: true } } },
    });
    if (!project) throw new ForbiddenException('Project not found or access denied');

    const [render, approval, video] = await Promise.all([
      this.prisma.render.findFirst({
        where: { projectId, status: 'READY' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, r2Key: true, preset: true, durationMs: true, sizeBytes: true, checksum: true },
      }),
      this.prisma.approval.findFirst({
        where: { projectId, status: 'APPROVED' },
        orderBy: { reviewedAt: 'desc' },
        select: { id: true, reviewedAt: true, expiresAt: true },
      }),
      this.prisma.video.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, description: true, tags: true, status: true, youtubeVideoId: true },
      }),
    ]);

    const approvalValid = approval && approval.expiresAt > new Date();

    return {
      project: { id: project.id, title: project.title, description: project.description, channel: project.channel },
      render: render ?? null,
      approval: approvalValid ? approval : null,
      video: video ?? null,
      canPublish: !!(render && approvalValid),
    };
  }

  /**
   * Queue an editor-rendered video for human review and publish.
   * Creates a Video(PENDING_APPROVAL) + synthetic AgentJob + Approval(PENDING).
   * The Approval shows in the Publish Hub pending section; "Approve & Publish" triggers the upload.
   */
  async queueEditorPublish(
    opts: {
      editId: string;
      channelId: string;
      title: string;
      description: string;
      tags: string[];
      scheduledAt?: Date;
    },
    userId: string,
  ): Promise<{ approvalId: string; videoId: string }> {
    // Verify edit project ownership via its parent project
    const editProject = (await ep(this.prisma).findUnique({
      where: { id: opts.editId },
      include: { project: { select: { id: true, userId: true } } },
    })) as {
      id: string;
      renderAssetId: string | null;
      renderStatus: string;
      project: { id: string; userId: string };
    } | null;

    if (!editProject || editProject.project.userId !== userId) {
      throw new ForbiddenException('Edit project not found or access denied');
    }
    if (editProject.renderStatus !== 'READY') {
      throw new BadRequestException('Render not complete. Please render the video before sending to publish.');
    }

    // Verify the channel belongs to this user
    const channel = await this.prisma.channel.findFirst({ where: { id: opts.channelId, userId } });
    if (!channel) throw new ForbiddenException('Channel not found or not yours');

    // Get r2Key from the rendered asset
    const r2Key = editProject.renderAssetId
      ? await this.prisma.asset
          .findUnique({
            where: { id: editProject.renderAssetId },
            include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
          })
          .then((a) => a?.versions[0]?.r2Key ?? null)
      : null;
    if (!r2Key) throw new BadRequestException('No completed render found. Please render the video first.');

    const projectId = editProject.project.id;

    // Create pending Video record
    const video = await this.prisma.video.create({
      data: {
        projectId,
        channelId: opts.channelId,
        title: opts.title,
        description: opts.description,
        tags: opts.tags,
        scheduledAt: opts.scheduledAt ?? null,
        status: 'PENDING_APPROVAL',
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      },
    });

    // @reason: EDITOR_PUBLISH not in JobType enum; EDIT_RENDER is the closest existing type.
    //          result.subtype='EDITOR_PUBLISH' differentiates these in the Publish Hub frontend.
    const job = await this.prisma.agentJob.create({
      data: {
        projectId,
        type: 'EDIT_RENDER',
        status: 'COMPLETED',
        payload: {},
        result: {
          subtype: 'EDITOR_PUBLISH',
          editId: opts.editId,
          videoId: video.id,
          r2Key,
          channelId: opts.channelId,
          channelTitle: channel.title,
          title: opts.title,
          description: opts.description,
          tags: opts.tags,
          scheduledAt: opts.scheduledAt?.toISOString() ?? null,
        },
        completedAt: new Date(),
      },
    });

    const approval = await this.prisma.approval.create({
      data: {
        projectId,
        jobId: job.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    this.logger.log(`[QueueEditor] Queued editor video — editId=${opts.editId} videoId=${video.id} approvalId=${approval.id}`);

    return { approvalId: approval.id, videoId: video.id };
  }

  /** Cancel a queued editor publish: rejects the approval and resets the video to DRAFT. */
  async cancelEditorPublish(approvalId: string, userId: string): Promise<void> {
    const approval = await this.prisma.approval.findFirst({
      where: { id: approvalId, status: 'PENDING', project: { userId } },
      include: { job: { select: { result: true } } },
    });
    if (!approval) throw new NotFoundException('Pending approval not found');

    const result = approval.job?.result as { videoId?: string; subtype?: string } | null;
    if (result?.subtype !== 'EDITOR_PUBLISH') throw new BadRequestException('Not an editor publish item');

    await this.prisma.approval.update({
      where: { id: approvalId },
      data: { status: 'REJECTED', reviewedBy: userId, reviewedAt: new Date(), notes: 'Cancelled by user' },
    });

    if (result.videoId) {
      await this.prisma.video
        .updateMany({
          where: { id: result.videoId, status: 'PENDING_APPROVAL' },
          data: { status: 'DRAFT' },
        })
        .catch(() => null); // non-fatal
    }
  }
}
