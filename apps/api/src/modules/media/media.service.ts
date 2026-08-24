import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { AssetKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from './storage.service';
import type {
  GeneratedMedia, VoiceAdapter, ImageAdapter, MusicAdapter, VideoAdapter,
  VoiceRequest, ImageRequest, MusicRequest, SceneVideoRequest,
} from './media.types';
import { CoquiVoiceAdapter } from './adapters/voice-coqui.adapter';
import { FishSpeechVoiceAdapter } from './adapters/voice-fish-speech.adapter';
import { StyleTTS2VoiceAdapter } from './adapters/voice-styletts2.adapter';
import { KokoroVoiceAdapter } from './adapters/voice-kokoro.adapter';
import { PiperVoiceAdapter } from './adapters/voice-piper.adapter';
import { OpenAiVoiceAdapter } from './adapters/voice-openai.adapter';
import { ElevenLabsVoiceAdapter } from './adapters/voice-elevenlabs.adapter';
import { OfflineVoiceAdapter } from './adapters/voice-offline.adapter';
import { OfflineImageAdapter } from './adapters/image-offline.adapter';
import { OfflineMusicAdapter } from './adapters/music-offline.adapter';
import { FfmpegSceneVideoAdapter } from './adapters/video-ffmpeg.adapter';
import { ComfyUIImageAdapter } from './adapters/image-comfyui.adapter';
import { A1111ImageAdapter } from './adapters/image-a1111.adapter';
import { OpenAiImageAdapter } from './adapters/image-openai.adapter';
import { GeminiImageAdapter } from './adapters/image-gemini.adapter';
import { ComfyUIVideoAdapter } from './adapters/video-comfyui.adapter';
import { KlingVideoAdapter } from './adapters/video-kling.adapter';
import { LumaVideoAdapter } from './adapters/video-luma.adapter';
import { RunwayVideoAdapter } from './adapters/video-runway.adapter';
import { PikaVideoAdapter } from './adapters/video-pika.adapter';
import { VeoVideoAdapter } from './adapters/video-veo.adapter';
import { MusicGenLocalAdapter } from './adapters/music-musicgen.adapter';
import { SunoMusicAdapter } from './adapters/music-suno.adapter';
import { ReplicateMusicAdapter } from './adapters/music-replicate.adapter';
import { StabilityMusicAdapter } from './adapters/music-stability.adapter';
import { UdioMusicAdapter } from './adapters/music-udio.adapter';
import { validateMediaBuffer, formatIssues, type MediaValidationKind } from './media-validation.util';

export interface StoredAsset {
  assetId: string;
  versionId: string;
  key: string;
  absPath: string;
  provider: string;
  durationMs?: number;
  sizeBytes: number;
  cached: boolean;
  notes?: string;
}

type AdapterChain<T> = { configured: string | undefined; adapters: T[] };

/**
 * AI Orchestrator for media (update.txt): provider selection, automatic
 * fallback, caching, provenance. No module calls a media provider directly —
 * everything goes through this service. Adapter order: the env-configured
 * provider first (VOICE_PROVIDER / IMAGE_PROVIDER / MUSIC_PROVIDER /
 * VIDEO_PROVIDER), then remaining adapters by registration order, offline
 * fallbacks last, so generation never dead-ends.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  private readonly voice: AdapterChain<VoiceAdapter> = {
    configured: process.env['VOICE_PROVIDER'],
    // Cloud providers first (if key set), then self-hosted, then offline fallback
    adapters: [new OpenAiVoiceAdapter(), new ElevenLabsVoiceAdapter(), new CoquiVoiceAdapter(), new FishSpeechVoiceAdapter(), new StyleTTS2VoiceAdapter(), new KokoroVoiceAdapter(), new PiperVoiceAdapter(), new OfflineVoiceAdapter()],
  };
  private readonly image: AdapterChain<ImageAdapter> = {
    configured: process.env['IMAGE_PROVIDER'],
    // Cloud: OpenAI DALL-E 3, Gemini Imagen — then self-hosted — then placeholder
    adapters: [new OpenAiImageAdapter(), new GeminiImageAdapter(), new ComfyUIImageAdapter(), new A1111ImageAdapter(), new OfflineImageAdapter()],
  };
  private readonly music: AdapterChain<MusicAdapter> = {
    configured: process.env['MUSIC_PROVIDER'],
    // Cloud: Suno (PiAPI), Udio, Replicate, Stability — then local MusicGen — then synth placeholder
    adapters: [new SunoMusicAdapter(), new UdioMusicAdapter(), new ReplicateMusicAdapter(), new StabilityMusicAdapter(), new MusicGenLocalAdapter(), new OfflineMusicAdapter()],
  };
  private readonly video: AdapterChain<VideoAdapter> = {
    configured: process.env['VIDEO_PROVIDER'],
    // Cloud: Kling, Luma, Runway, Pika, Veo — then self-hosted ComfyUI — then FFmpeg scene builder
    adapters: [new KlingVideoAdapter(), new LumaVideoAdapter(), new RunwayVideoAdapter(), new PikaVideoAdapter(), new VeoVideoAdapter(), new ComfyUIVideoAdapter(), new FfmpegSceneVideoAdapter()],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  generateVoice(projectId: string, label: string, req: VoiceRequest): Promise<StoredAsset> {
    return this.generate(projectId, 'VOICE', label, req, this.orderedAdapters(this.voice), (a, r) => a.synthesize(r));
  }

  generateImage(projectId: string, label: string, req: ImageRequest): Promise<StoredAsset> {
    return this.generate(projectId, 'IMAGE', label, req, this.orderedAdapters(this.image), (a, r) => a.generateImage(r));
  }

  generateMusic(projectId: string, label: string, req: MusicRequest): Promise<StoredAsset> {
    return this.generate(projectId, 'MUSIC', label, req, this.orderedAdapters(this.music), (a, r) => a.compose(r));
  }

  generateSceneVideo(projectId: string, label: string, req: SceneVideoRequest): Promise<StoredAsset> {
    return this.generate(projectId, 'VIDEO', label, req, this.orderedAdapters(this.video), (a, r) => a.renderScene(r));
  }

  private orderedAdapters<T extends { name: string; available(): boolean }>(chain: AdapterChain<T>): T[] {
    const ordered = [...chain.adapters];
    if (chain.configured) {
      ordered.sort((a, b) => (a.name === chain.configured ? -1 : b.name === chain.configured ? 1 : 0));
    }
    return ordered.filter((a) => a.available());
  }

  private async generate<TReq, TAdapter extends { name: string }>(
    projectId: string,
    kind: AssetKind,
    label: string,
    req: TReq,
    adapters: TAdapter[],
    call: (adapter: TAdapter, req: TReq) => Promise<GeneratedMedia>,
  ): Promise<StoredAsset> {
    if (adapters.length === 0) {
      throw new Error(
        `No available ${kind} provider — configure a provider API key, or set ALLOW_OFFLINE_MEDIA=true to accept clearly-labelled dev placeholders. Refusing to fabricate output (audit-placeholders.md).`,
      );
    }

    // Token optimization: never regenerate completed assets — identical
    // request (kind+label+params) returns the cached version. The preferred
    // adapter is part of the hash so switching providers naturally invalidates
    // placeholder-era caches.
    const requestHash = createHash('sha256')
      .update(`${kind}:${label}:${adapters[0]!.name}:${JSON.stringify(req)}`)
      .digest('hex');
    const cachedVersion = await this.prisma.assetVersion.findFirst({
      where: {
        params: { path: ['requestHash'], equals: requestHash },
        asset: { projectId, kind, deletedAt: null, status: { in: ['READY', 'ACCEPTED'] } },
      },
      include: { asset: true },
      orderBy: { createdAt: 'desc' },
    });
    if (cachedVersion?.r2Key && this.storage.exists(cachedVersion.r2Key)) {
      return {
        assetId: cachedVersion.assetId,
        versionId: cachedVersion.id,
        key: cachedVersion.r2Key,
        absPath: this.storage.resolve(cachedVersion.r2Key),
        provider: cachedVersion.provider ?? 'unknown',
        durationMs: cachedVersion.durationMs ?? undefined,
        sizeBytes: Number(cachedVersion.sizeBytes),
        cached: true,
      };
    }

    const asset = await this.prisma.asset.create({
      data: { projectId, kind, label, status: 'GENERATING' },
    });

    let lastErr: unknown = null;
    for (const adapter of adapters) {
      try {
        const media = await call(adapter, req);

        // Validation gate (master prompt §9): reject silent/corrupt/zero-
        // duration/undersized output BEFORE it can become a READY asset. A
        // failed validation is an adapter failure — fall through to the next
        // provider, or fail the stage. Never store fake-valid media.
        const expectedDurationMs =
          typeof (req as { durationSecs?: number }).durationSecs === 'number'
            ? (req as { durationSecs: number }).durationSecs * 1000
            : undefined;
        const validation = await validateMediaBuffer(
          kind as MediaValidationKind,
          media.buffer,
          media.ext,
          { expectedDurationMs },
        );
        if (!validation.ok) {
          throw new Error(`Output failed validation — ${formatIssues(validation)}`);
        }

        const key = `assets/${projectId}/${asset.id}/v1/media.${media.ext}`;
        const { absPath, sizeBytes } = await this.storage.put(key, media.buffer);
        const contentHash = createHash('sha256').update(media.buffer).digest('hex');

        const version = await this.prisma.assetVersion.create({
          data: {
            assetId: asset.id,
            version: 1,
            r2Key: key,
            contentHash,
            provider: adapter.name,
            model: media.model,
            prompt: { request: JSON.parse(JSON.stringify(req)) as object } as never,
            params: { requestHash } as never,
            // Write-once provenance (claude.md golden rule 4 / security.md §10)
            provenance: {
              provider: adapter.name,
              model: media.model,
              generatedAt: new Date().toISOString(),
              license: adapter.name.startsWith('offline-') ? 'generated-in-app-royalty-free' : 'provider-tos',
              notes: media.notes ?? null,
            } as never,
            sizeBytes: BigInt(sizeBytes),
            durationMs: media.durationMs ?? null,
          },
        });
        await this.prisma.asset.update({
          where: { id: asset.id },
          data: { status: 'READY', currentVersionId: version.id },
        });

        return {
          assetId: asset.id,
          versionId: version.id,
          key,
          absPath,
          provider: adapter.name,
          durationMs: media.durationMs,
          sizeBytes,
          cached: false,
          notes: media.notes,
        };
      } catch (err) {
        lastErr = err;
        this.logger.warn(`${kind} adapter ${adapter.name} failed, trying next: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
      }
    }

    await this.prisma.asset.update({ where: { id: asset.id }, data: { status: 'FAILED' } });
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}
