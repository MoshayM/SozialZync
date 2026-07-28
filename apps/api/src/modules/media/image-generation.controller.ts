import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ImageGenerationService } from './image-generation.service';
import type { SelfHostedImageRequest } from './media.types';

@Controller('image-generation')
@UseGuards(JwtAuthGuard)
export class ImageGenerationController {
  constructor(private readonly svc: ImageGenerationService) {}

  @Get('providers')
  providers(): { providers: string[] } {
    return { providers: this.svc.getAvailableProviders() };
  }

  @Post('generate')
  async generate(@Body() req: SelfHostedImageRequest, @Res() res: Response): Promise<void> {
    const result = await this.svc.generate(req);
    res.set({
      'Content-Type': result.mimeType,
      'X-Provider': result.provider,
      'X-Model': result.model,
      'X-Width': String(result.width),
      'X-Height': String(result.height),
      'X-Seed': String(result.seed ?? ''),
    });
    res.send(result.buffer);
  }
}
