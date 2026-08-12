import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PlatformMediaService } from './services/platform-media.service';

@Controller('platforms/:platformId/media')
@UseGuards(JwtAuthGuard)
export class PlatformMediaController {
  constructor(private readonly mediaService: PlatformMediaService) {}

  @Get()
  getMedia(
    @Param('platformId') platformId: string,
    @Query('type') type = 'all',
    @Query('limit') limit = '12',
    @Query('cursor') cursor: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mediaService.getMedia(user.sub, platformId, {
      type,
      limit: Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50),
      cursor,
    });
  }
}
