import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { BenchmarkService } from './benchmark.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

@TierRateLimit({ bucket: 'analytics', windowSecs: 3600, limits: { FREE: 30, STARTER: 100, PRO: 300, AGENCY: 1000, default: 30 } })
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly benchmarkSvc: BenchmarkService,
  ) {}

  @Get(':channelId/overview')
  async overview(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayload) {
    return this.analytics.getChannelOverview(channelId, user.sub);
  }

  @Post(':channelId/report')
  async report(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayload) {
    return this.analytics.generateReport(channelId, user.sub);
  }

  @Get(':channelId/benchmark')
  async benchmark(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayload) {
    return this.benchmarkSvc.benchmark(channelId, user.sub);
  }
}
