import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { promises as fsp } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../media/storage.service';
import { runFfmpeg, probeMediaInfo, parseMediaProbe } from '../media/adapters/ffmpeg.util';
import { MediaPipelineError } from '../media/media.errors';

const VARIATIONS = 4;

/**
 * Thumbnail Generator: extracts candidate frames spread across the rendered
 * clip (skipping the first/last 10%). Variations persist as SHORTS_THUMBNAIL
 * assets + ShortsThumbnail rows; the first becomes primary until the user
 * picks another. Skips when thumbnails already exist.
 */
@Injectable()
export class ThumbnailGenerationService {
  private readonly logger = new Logger(ThumbnailGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async ensureThumbnails(shortClipId: string, renderedPath: string, onLog?: (msg: string) => void) {
    const clip = await this.prisma.shortClip.findUnique({
      where: { id: shortClipId },
      include: {
        thumbnails: true,
        timeline: { select: { durationMs: true } },
      },
    });
    if (!clip?.timeline) throw new NotFoundException('Clip not found');
    if (clip.thumbnails.length > 0) {
      onLog?.(`Thumbnails already exist (${clip.thumbnails.length}) -- reusing`);
      return { skipped: true, thumbnails: clip.thumbnails.length };
    }

    const durationMs = clip.timeline.durationMs;
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cf-thumb-'));

    onLog?.(`Generating ${VARIATIONS} thumbnail variations...`);

    // Validate the render file has a video stream before attempting extraction.
    const probe = await probeMediaInfo(renderedPath);
    this.logger.debug(`Thumbnail probe for ${shortClipId}: ${probe.slice(0, 400).replace(/\n/g, ' ')}`);
    if (!probe.includes('Video:')) {
      throw new InternalServerErrorException(
        'Render file is not a valid video -- no video stream detected. Re-render the clip and try again.',
      );
    }

    // Use the actual rendered video duration from the probe so seek times stay
    // within bounds even when the user made cuts that shorten the timeline.
    // Fall back to the stored durationMs when the probe can't determine it.
    const probedDurationMs = parseMediaProbe(probe).durationMs ?? durationMs;
    const effectiveDurationMs = probedDurationMs > 0 ? probedDurationMs : durationMs;

    let created = 0;
    try {
      for (let i = 0; i < VARIATIONS; i++) {
        // Frames at 15% / 38% / 61% / 84% of the clip -- avoids intro/outro frames
        const atMs = Math.round(effectiveDurationMs * (0.15 + (0.7 * i) / Math.max(1, VARIATIONS - 1)));
        const framePath = path.join(tmpDir, `thumb-${i}.jpg`);

        try {
          // Plain frame extraction without text overlay.
          // Alpine ffmpeg apk omits libfreetype2, so 'drawtext' is unavailable.
          await runFfmpeg(['-ss', String(atMs / 1000), '-i', renderedPath, '-frames:v', '1', '-q:v', '3', framePath], 120_000);
        } catch (ffmpegErr) {
          const reason =
            ffmpegErr instanceof MediaPipelineError
              ? ffmpegErr.reason
              : ffmpegErr instanceof Error
                ? ffmpegErr.message
                : String(ffmpegErr);
          const stderr =
            ffmpegErr instanceof MediaPipelineError ? String(ffmpegErr.details?.['stderrTail'] ?? '') : '';
          this.logger.warn(
            `Thumbnail ${i + 1}/${VARIATIONS} ffmpeg failed -- skipping: ${reason}${stderr ? ` | stderr: ${stderr.slice(0, 300)}` : ''}`,
          );
          continue;
        }

        // Guard: ffmpeg may exit 0 without writing the frame (e.g. empty video
        // or seek precisely at the last keyframe boundary). Skip quietly.
        try {
          const stat = await fsp.stat(framePath);
          if (stat.size === 0) {
            this.logger.warn(`Thumbnail ${i + 1}/${VARIATIONS} ffmpeg wrote empty frame -- skipping`);
            continue;
          }
        } catch {
          this.logger.warn(`Thumbnail ${i + 1}/${VARIATIONS} ffmpeg exited 0 but wrote no output file -- skipping`);
          continue;
        }

        try {
          const buffer = await fsp.readFile(framePath);
          const asset = await this.prisma.asset.create({
            data: {
              projectId: clip.projectId,
              kind: 'SHORTS_THUMBNAIL',
              label: `Thumbnail ${i + 1}: ${clip.id}`,
              status: 'READY',
            },
          });
          const key = `thumbnails/shorts/${clip.projectId}/${asset.id}.jpg`;
          await this.storage.put(key, buffer);
          const version = await this.prisma.assetVersion.create({
            data: {
              assetId: asset.id,
              version: 1,
              r2Key: key,
              provider: 'ffmpeg',
              sizeBytes: BigInt(buffer.length),
              params: { atMs, variation: i } as never,
            },
          });
          await this.prisma.asset.update({ where: { id: asset.id }, data: { currentVersionId: version.id } });
          await this.prisma.shortsThumbnail.create({
            data: { shortClipId, assetId: asset.id, isPrimary: i === 0 },
          });
          created++;
        } catch (err) {
          this.logger.warn(
            `Thumbnail ${i + 1}/${VARIATIONS} storage/db error -- skipping: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
    if (created === 0) {
      throw new InternalServerErrorException(
        'Thumbnail generation failed -- ffmpeg could not extract frames from the render file. Re-render the clip and try again.',
      );
    }
    onLog?.(`Thumbnails ready -- ${created} variations`);
    return { skipped: false, thumbnails: created };
  }

  async listForClip(shortClipId: string) {
    return this.prisma.shortsThumbnail.findMany({
      where: { shortClipId },
      orderBy: { createdAt: 'asc' },
      include: { asset: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { id: true } } } } },
    });
  }

  async setPrimary(thumbnailId: string, userId: string) {
    const thumb = await this.prisma.shortsThumbnail.findFirst({
      where: { id: thumbnailId, shortClip: { project: { userId } } },
    });
    if (!thumb) throw new NotFoundException('Thumbnail not found');
    await this.prisma.$transaction([
      this.prisma.shortsThumbnail.updateMany({ where: { shortClipId: thumb.shortClipId }, data: { isPrimary: false } }),
      this.prisma.shortsThumbnail.update({ where: { id: thumbnailId }, data: { isPrimary: true } }),
    ]);
    return { success: true };
  }

  async regenerate(shortClipId: string, userId: string) {
    const clip = await this.prisma.shortClip.findFirst({
      where: { id: shortClipId, project: { userId } },
      include: {
        renderAsset: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
      },
    });
    if (!clip) throw new NotFoundException('Clip not found');
    const renderKey = clip.renderAsset?.versions[0]?.r2Key;
    if (!renderKey) throw new BadRequestException('Clip must be rendered before generating thumbnails');

    const available = await this.storage.ensure(renderKey);
    if (!available) throw new BadRequestException('Render file unavailable -- re-render the clip first');

    // Clear existing thumbnails so ensureThumbnails runs fresh
    const existing = await this.prisma.shortsThumbnail.findMany({
      where: { shortClipId },
      select: { assetId: true, id: true },
    });
    if (existing.length > 0) {
      await this.prisma.shortsThumbnail.deleteMany({ where: { shortClipId } });
      await this.prisma.asset.deleteMany({ where: { id: { in: existing.map((t) => t.assetId) } } });
    }

    return this.ensureThumbnails(shortClipId, this.storage.resolve(renderKey));
  }

  /** Upload a user-provided image as a custom thumbnail (JPEG/PNG/WEBP, max 10 MB). */
  async uploadCustom(shortClipId: string, userId: string, buffer: Buffer, mimeType: string) {
    if (buffer.length > 10 * 1024 * 1024) throw new BadRequestException('Thumbnail must be <= 10 MB');
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(mimeType)) throw new BadRequestException('Thumbnail must be JPEG, PNG, or WebP');

    const clip = await this.prisma.shortClip.findFirst({
      where: { id: shortClipId, project: { userId } },
      select: { id: true, projectId: true },
    });
    if (!clip) throw new NotFoundException('Clip not found');

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const asset = await this.prisma.asset.create({
      data: { projectId: clip.projectId, kind: 'SHORTS_THUMBNAIL', label: `Custom thumbnail: ${clip.id}`, status: 'READY' },
    });
    const key = `thumbnails/shorts/${clip.projectId}/${asset.id}.${ext}`;
    await this.storage.put(key, buffer);
    const version = await this.prisma.assetVersion.create({
      data: { assetId: asset.id, version: 1, r2Key: key, provider: 'user-upload', sizeBytes: BigInt(buffer.length) },
    });
    await this.prisma.asset.update({ where: { id: asset.id }, data: { currentVersionId: version.id } });

    await this.prisma.$transaction([
      this.prisma.shortsThumbnail.updateMany({ where: { shortClipId }, data: { isPrimary: false } }),
      this.prisma.shortsThumbnail.create({ data: { shortClipId, assetId: asset.id, isPrimary: true } }),
    ]);

    return { id: asset.id, key, versionId: version.id };
  }

  /** Resolved local path + R2 key for the primary thumbnail of a clip, or null. */
  async primaryThumbnailPath(shortClipId: string): Promise<{ localPath: string; r2Key: string } | null> {
    const thumb = await this.prisma.shortsThumbnail.findFirst({
      where: { shortClipId, isPrimary: true },
      include: { asset: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
    });
    const r2Key = thumb?.asset.versions[0]?.r2Key;
    if (!r2Key) return null;
    const available = await this.storage.ensure(r2Key);
    if (!available) return null;
    return { localPath: this.storage.resolve(r2Key), r2Key };
  }
}
