import { Controller, Get, Post, Query, Body, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ImageExternalService } from './image-external.service';
import { ThumbnailService } from './thumbnail.service';

@Controller('media-library')
@UseGuards(JwtAuthGuard)
export class MediaLibraryController {
  constructor(
    private readonly images: ImageExternalService,
    private readonly thumbnails: ThumbnailService,
  ) {}

  // ── Provider availability ─────────────────────────────────────────────────

  @Get('images/providers')
  imageProviders() {
    return this.images.getProviders();
  }

  // ── Image search ──────────────────────────────────────────────────────────

  @Get('images/search')
  searchImages(
    @Query('q') q: string,
    @Query('source') source?: 'pexels' | 'unsplash' | 'pixabay' | 'openverse' | 'all',
    @Query('perPage') perPage?: string,
  ) {
    return this.images.search({ q: q ?? 'nature', source, perPage: perPage ? Number(perPage) : 20 });
  }

  @Get('images/trending')
  trendingImages(@Query('topic') topic?: string) {
    return this.images.getTrending(topic ?? 'technology');
  }

  // ── Thumbnail generation ──────────────────────────────────────────────────

  @Post('thumbnail/generate')
  async generateThumbnail(
    @Body() body: {
      videoTitle: string;
      scriptExcerpt: string;
      channelTopic?: string;
      style?: 'bold' | 'minimal' | 'dramatic' | 'educational' | 'vlog';
      generateImages?: boolean;
    },
  ) {
    try {
      return await this.thumbnails.generate({
        videoTitle: body.videoTitle ?? 'My Video',
        scriptExcerpt: body.scriptExcerpt ?? '',
        channelTopic: body.channelTopic,
        style: body.style ?? 'bold',
        generateImages: body.generateImages !== false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thumbnail generation failed';
      throw new InternalServerErrorException(msg);
    }
  }
}
