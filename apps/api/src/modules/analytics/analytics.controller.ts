import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { BenchmarkService } from './benchmark.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';
import type { Request } from 'express';

interface AuthReq extends Request {
  user: { id: string; email: string };
}

@TierRateLimit({ bucket: 'analytics', windowSecs: 3600, limits: { FREE: 30, STARTER: 100, PRO: 300, AGENCY: 1000, default: 30 } })
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly benchmarkSvc: BenchmarkService,
  ) {}

  @Get(':channelId/overview')
  async overview(@Param('channelId') channelId: string, @Req() req: AuthReq) {
    return this.analytics.getChannelOverview(channelId, req.user.id);
  }

  @Post(':channelId/report')
  async report(@Param('channelId') channelId: string, @Req() req: AuthReq) {
    return this.analytics.generateReport(channelId, req.user.id);
  }

  @Get(':channelId/benchmark')
  async benchmark(@Param('channelId') channelId: string, @Req() req: AuthReq) {
    return this.benchmarkSvc.benchmark(channelId, req.user.id);
  }
}
