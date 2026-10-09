import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { promises as fsPromises } from 'fs';
import * as os from 'os';
import * as path from 'path';
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
import { mixAudioTracks, toTempFile } from './adapters/ffmpeg.util';
import { analyzeReferenceVoice, applyVoiceStyleTransfer } from './adapters/voice-style-transfer.util';
import type { VoiceSpecOutput } from '@cf/shared';

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
    // ElevenLabs first (highest quality), then OpenAI TTS, then self-hosted, then offline
    adapters: [new ElevenLabsVoiceAdapter(), new OpenAiVoiceAdapter(), new CoquiVoiceAdapter(), new FishSpeechVoiceAdapter(), new StyleTTS2VoiceAdapter(), new KokoroVoiceAdapter(), new PiperVoiceAdapter(), new OfflineVoiceAdapter()],
  };
  private readonly image: AdapterChain<ImageAdapter> = {
    configured: process.env['IMAGE_PROVIDER'],
    // Cloud: OpenAI DALL-E 3, Gemini Imagen — then self-hosted — then placeholder
    adapters: [new OpenAiImageAdapter(), new GeminiImageAdapter(), new ComfyUIImageAdapter(), new A1111ImageAdapter(), new OfflineImageAdapter()],
  };
  private readonly music: AdapterChain<MusicAdapter> = {
    configured: process.env['MUSIC_PROVIDER'],
    // Default: in-app synth (always available, no key needed) → self-hosted MusicGen (MUSICGEN_URL)
    // → Replicate/Stability (API keys) → Suno/Udio (PiAPI key, opt-in only).
    // Set MUSIC_PROVIDER=<name> to promote any adapter to first position.
    adapters: [new OfflineMusicAdapter(), new MusicGenLocalAdapter(), new ReplicateMusicAdapter(), new StabilityMusicAdapter(), new SunoMusicAdapter(), new UdioMusicAdapter()],
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

  getProviderStatus(): {
    voice: { name: string; available: boolean }[];
    image: { name: string; available: boolean }[];
    music: { name: string; available: boolean }[];
    video: { name: string; available: boolean }[];
    active: { voice: string | null; image: string | null; music: string | null; video: string | null };
  } {
    const status = <T extends { name: string; available(): boolean }>(chain: AdapterChain<T>) =>
      chain.adapters.map((a) => ({ name: a.name, available: a.available() }));

    const first = <T extends { name: string; available(): boolean }>(chain: AdapterChain<T>) =>
      chain.adapters.find((a) => a.available())?.name ?? null;

    return {
      voice: status(this.voice),
      image: status(this.image),
      music: status(this.music),
      video: status(this.video),
      active: {
        voice: first(this.voice),
        image: first(this.image),
        music: first(this.music),
        video: first(this.video),
      },
    };
  }

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
      throw new Error(`No available ${kind} provider — configure a provider API key (VOICE_PROVIDER / IMAGE_PROVIDER / MUSIC_PROVIDER / VIDEO_PROVIDER). Refusing to fabricate output.`);
    }

    // Token optimization: never regenerate completed assets — identical
    // request (kind+label+params) returns the cached version. The preferred
    // adapter is part of the hash so switching providers naturally invalidates
    // placeholder-era caches.
    const requestHash = createHash('sha256')
      .update(`${kind}:${label}:${adapters[0]!.name}:${JSON.stringify(req)}`)
      .digest('hex');
    // Select only scalar metadata — never load the data blob in cache checks.
    const cachedMeta = await this.prisma.assetVersion.findFirst({
      where: {
        params: { path: ['requestHash'], equals: requestHash },
        asset: { projectId, kind, deletedAt: null, status: { in: ['READY', 'ACCEPTED'] } },
      },
      select: { id: true, assetId: true, r2Key: true, provider: true, durationMs: true, sizeBytes: true },
      orderBy: { createdAt: 'desc' },
    });
    if (cachedMeta?.r2Key) {
      if (this.storage.exists(cachedMeta.r2Key)) {
        return {
          assetId: cachedMeta.assetId,
          versionId: cachedMeta.id,
          key: cachedMeta.r2Key,
          absPath: this.storage.resolve(cachedMeta.r2Key),
          provider: cachedMeta.provider ?? 'unknown',
          durationMs: cachedMeta.durationMs ?? undefined,
          sizeBytes: Number(cachedMeta.sizeBytes),
          cached: true,
        };
      }
      // Disk file missing (ephemeral restart) — restore from DB blob if present.
      // This keeps the versionId stable across restarts so downstream job results
      // remain valid and the character-cast player doesn't show "file unavailable".
      const withData = await this.prisma.assetVersion.findUnique({
        where: { id: cachedMeta.id },
        select: { data: true },
      });
      if (withData?.data) {
        await this.storage.put(cachedMeta.r2Key, Buffer.from(withData.data)).catch(() => undefined);
        return {
          assetId: cachedMeta.assetId,
          versionId: cachedMeta.id,
          key: cachedMeta.r2Key,
          absPath: this.storage.resolve(cachedMeta.r2Key),
          provider: cachedMeta.provider ?? 'unknown',
          durationMs: cachedMeta.durationMs ?? undefined,
          sizeBytes: Number(cachedMeta.sizeBytes),
          cached: true,
        };
      }
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
            data: sizeBytes < 8 * 1024 * 1024 ? (media.buffer as unknown as Uint8Array<ArrayBuffer>) : null,
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

  /**
   * Mix a narration voice asset with a background music asset using FFmpeg amix.
   * Voice plays at full volume; music is ducked to ~−16 dB under narration.
   * Returns the mixed audio as a new MUSIC asset so it's playable and downloadable.
   */
  async mixAudio(projectId: string, voiceVersionId: string, musicVersionId: string, label = 'Narration + Music Mix'): Promise<StoredAsset> {
    const [voiceVer, musicVer] = await Promise.all([
      this.prisma.assetVersion.findUnique({ where: { id: voiceVersionId }, select: { r2Key: true, durationMs: true } }),
      this.prisma.assetVersion.findUnique({ where: { id: musicVersionId }, select: { r2Key: true } }),
    ]);
    if (!voiceVer?.r2Key || !musicVer?.r2Key) {
      throw new Error(`Audio mix: source assets not found (voice=${voiceVersionId}, music=${musicVersionId})`);
    }

    await Promise.all([this.storage.ensure(voiceVer.r2Key), this.storage.ensure(musicVer.r2Key)]);
    const voicePath = this.storage.resolve(voiceVer.r2Key);
    const musicPath = this.storage.resolve(musicVer.r2Key);

    const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'cf-mix-'));
    const outPath = path.join(tmpDir, 'mix.m4a');

    try {
      await mixAudioTracks({ voicePath, musicPath, outPath });
      const buffer = await fsPromises.readFile(outPath);
      const durationMs = voiceVer.durationMs ?? undefined;

      const asset = await this.prisma.asset.create({
        data: { projectId, kind: 'MUSIC', label, status: 'GENERATING' },
      });
      const key = `assets/${projectId}/${asset.id}/v1/mix.m4a`;
      const { absPath, sizeBytes } = await this.storage.put(key, buffer);
      const contentHash = createHash('sha256').update(buffer).digest('hex');

      const version = await this.prisma.assetVersion.create({
        data: {
          assetId: asset.id,
          version: 1,
          r2Key: key,
          contentHash,
          provider: 'ffmpeg-mix',
          model: 'ffmpeg-amix',
          prompt: { voiceVersionId, musicVersionId } as never,
          params: { mixedFrom: [voiceVersionId, musicVersionId] } as never,
          provenance: {
            provider: 'ffmpeg-mix',
            model: 'ffmpeg-amix',
            generatedAt: new Date().toISOString(),
            license: 'generated-in-app-royalty-free',
            notes: 'FFmpeg amix: voice 100% + background music 15%',
          } as never,
          sizeBytes: BigInt(sizeBytes),
          durationMs: durationMs ?? null,
          data: sizeBytes < 8 * 1024 * 1024 ? buffer : undefined,
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
        provider: 'ffmpeg-mix',
        durationMs: durationMs ?? undefined,
        sizeBytes,
        cached: false,
        notes: 'Voice narration + royalty-free background music (FFmpeg amix)',
      };
    } finally {
      await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * Generate narration via best available TTS then apply FFmpeg pitch-style
   * transfer to loosely match a user-recorded reference voice sample.
   * The referenceVersionId is the AssetVersion.id of the stored reference audio
   * (stored by VoiceService.cloneVoice as "local:<versionId>").
   */
  async generateVoiceWithStyleReference(
    projectId: string,
    narrationText: string,
    spec: VoiceSpecOutput | null,
    referenceVersionId: string,
  ): Promise<StoredAsset> {
    // 1. Resolve reference audio
    const refVer = await this.prisma.assetVersion.findUnique({
      where: { id: referenceVersionId },
      select: { r2Key: true, data: true },
    });
    if (!refVer?.r2Key) throw new Error(`Voice reference asset not found: ${referenceVersionId}`);

    // Restore from DB blob if disk file is missing
    let refOnDisk = this.storage.exists(refVer.r2Key);
    if (!refOnDisk && refVer.data) {
      await this.storage.put(refVer.r2Key, Buffer.from(refVer.data));
      refOnDisk = true;
    }
    if (!refOnDisk) throw new Error('Voice reference file not available — upload your voice sample again.');

    const refPath = this.storage.resolve(refVer.r2Key);

    // 2. Analyze reference voice characteristics
    const refStats = await analyzeReferenceVoice(refPath);

    // 3. Generate TTS narration with best available voice adapter
    const ttsAdapters = this.orderedAdapters(this.voice);
    if (ttsAdapters.length === 0) throw new Error('No TTS voice provider available.');

    let ttsBuffer: Buffer | null = null;
    let ttsDurationMs: number | undefined;
    let ttsExt = 'mp3';
    for (const adapter of ttsAdapters) {
      try {
        const media = await adapter.synthesize({
          text: narrationText,
          voiceId: spec?.sections?.[0]?.voiceId,
          speed: spec?.sections?.[0]?.speed,
        });
        ttsBuffer = media.buffer;
        ttsDurationMs = media.durationMs;
        ttsExt = media.ext;
        break;
      } catch {
        // try next adapter
      }
    }
    if (!ttsBuffer) throw new Error('TTS generation failed for all available adapters.');

    // 4. Apply pitch-style transfer
    const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'cf-vstyle-'));
    const ttsPath = path.join(tmpDir, `tts.${ttsExt}`);
    const styledPath = path.join(tmpDir, 'styled.mp3');
    try {
      await fsPromises.writeFile(ttsPath, ttsBuffer);
      await applyVoiceStyleTransfer(ttsPath, refStats, styledPath);
      const styledBuffer = await fsPromises.readFile(styledPath);

      // 5. Store as new VOICE asset
      const asset = await this.prisma.asset.create({
        data: { projectId, kind: 'VOICE', label: 'Narration (Voice Style Match)', status: 'GENERATING' },
      });
      const key = `assets/${projectId}/${asset.id}/v1/styled.mp3`;
      const { absPath, sizeBytes } = await this.storage.put(key, styledBuffer);
      const contentHash = createHash('sha256').update(styledBuffer).digest('hex');

      const version = await this.prisma.assetVersion.create({
        data: {
          assetId: asset.id,
          version: 1,
          r2Key: key,
          contentHash,
          provider: 'in-app-style-transfer',
          model: 'ffmpeg-pitch',
          prompt: { narrationText: narrationText.slice(0, 200), referenceVersionId } as never,
          params: { zcrRate: refStats.zcrRate, rmsDb: refStats.rmsDb } as never,
          provenance: {
            provider: 'in-app-style-transfer',
            model: 'ffmpeg-pitch',
            generatedAt: new Date().toISOString(),
            license: 'generated-in-app-royalty-free',
            notes: 'TTS narration pitch-matched to user voice reference via FFmpeg asetrate',
          } as never,
          sizeBytes: BigInt(sizeBytes),
          durationMs: ttsDurationMs ?? null,
          data: sizeBytes < 8 * 1024 * 1024 ? styledBuffer : undefined,
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
        provider: 'in-app-style-transfer',
        durationMs: ttsDurationMs,
        sizeBytes,
        cached: false,
        notes: 'Voice style matched to your recording using in-app pitch analysis (FFmpeg)',
      };
    } finally {
      await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
