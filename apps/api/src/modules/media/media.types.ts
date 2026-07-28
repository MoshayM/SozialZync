/**
 * Provider abstraction for media generation (update.txt: "Never hardcode AI
 * providers. Create adapters."). Business logic depends only on these
 * interfaces; concrete providers register in MediaService and are selected by
 * env config with automatic fallback to always-available offline adapters.
 */

export interface GeneratedMedia {
  buffer: Buffer;
  mimeType: string;
  ext: string;
  durationMs?: number;
  model: string;
  notes?: string;
}

export interface VoiceRequest {
  text: string;
  voiceId?: string;
  speed?: number;
  language?: string;
}

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed?: number;
}

export interface MusicRequest {
  mood: string;
  genre: string;
  bpm: number;
  energy: 'low' | 'medium' | 'high' | 'dynamic';
  durationSecs: number;
}

export interface SceneVideoRequest {
  imagePath?: string;
  prompt: string;
  durationSecs: number;
  width: number;
  height: number;
}

export interface MediaAdapter {
  readonly name: string;
  /** Cheap static check (keys/binaries present). Runtime errors still fall through to the next adapter. */
  available(): boolean;
}

export interface VoiceAdapter extends MediaAdapter {
  synthesize(req: VoiceRequest): Promise<GeneratedMedia>;
}

export interface ImageAdapter extends MediaAdapter {
  generateImage(req: ImageRequest): Promise<GeneratedMedia>;
}

export interface MusicAdapter extends MediaAdapter {
  compose(req: MusicRequest): Promise<GeneratedMedia>;
}

export interface VideoAdapter extends MediaAdapter {
  renderScene(req: SceneVideoRequest): Promise<GeneratedMedia>;
}

// ── Self-hosted video generation (ComfyUI SVD / WAN / CogVideo) ─────────────

export interface VideoRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fps?: number;
  referenceImageUrl?: string;    // for img2vid
  referenceImageBuffer?: Buffer; // alternative buffer
  seed?: number;
  model?: string;
  steps?: number;
  cfgScale?: number;
  motionScale?: number;          // SVD motion bucket
  style?: string;
}

export interface GeneratedVideo {
  buffer: Buffer;
  mimeType: 'video/mp4' | 'video/webm' | 'image/gif';
  width: number;
  height: number;
  durationSeconds: number;
  fps: number;
  provider: string;
  model: string;
  seed?: number;
  prompt: string;
}

export interface VideoGenerationAdapter {
  readonly name: string;
  available(): boolean;
  generate(req: VideoRequest): Promise<GeneratedVideo>;
}

// ── Self-hosted image generation (ComfyUI / A1111 / Forge / InvokeAI) ────────

export interface SelfHostedImageRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  model?: string;
  style?: string; // 'realistic' | 'anime' | 'cartoon' | 'illustration'
  referenceImageUrl?: string; // img2img base
  strength?: number; // img2img denoising strength 0-1
}

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  provider: string;
  model: string;
  seed?: number;
  prompt: string;
}

export interface SelfHostedImageAdapter {
  readonly name: string;
  available(): boolean;
  generate(req: SelfHostedImageRequest): Promise<GeneratedImage>;
}
