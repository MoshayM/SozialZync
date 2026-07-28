import { Controller, ForbiddenException, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'OWNER']);

/**
 * Token usage dashboard data (§12.2.8/§15) — SUPER_ADMIN/OWNER only.
 * Admins see platform-wide spend; all other roles receive 403.
 */
@Controller('token-usage')
@UseGuards(JwtAuthGuard)
export class TokenUsageController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    if (!ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('AI usage data is restricted to administrators');
    }

    const sinceDays = Math.min(Number(days) || 30, 365);
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    // No userId filter — admins see platform-wide spend across all users
    const [ledger, byModel, actions, byVideoRaw, rawDaily] = await Promise.all([
      this.prisma.tokenUsage.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { tokensIn: true, tokensOut: true, costUsd: true },
        _count: true,
      }),
      this.prisma.tokenUsage.groupBy({
        by: ['provider', 'model'],
        where: { createdAt: { gte: since } },
        _sum: { tokensIn: true, tokensOut: true, costUsd: true },
        _count: true,
      }),
      // Cache-hit rate across all copilot/voice turns platform-wide
      this.prisma.actionRecord.groupBy({
        by: ['fromCache'],
        where: { createdAt: { gte: since }, source: { in: ['COPILOT', 'VOICE'] } },
        _count: true,
      }),
      // Per-video breakdown — top 15 by cost platform-wide
      this.prisma.tokenUsage.groupBy({
        by: ['importedVideoId'],
        where: { createdAt: { gte: since }, importedVideoId: { not: null } },
        _sum: { tokensIn: true, tokensOut: true, costUsd: true },
        _count: true,
        orderBy: { _sum: { costUsd: 'desc' } },
        take: 15,
      }),
      // Raw rows for daily aggregation (non-cache only for cost trend)
      this.prisma.tokenUsage.findMany({
        where: { createdAt: { gte: since }, fromCache: false },
        select: { createdAt: true, costUsd: true, tokensIn: true, tokensOut: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const videoTitles = new Map(
      (await this.prisma.importedVideo.findMany({
        where: { id: { in: byVideoRaw.map((v) => v.importedVideoId!).filter(Boolean) } },
        select: { id: true, title: true },
      })).map((v) => [v.id, v.title]),
    );

    const hits = actions.find((a) => a.fromCache)?._count ?? 0;
    const misses = actions.find((a) => !a.fromCache)?._count ?? 0;

    // Aggregate raw rows into per-day buckets
    const dayMap = new Map<string, { costUsd: number; tokensIn: number; tokensOut: number; calls: number }>();
    for (const row of rawDaily) {
      const date = row.createdAt.toISOString().slice(0, 10);
      const existing = dayMap.get(date) ?? { costUsd: 0, tokensIn: 0, tokensOut: 0, calls: 0 };
      dayMap.set(date, {
        costUsd: existing.costUsd + Number(row.costUsd),
        tokensIn: existing.tokensIn + row.tokensIn,
        tokensOut: existing.tokensOut + row.tokensOut,
        calls: existing.calls + 1,
      });
    }
    const byDay = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        costUsd: Number(d.costUsd.toFixed(4)),
        tokensIn: d.tokensIn,
        tokensOut: d.tokensOut,
        calls: d.calls,
      }));

    return {
      sinceDays,
      totals: {
        calls: ledger._count,
        tokensIn: ledger._sum.tokensIn ?? 0,
        tokensOut: ledger._sum.tokensOut ?? 0,
        costUsd: Number((ledger._sum.costUsd ?? 0).toFixed(4)),
      },
      byModel: byModel.map((m) => ({
        provider: m.provider,
        model: m.model,
        calls: m._count,
        tokensIn: m._sum.tokensIn ?? 0,
        tokensOut: m._sum.tokensOut ?? 0,
        costUsd: Number((m._sum.costUsd ?? 0).toFixed(4)),
      })),
      copilot: {
        turns: hits + misses,
        cacheHits: hits,
        cacheHitRate: hits + misses > 0 ? Number((hits / (hits + misses)).toFixed(3)) : null,
      },
      byVideo: byVideoRaw.map((v) => ({
        importedVideoId: v.importedVideoId,
        title: videoTitles.get(v.importedVideoId!) ?? '(deleted video)',
        calls: v._count,
        tokensIn: v._sum.tokensIn ?? 0,
        tokensOut: v._sum.tokensOut ?? 0,
        costUsd: Number((v._sum.costUsd ?? 0).toFixed(4)),
      })),
      byDay,
    };
  }
}
