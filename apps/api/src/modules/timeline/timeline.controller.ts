import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('editor')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get(':projectId/timeline')
  async getDraft(@Param('projectId') projectId: string, @CurrentUser() user: JwtPayload) {
    return this.timeline.getDraft(projectId, user.sub);
  }

  @Patch(':projectId/timeline')
  async saveDraft(
    @Param('projectId') projectId: string,
    @Body() body: { tracks: unknown; fps?: number; resolution?: unknown; expectedVersion?: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.timeline.saveDraft(projectId, user.sub, body.tracks, body.fps, body.resolution, body.expectedVersion);
  }

  @Post(':projectId/timeline/versions')
  async freeze(
    @Param('projectId') projectId: string,
    @Body() body: { label: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.timeline.freezeVersion(projectId, user.sub, body.label);
  }

  @Post(':projectId/timeline/versions/:v/restore')
  async restore(
    @Param('projectId') projectId: string,
    @Param('v') v: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.timeline.restoreVersion(projectId, user.sub, parseInt(v, 10));
  }
}
