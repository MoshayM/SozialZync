import { Injectable, Logger } from '@nestjs/common';
import type { SelfHostedImageAdapter, SelfHostedImageRequest, GeneratedImage } from './media.types';
import { ComfyUIImageAdapter } from './adapters/image-comfyui.adapter';
import { A1111ImageAdapter } from './adapters/image-a1111.adapter';

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private readonly adapters: SelfHostedImageAdapter[] = [
    new ComfyUIImageAdapter(),
    new A1111ImageAdapter(),
  ];

  async generate(req: SelfHostedImageRequest): Promise<GeneratedImage> {
    const available = this.adapters.filter((a) => a.available());
    if (!available.length) {
      throw new Error(
        'No image generation provider configured. ' +
          'Set COMFYUI_URL or A1111_URL in environment variables, ' +
          'or configure a provider in Settings → AI Providers.',
      );
    }

    let lastError: Error | undefined;
    for (const adapter of available) {
      try {
        this.logger.log(`Generating image via ${adapter.name}`);
        const result = await adapter.generate(req);
        this.logger.log(`Image generated via ${adapter.name} (${result.width}×${result.height})`);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(`${adapter.name} failed: ${lastError.message} — trying next`);
      }
    }
    throw lastError ?? new Error('All image generation providers failed');
  }

  getAvailableProviders(): string[] {
    return this.adapters.filter((a) => a.available()).map((a) => a.name);
  }
}
