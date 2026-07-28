import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VideoGenerationService } from './video-generation.service';
import type { VideoRequest } from './media.types';

@Controller('video-generation')
@UseGuards(JwtAuthGuard)
export class VideoGenerationController {
  constructor(private readonly svc: VideoGenerationService) {}

  @Get('providers')
  providers(): { providers: string[] } {
    return { providers: this.svc.getAvailableProviders() };
  }

  @Post('generate')
  async generate(@Body() req: VideoRequest, @Res() res: Response): Promise<void> {
    const result = await this.svc.generate(req);
    res.set({
      'Content-Type': result.mimeType,
      'X-Provider': result.provider,
      'X-Duration': String(result.durationSeconds),
      'X-Width': String(result.width),
      'X-Height': String(result.height),
    });
    res.send(result.buffer);
  }
}
