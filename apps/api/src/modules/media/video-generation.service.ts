import { Injectable, Logger } from '@nestjs/common';
import type { VideoGenerationAdapter, VideoRequest, GeneratedVideo } from './media.types';
import { LocalFfmpegVideoAdapter } from './adapters/video-local.adapter';
import { ComfyUIVideoAdapter } from './adapters/video-comfyui.adapter';

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);
  private readonly adapters: VideoGenerationAdapter[] = [
    new LocalFfmpegVideoAdapter(), // always-available local render, zero API cost
    new ComfyUIVideoAdapter(),      // self-hosted ComfyUI for higher-quality generative video
  ];

  async generate(req: VideoRequest): Promise<GeneratedVideo> {
    const available = this.adapters.filter((a) => a.available());
    if (!available.length) {
      throw new Error(
        'No video generation provider available. ' +
          'ffmpeg must be on PATH (or set FFMPEG_PATH) for local rendering, ' +
          'or set COMFYUI_URL for ComfyUI.',
      );
    }

    let lastError: Error | undefined;
    for (const adapter of available) {
      try {
        this.logger.log(
          `Generating video via ${adapter.name} (prompt: ${req.prompt.slice(0, 60)}...)`,
        );
        const result = await adapter.generate(req);
        this.logger.log(
          `Video generated via ${adapter.name} (${result.width}×${result.height}, ${result.durationSeconds}s)`,
        );
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(`${adapter.name} failed: ${lastError.message} — trying next`);
      }
    }
    throw lastError ?? new Error('All video generation providers failed');
  }

  getAvailableProviders(): string[] {
    return this.adapters.filter((a) => a.available()).map((a) => a.name);
  }
}
