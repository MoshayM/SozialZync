import { Controller, Get, Patch, Delete, Body, Param, Query, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

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
    // All user projects are private by default — public visibility is a future feature
    if (visibility === 'public') return { items: [], nextCursor: null };

    const limit = Math.min(parseInt(take ?? '8', 10) || 8, 50);

    // Only show projects with a completed render — separates finished content from
    // editor work-in-progress snapshots (which live in localStorage as Private Drafts)
    const projects = await this.prisma.project.findMany({
      where: {
        userId: user.sub,
        isDemo: false,
        renders: { some: { status: 'READY' } },
        ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      include: {
        renders: {
          where: { status: 'READY' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const hasMore = projects.length > limit;
    const page = projects.slice(0, limit);

    const items = page.map((p) => ({
      id: p.id,
      title: p.title,
      type: 'VIDEO' as const,
      thumbnailUrl: null as string | null,
      isPublic: false,
      shareUrl: null as string | null,
      duration: p.renders[0]?.durationMs != null ? Math.round(p.renders[0].durationMs / 1000) : null,
      viewCount: p.viewCount,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      projectId: p.id,
    }));

    return {
      items,
      nextCursor: hasMore ? page[page.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  @Patch(':id/visibility')
  async setVisibility(
    @Param('id') id: string,
    @CurrentUser() _user: JwtPayload,
    @Body() body: { isPublic: boolean },
  ) {
    // Visibility control is a future feature — acknowledge without DB change
    return { id, isPublic: body.isPublic, shareUrl: null };
  }

  @Get(':id/share-url')
  getShareUrl(@Param('id') id: string, @CurrentUser() _user: JwtPayload) {
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
}
