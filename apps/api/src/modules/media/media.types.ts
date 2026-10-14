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
  /** Estimated provider cost for this generation in USD. 0 for free/internal. */
  costUsd?: number;
}

export interface VoiceRequest {
  text: string;
  voiceId?: string;
  speed?: number;
  language?: string;
}

export type ImageVisualStyle =
  | 'ai-best'
  // Realistic & Cinematic
  | 'realistic' | 'hyper-realistic' | 'cinematic' | 'documentary' | 'commercial'
  // Animation & 3D
  | '3d-animation' | 'cartoon' | 'anime' | 'claymation' | 'low-poly' | 'pixel-art'
  // Artistic & Illustrated
  | 'watercolor' | 'oil-painting' | 'sketch' | 'storybook' | 'paper-cutout' | 'comic-book'
  // Stylized & Creative
  | 'cyberpunk' | 'neon-synthwave' | 'vintage-retro' | 'black-white-noir' | 'surreal' | 'minimalist' | 'text-carousel'
  // Legacy aliases kept for backward compatibility
  | 'animation' | 'minimal';

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed?: number;
  /** Visual style preference from the user's pre-generate style picker */
  style?: ImageVisualStyle;
  /**
   * Cost/quality trade-off tier (default: 'standard').
   *  fast     — free providers only (Pollinations), lowest cost, ~768×432
   *  standard — free providers first, cheap paid fallback, ~1024×576
   *  high     — best paid provider (DALL-E 3 / Imagen 3), ~1280×720
   */
  quality?: 'fast' | 'standard' | 'high';
}

export interface MusicRequest {
  mood: string;
  genre: string;
  bpm: number;
  energy: 'low' | 'medium' | 'high' | 'dynamic';
  durationSecs: number;
  prompt?: string;
  emotionalArc?: string;
  /** Song mode: AI generates a vocal track instead of instrumental background music */
  songMode?: boolean;
  lyrics?: string;
  songStyle?: string;
  vocalType?: string;
}

export type SceneMotionStyle = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'drift' | 'diagonal';

export interface SceneVideoRequest {
  /** Local filesystem path — used by FFmpeg/ComfyUI (self-hosted) adapters */
  imagePath?: string;
  /** Public HTTPS URL — used by cloud adapters (Kling, Runway, Luma, Pika) */
  imageUrl?: string;
  prompt: string;
  durationSecs: number;
  width: number;
  height: number;
  /** 0-based position in the scene list — internal adapters use this to vary motion per scene. */
  sceneIndex?: number;
  /** Explicit motion style override; internal adapters cycle styles when omitted. */
  motionStyle?: SceneMotionStyle;
  /**
   * Cost/quality tier (default: 'fast').
   *  fast     — FFmpeg Ken Burns only, zero API cost, always available
   *  cinematic — AI video providers (Kling/Luma/Runway) with FFmpeg fallback
   */
  quality?: 'fast' | 'cinematic';
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
