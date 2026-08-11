import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SystemService } from './system.service';
import { StorageService } from './storage.service';
import { CoquiVoiceAdapter } from '../media/adapters/voice-coqui.adapter';
import { KokoroVoiceAdapter } from '../media/adapters/voice-kokoro.adapter';
import { PiperVoiceAdapter } from '../media/adapters/voice-piper.adapter';
import { OfflineVoiceAdapter } from '../media/adapters/voice-offline.adapter';
import { OfflineImageAdapter } from '../media/adapters/image-offline.adapter';
import { OfflineMusicAdapter } from '../media/adapters/music-offline.adapter';
import { FfmpegSceneVideoAdapter } from '../media/adapters/video-ffmpeg.adapter';
import { ComfyUIImageAdapter } from '../media/adapters/image-comfyui.adapter';
import { A1111ImageAdapter } from '../media/adapters/image-a1111.adapter';
import { ComfyUIVideoAdapter } from '../media/adapters/video-comfyui.adapter';
import { MusicGenLocalAdapter } from '../media/adapters/music-musicgen.adapter';

@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(
    private readonly svc: SystemService,
    private readonly storageSvc: StorageService,
  ) {}

  @Get('stats')
  async getStats(@Query('refresh') refresh?: string) {
    return this.svc.getStats(refresh === 'true');
  }

  @Get('gpu')
  async getGpu() {
    const stats = await this.svc.getStats();
    return { gpus: stats.gpus, primaryBackend: stats.primaryBackend };
  }

  @Get('disk')
  async getDisk(@Query('path') path = process.cwd()) {
    return this.svc.getDiskUsage(path);
  }

  @Get('storage')
  async getStorageStats() {
    return this.storageSvc.getStats();
  }

  @Delete('storage/:category')
  async clearCategory(@Param('category') category: string) {
    const valid = ['images', 'videos', 'voices', 'music', 'cache'];
    if (!valid.includes(category)) {
      throw new Error(`Cannot clear category '${category}' — only [${valid.join(', ')}] allowed`);
    }
    return this.storageSvc.clearCategory(category);
  }

  @Get('media-providers')
  getMediaProviders() {
    const check = (name: string, adapter: { available(): boolean }, category: string, isOffline = false) => ({
      name, category, available: adapter.available(), isOffline,
    });
    return {
      voice: [
        check('coqui',        new CoquiVoiceAdapter(),       'voice'),
        check('kokoro',       new KokoroVoiceAdapter(),      'voice'),
        check('piper',        new PiperVoiceAdapter(),       'voice'),
        check('offline',      new OfflineVoiceAdapter(),     'voice', true),
      ],
      image: [
        check('comfyui',      new ComfyUIImageAdapter(),   'image'),
        check('a1111',        new A1111ImageAdapter(),      'image'),
        check('offline',      new OfflineImageAdapter(),   'image', true),
      ],
      music: [
        check('musicgen-local', new MusicGenLocalAdapter(), 'music'),
        check('offline',      new OfflineMusicAdapter(),    'music', true),
      ],
      video: [
        check('comfyui-video', new ComfyUIVideoAdapter(),  'video'),
        check('ffmpeg',       new FfmpegSceneVideoAdapter(), 'video'),
      ],
      env: {
        ALLOW_OFFLINE_MEDIA: process.env['ALLOW_OFFLINE_MEDIA'] ?? 'false',
        VOICE_PROVIDER:      process.env['VOICE_PROVIDER']      ?? '',
        IMAGE_PROVIDER:      process.env['IMAGE_PROVIDER']      ?? '',
        MUSIC_PROVIDER:      process.env['MUSIC_PROVIDER']      ?? '',
        VIDEO_PROVIDER:      process.env['VIDEO_PROVIDER']      ?? '',
      },
    };
  }
}
