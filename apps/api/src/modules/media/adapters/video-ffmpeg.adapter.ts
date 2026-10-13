import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { VideoAdapter, SceneVideoRequest, GeneratedMedia, SceneMotionStyle } from '../media.types';
import { ffmpegPath, runFfmpeg } from './ffmpeg.util';

// ── Motion style implementations ─────────────────────────────────────────────
// Each variant scales the image larger than the output frame so zoompan has
// room to move without hitting the edge. scaleW/scaleH = scale-up factor.
type MotionParams = { scaleW: number; scaleH: number; filter: string };

function buildMotion(style: SceneMotionStyle, width: number, height: number, frames: number): MotionParams {
  const fps = 30;
  const sw130 = Math.round(width * 1.3);
  const sh130 = Math.round(height * 1.3);
  const sw125 = Math.round(width * 1.25);
  const sh125 = Math.round(height * 1.25);
  const sw120 = Math.round(width * 1.2);
  const sh120 = Math.round(height * 1.2);
  const wh = `${width}x${height}`;

  switch (style) {
    case 'zoom-in':
      return {
        scaleW: sw130, scaleH: sh130,
        filter: `zoompan=z='min(zoom+0.0008,1.25)':d=${frames}:s=${wh}:fps=${fps}`,
      };
    case 'zoom-out':
      return {
        scaleW: sw130, scaleH: sh130,
        filter: `zoompan=z='max(1.25-0.0015*(on-1),1.0)':d=${frames}:s=${wh}:fps=${fps}`,
      };
    case 'pan-right':
      return {
        scaleW: sw125, scaleH: sh125,
        filter: `zoompan=z=1.15:x='(iw-iw/zoom)*on/${frames}':d=${frames}:s=${wh}:fps=${fps}`,
      };
    case 'pan-left':
      return {
        scaleW: sw125, scaleH: sh125,
        filter: `zoompan=z=1.15:x='(iw-iw/zoom)*(1-on/${frames})':d=${frames}:s=${wh}:fps=${fps}`,
      };
    case 'drift':
      return {
        scaleW: sw120, scaleH: sh120,
        filter: `zoompan=z='min(zoom+0.0004,1.15)':x='iw*0.002*on/${frames}':y='ih*0.001*on/${frames}':d=${frames}:s=${wh}:fps=${fps}`,
      };
    case 'diagonal':
      return {
        scaleW: sw120, scaleH: sh120,
        filter: `zoompan=z='min(zoom+0.0005,1.15)':x='iw*0.015*on/${frames}':y='ih*0.01*on/${frames}':d=${frames}:s=${wh}:fps=${fps}`,
      };
  }
}

// Cycle order: varied enough to feel different, deterministic by scene index.
const STYLE_CYCLE: SceneMotionStyle[] = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left', 'drift', 'diagonal'];

function pickStyle(req: SceneVideoRequest): SceneMotionStyle {
  if (req.motionStyle) return req.motionStyle;
  const idx = req.sceneIndex ?? 0;
  return STYLE_CYCLE[idx % STYLE_CYCLE.length]!;
}

/**
 * Internal image-to-motion adapter using FFmpeg Ken Burns effects.
 * Zero API cost — runs locally on the server. Supports 6 motion styles cycled
 * per scene for naturalistic variety. Default adapter when no cloud video
 * provider is configured; upgrade path: set VIDEO_PROVIDER=kling-ai|luma|runway.
 */
export class FfmpegSceneVideoAdapter implements VideoAdapter {
  readonly name = 'ffmpeg-kenburns';

  available(): boolean {
    return ffmpegPath() !== null;
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    if (!req.imagePath) throw new Error('ffmpeg scene adapter requires a local source image (imagePath)');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-scene-'));
    const outPath = path.join(dir, 'scene.mp4');
    const fps = 30;
    const frames = Math.max(1, Math.round(req.durationSecs * fps));
    const style = pickStyle(req);
    const { scaleW, scaleH, filter } = buildMotion(style, req.width, req.height, frames);

    try {
      await runFfmpeg([
        '-i', req.imagePath,
        '-filter_complex',
        `[0:v]scale=${scaleW}:${scaleH},${filter},setsar=1[v]`,
        '-map', '[v]',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        outPath,
      ]);
      const buffer = await fs.readFile(outPath);
      return {
        buffer,
        mimeType: 'video/mp4',
        ext: 'mp4',
        durationMs: Math.round(req.durationSecs * 1000),
        model: `ffmpeg-${style}`,
        notes: `Internal motion (${style}). Set VIDEO_PROVIDER=kling-ai for AI-generated motion.`,
      };
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
