import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScriptOutputSchema, type ScriptOutput } from '@cf/shared';
import { decodeCursor, keysetWhereDesc, clampLimit, pageResult } from '../../common/pagination/cursor';

export interface CreateProjectDto {
  channelId?: string;
  title: string;
  description?: string;
  niche?: string;
  targetLang?: string;
  /** Phase 5 §10: bill agent-job spend to this org's shared wallet; null/'' clears. */
  billingOrgId?: string | null;
  contentFormat?: string;
  contentType?: string;
  platforms?: string[];
}

/** Shorts Studio container projects must not appear in the main Projects list. */
const SHORTS_CONTAINER_TITLE = 'Shorts Studio';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A project may only bill an org the owner belongs to. Spend-time gating
   * (SPEND role + budget) still happens in orgSpend on every job — this check
   * exists so a typo'd or foreign orgId fails at set time, not at job time.
   */
  private async resolveBillingOrgId(userId: string, billingOrgId: string | null | undefined): Promise<string | null> {
    if (!billingOrgId) return null;
    const membership = await this.prisma.orgMembership.findUnique({
      where: { orgId_userId: { orgId: billingOrgId, userId } },
    });
    if (!membership) throw new ForbiddenException('You are not a member of that organisation');
    return billingOrgId;
  }

  async create(userId: string, dto: CreateProjectDto) {
    if (dto.channelId) {
      const channel = await this.prisma.channel.findFirst({
        where: { id: dto.channelId, userId },
      });
      if (!channel) throw new ForbiddenException('Channel not found or not owned');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contentType pending Prisma client regen after migration
    return (this.prisma.project as any).create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        niche: dto.niche,
        targetLang: dto.targetLang ?? 'en',
        billingOrgId: await this.resolveBillingOrgId(userId, dto.billingOrgId),
        contentFormat: dto.contentFormat,
        contentType: dto.contentType,
        platforms: dto.platforms ?? [],
        ...(dto.channelId ? { channelId: dto.channelId } : {}),
      },
    });
  }

  async list(userId: string, opts: { cursor?: string; limit?: number } = {}) {
    const take = clampLimit(opts.limit, 50, 100);
    const include = {
      channel: { select: { title: true, thumbnailUrl: true } },
      _count: { select: { jobs: true, videos: true } },
    };
    // Fetch user's own projects (paginated) and demo projects (always shown) in parallel
    const [userRows, demoRows] = await Promise.all([
      this.prisma.project.findMany({
        where: { userId, title: { not: SHORTS_CONTAINER_TITLE }, ...keysetWhereDesc('updatedAt', decodeCursor(opts.cursor)) },
        include,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- isDemo pending Prisma client regen after migration
      (this.prisma.project as any).findMany({
        where: { isDemo: true },
        include,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }) as ReturnType<typeof this.prisma.project.findMany>,
    ]);
    // Demo projects appear first (pinned), then the user's own projects paginated
    const merged = [...demoRows, ...userRows];
    return pageResult(merged.slice(0, take + 1), take, (r) => r.updatedAt);
  }

  async get(userId: string, projectId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- isDemo pending Prisma client regen after migration
    const project = await (this.prisma.project as any).findFirst({
      where: { AND: [{ id: projectId }, { OR: [{ userId }, { isDemo: true }] }] },
      include: {
        channel: { select: { id: true, title: true, thumbnailUrl: true, youtubeChannelId: true, active: true } },
        jobs: { orderBy: { createdAt: 'desc' }, take: 10 },
        videos: { orderBy: { createdAt: 'desc' } },
        approvals: true,
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Merge in the latest completed job per type so pipeline tiles work even
    // when those jobs have aged out of the recent-10 window above.
    const allCompleted = await this.prisma.agentJob.findMany({
      where: { projectId, status: 'COMPLETED' as import('@prisma/client').JobStatus },
      orderBy: { createdAt: 'desc' },
    });
    const seenTypes = new Set<string>();
    const latestPerType = allCompleted.filter((j) => {
      if (seenTypes.has(j.type)) return false;
      seenTypes.add(j.type);
      return true;
    });
    const seen = new Set((project.jobs as Array<{ id: string }>).map((j) => j.id));
    const merged = [...(project.jobs as unknown[]), ...latestPerType.filter((j) => !seen.has(j.id))];
    const pendingApprovals = (project.approvals as Array<{ status: string }>).filter((a) => a.status === 'PENDING');
    return { ...project, jobs: merged, approvals: pendingApprovals };
  }

  async update(userId: string, projectId: string, data: Partial<CreateProjectDto> & { status?: string; publishingStatus?: string }, userRole?: string) {
    const project = await this.get(userId, projectId);
    if ((project as Record<string, unknown>)['isDemo'] && userRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Demo projects can only be edited by a Super Admin');
    }
    const { channelId: _channelId, status, billingOrgId, publishingStatus, ...rest } = data;
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...rest,
        ...(status ? { status: status as import('@prisma/client').ProjectStatus } : {}),
        ...(publishingStatus ? { publishingStatus: publishingStatus as import('@prisma/client').$Enums.PublishingStatus } : {}),
        // Distinguish "not sent" (leave as-is) from null/'' (clear the org link)
        ...(billingOrgId !== undefined
          ? { billingOrgId: await this.resolveBillingOrgId(userId, billingOrgId) }
          : {}),
      },
    });
  }

  async delete(userId: string, projectId: string, userRole?: string) {
    const project = await this.get(userId, projectId);
    if ((project as Record<string, unknown>)['isDemo'] && userRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Demo projects can only be deleted by a Super Admin');
    }
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  /**
   * Save a human-edited script as the authoritative SCRIPT result for this project.
   * Subsequent pipeline stages (FACT_CHECK, COMPLIANCE, etc.) call lastResult('SCRIPT')
   * which returns the most recent COMPLETED SCRIPT job — so this override takes effect
   * without rerunning any stages.
   */
  async saveScript(userId: string, projectId: string, raw: unknown): Promise<ScriptOutput> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Project not found');

    const script = ScriptOutputSchema.parse(raw);
    const now = new Date();
    await this.prisma.agentJob.create({
      data: {
        projectId,
        type: 'SCRIPT',
        status: 'COMPLETED',
        payload: { source: 'human-edit' } as never,
        result: script as never,
        startedAt: now,
        completedAt: now,
      },
    });
    return script;
  }

  /**
   * Pin a user-uploaded image asset to a specific scene in the IMAGE_GENERATE result.
   * Creates a new completed IMAGE_GENERATE job with the patched images array so that
   * lastResult('IMAGE_GENERATE') picks it up without re-running image generation.
   */
  async pinSceneImage(
    userId: string,
    projectId: string,
    sceneIndex: number,
    data: { versionId: string; assetId: string },
  ): Promise<{ images: unknown[] }> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Project not found');

    type ImgEntry = { sceneId: string; assetId: string; versionId: string; provider: string; cached: boolean };
    const prev = await this.prisma.agentJob.findFirst({
      where: { projectId, type: 'IMAGE_GENERATE', status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: { result: true },
    });
    const prevImages: ImgEntry[] = (prev?.result as { images?: ImgEntry[] })?.images ?? [];

    if (sceneIndex < 0 || (prevImages.length > 0 && sceneIndex >= prevImages.length)) {
      throw new BadRequestException(`Scene index ${sceneIndex} out of range`);
    }

    const placeholder: ImgEntry = { sceneId: `scene-${sceneIndex}`, assetId: data.assetId, versionId: data.versionId, provider: 'user-upload', cached: false };
    const patched: ImgEntry[] = prevImages.length === 0
      ? [placeholder]
      : prevImages.map((img, i) =>
          i === sceneIndex
            ? { ...img, assetId: data.assetId, versionId: data.versionId, provider: 'user-upload', cached: false }
            : img,
        );

    const now = new Date();
    await this.prisma.agentJob.create({
      data: {
        projectId,
        type: 'IMAGE_GENERATE',
        status: 'COMPLETED',
        payload: { source: 'user-pin', sceneIndex } as never,
        result: { images: patched } as never,
        startedAt: now,
        completedAt: now,
      },
    });

    return { images: patched };
  }

  /** Returns public demo/advertisement projects visible to all users (no auth required). */
  async listPublic(opts: { limit?: number } = {}) {
    const take = Math.min(opts.limit ?? 20, 50);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- isDemo field pending Prisma client regen after migration
    return (this.prisma.project as any).findMany({
      where: { isDemo: true },
      select: {
        id: true, title: true, description: true, contentFormat: true,
        niche: true, platforms: true, publishingStatus: true,
        createdAt: true, updatedAt: true,
        channel: { select: { title: true, thumbnailUrl: true } },
        videos: { take: 1, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, thumbnailUrl: true, youtubeVideoId: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take,
    });
  }
}
