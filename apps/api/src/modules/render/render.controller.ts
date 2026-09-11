import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { RenderService } from './render.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import type { RenderPreset } from '@prisma/client';

@TierRateLimit({ bucket: 'render', windowSecs: 3600, limits: { FREE: 2, STARTER: 5, PRO: 20, AGENCY: 50, default: 2 } })
@Controller('render')
@UseGuards(JwtAuthGuard)
export class RenderController {
  constructor(private readonly render: RenderService) {}

  @Post()
  async queue(
    @Body() body: { projectId: string; timelineVersion: number; preset: RenderPreset },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.render.queueRender(body.projectId, body.timelineVersion, body.preset, user.sub);
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.render.getRender(id, user.sub);
  }

  @Get()
  async list(@Query('projectId') projectId: string, @CurrentUser() user: JwtPayload) {
    return this.render.listForProject(projectId, user.sub);
  }
}
