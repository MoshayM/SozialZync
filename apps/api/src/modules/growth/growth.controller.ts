import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { GrowthService } from './growth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

@TierRateLimit({ bucket: 'growth', windowSecs: 3600, limits: { FREE: 5, STARTER: 20, PRO: 60, AGENCY: 150, default: 5 } })
@Controller('growth')
@UseGuards(JwtAuthGuard)
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Post('report')
  async report(
    @Body() body: { channelId: string; analyticsReport: unknown },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.growth.generateRecommendations(body.channelId, body.analyticsReport as never, user.sub);
  }
}
