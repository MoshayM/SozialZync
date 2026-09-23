import {
  Controller, Get, Patch, Delete, Body, Param, Query,
  UseGuards, NotFoundException, ForbiddenException, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

// @reason: EditProject is not in the generated Prisma client yet — accessed via dynamic key
const ep = (p: PrismaService) => (p as unknown as Record<string, unknown>)['editProject'] as {
  findMany: (args: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown | null>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
};

interface EditProjectRow {
  id: string;
  projectId: string;
  title: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
  project?: { userId: string };
}

@ApiTags('my-content')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my-content')
export class MyContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
    @Query('visibility') visibility?: 'all' | 'private' | 'public',
    @Query('q') q?: string,
  ) {
    const limit = Math.min(parseInt(take ?? '8', 10) || 8, 50);

    const items: Array<{
      id: string;
      title: string;
      type: string;
      thumbnailUrl: string | null;
      isPublic: boolean;
      shareUrl: string | null;
      duration: number | null;
      viewCount: number | null;
      createdAt: string;
      updatedAt: string;
      projectId: string | null;
      source: 'project' | 'edit_draft';
      editId?: string;
    }> = [];

    // ── Rendered projects (existing behaviour) ─────────────────────────────────
    if (visibility !== 'public') {
      const projects = await this.prisma.project.findMany({
        where: {
          userId: user.sub,
          isDemo: false,
          renders: { some: { status: 'READY' } },
          ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          renders: {
            where: { status: 'READY' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      for (const p of projects) {
        items.push({
          id: p.id,
          title: p.title,
          type: 'VIDEO',
          thumbnailUrl: null,
          isPublic: false,
          shareUrl: null,
          duration: p.renders[0]?.durationMs != null ? Math.round(p.renders[0].durationMs / 1000) : null,
          viewCount: p.viewCount,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          projectId: p.id,
          source: 'project',
        });
      }
    }

    // ── Editor private drafts ─────────────────────────────────────────────────
    const draftStatus = visibility === 'public' ? 'PUBLIC_CONTENT' : 'PRIVATE_CONTENT';
    const statuses =
      visibility === 'all' || !visibility
        ? ['PRIVATE_CONTENT', 'PUBLIC_CONTENT']
        : [draftStatus];

    const editDrafts = (await ep(this.prisma).findMany({
      where: {
        status: { in: statuses },
        project: { userId: user.sub },
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: { project: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })) as (EditProjectRow & { project: { userId: string } })[];

    for (const ep of editDrafts) {
      items.push({
        id: ep.id,
        title: ep.title,
        type: 'DRAFT',
        thumbnailUrl: null,
        isPublic: ep.status === 'PUBLIC_CONTENT',
        shareUrl: null,
        duration: null,
        viewCount: null,
        createdAt: ep.createdAt.toISOString(),
        updatedAt: ep.updatedAt.toISOString(),
        projectId: ep.projectId,
        source: 'edit_draft',
        editId: ep.id,
      });
    }

    // Sort combined list by updatedAt desc and cap at limit
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const page = items.slice(0, limit);
    const nextCursor = page.length === limit ? page[page.length - 1]?.createdAt ?? null : null;

    return { items: page, nextCursor };
  }

  @Patch(':id/visibility')
  async setVisibility(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { isPublic: boolean },
  ) {
    // Check if it's a project
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (project) {
      if (project.userId !== user.sub) throw new ForbiddenException('Not your content');
      return { id, isPublic: body.isPublic, shareUrl: null };
    }
    // Fall through — not found as project
    return { id, isPublic: body.isPublic, shareUrl: null };
  }

  @Get(':id/share-url')
  getShareUrl(@Param('id') _id: string, @CurrentUser() _user: JwtPayload) {
    return { shareUrl: null };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Content not found');
    if (project.userId !== user.sub) throw new ForbiddenException('Not your content');
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }

  // ── Editor draft specific endpoints ───────────────────────────────────────────

  @Patch('edit-draft/:id/visibility')
  async setEditDraftVisibility(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { isPublic: boolean },
  ) {
    const draft = (await ep(this.prisma).findUnique({
      where: { id },
      include: { project: true },
    })) as (EditProjectRow & { project: { userId: string } }) | null;
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.project.userId !== user.sub) throw new ForbiddenException('Not your draft');

    const newStatus = body.isPublic ? 'PUBLIC_CONTENT' : 'PRIVATE_CONTENT';
    await ep(this.prisma).update({ where: { id }, data: { status: newStatus } });
    return { id, isPublic: body.isPublic };
  }

  @Delete('edit-draft/:id')
  @HttpCode(204)
  async deleteEditDraft(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const draft = (await ep(this.prisma).findUnique({
      where: { id },
      include: { project: true },
    })) as (EditProjectRow & { project: { userId: string } }) | null;
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.project.userId !== user.sub) throw new ForbiddenException('Not your draft');

    // Reset status back to DRAFT so it's removed from My Content; don't delete the edit project
    await ep(this.prisma).update({ where: { id }, data: { status: 'DRAFT' } });
  }
}
