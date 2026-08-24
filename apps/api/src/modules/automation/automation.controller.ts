import { Controller, Get, Put, Post, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { AutomationService } from './automation.service';

@Controller('channels/:channelId/automation')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get()
  get(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayload) {
    return this.automation.get(channelId, user.sub);
  }

  @Put()
  update(
    @Param('channelId') channelId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    const plan = (user.plan ?? 'FREE') as string;
    const isElevated = user.role === 'SUPER_ADMIN' || user.role === 'OWNER';
    if (!isElevated && plan === 'FREE') {
      throw new ForbiddenException('Auto Scheduler requires a Pro plan. Upgrade to Pro ($17/mo).');
    }
    return this.automation.update(channelId, user.sub, body);
  }

  @Post('suggest')
  suggest(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayload) {
    const plan = (user.plan ?? 'FREE') as string;
    const isElevated = user.role === 'SUPER_ADMIN' || user.role === 'OWNER';
    if (!isElevated && plan === 'FREE') {
      throw new ForbiddenException('Auto Scheduler requires a Pro plan. Upgrade to Pro ($17/mo).');
    }
    return this.automation.suggest(channelId, user.sub);
  }
}
