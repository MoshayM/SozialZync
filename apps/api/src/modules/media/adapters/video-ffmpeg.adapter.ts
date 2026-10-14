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
  // All motion uses sin/cos easing instead of linear interpolation: smoother
  // acceleration curves that feel more like real camera movement.
  const f = frames;

  switch (style) {
    case 'zoom-in':
      // Ease-out zoom: fast start, slows as it approaches 1.25×. Centered.
      return {
        scaleW: sw130, scaleH: sh130,
        filter: `zoompan=z='1.0+0.25*sin(PI/2*on/${f})':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${f}:s=${wh}:fps=${fps}`,
      };
    case 'zoom-out':
      // Ease-in zoom-out: starts at 1.25×, decelerates to 1.0×. Centered.
      return {
        scaleW: sw130, scaleH: sh130,
        filter: `zoompan=z='1.25-0.25*(1-cos(PI/2*on/${f}))':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${f}:s=${wh}:fps=${fps}`,
      };
    case 'pan-right':
      // Ease-out pan from left to right at constant 1.18× zoom.
      return {
        scaleW: sw125, scaleH: sh125,
        filter: `zoompan=z=1.18:x='(iw-iw/zoom)*sin(PI/2*on/${f})':d=${f}:s=${wh}:fps=${fps}`,
      };
    case 'pan-left':
      // Ease-in pan from right to left at constant 1.18× zoom.
      return {
        scaleW: sw125, scaleH: sh125,
        filter: `zoompan=z=1.18:x='(iw-iw/zoom)*(1-sin(PI/2*on/${f}))':d=${f}:s=${wh}:fps=${fps}`,
      };
    case 'drift':
      // Diagonal drift with a gentle breathing zoom (organic floating feel).
      return {
        scaleW: sw120, scaleH: sh120,
        filter: `zoompan=z='1.08+0.07*sin(PI*on/${f})':x='(iw-iw/zoom)*0.4*on/${f}':y='(ih-ih/zoom)*0.3*(1-cos(PI*on/${f}))':d=${f}:s=${wh}:fps=${fps}`,
      };
    case 'diagonal':
      // Diagonal push: ease-out zoom + rightward + downward pan together.
      return {
        scaleW: sw120, scaleH: sh120,
        filter: `zoompan=z='1.0+0.18*sin(PI/2*on/${f})':x='(iw-iw/zoom)*sin(PI/2*on/${f})':y='(ih-ih/zoom)*(1-cos(PI/2*on/${f}))':d=${f}:s=${wh}:fps=${fps}`,
      };
    case 'tilt-up':
      // Upward pan through the centre — camera tilts up while staying level.
      return {
        scaleW: sw120, scaleH: sh120,
        filter: `zoompan=z=1.18:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*(1-sin(PI/2*on/${f}))':d=${f}:s=${wh}:fps=${fps}`,
      };
    case 'tilt-down':
      // Downward pan through the centre — camera tilts down smoothly.
      return {
        scaleW: sw120, scaleH: sh120,
        filter: `zoompan=z=1.18:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*sin(PI/2*on/${f})':d=${f}:s=${wh}:fps=${fps}`,
      };
  }
}

// 8-step cycle: zoom, pan, tilt, and drift styles so consecutive scenes always look different.
const STYLE_CYCLE: SceneMotionStyle[] = ['zoom-in', 'pan-right', 'tilt-up', 'zoom-out', 'pan-left', 'tilt-down', 'drift', 'diagonal'];

function pickStyle(req: SceneVideoRequest): SceneMotionStyle {
  if (req.motionStyle) return req.motionStyle;
  const idx = req.sceneIndex ?? 0;
  return STYLE_CYCLE[idx % STYLE_CYCLE.length]!;
}

/**
 * Download an image from a URL into a temp file. Returns null on failure.
 * Used when imagePath is absent but imageUrl is available.
 */
async function downloadToTemp(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = url.includes('.png') ? '.png' : '.jpg';
    const tmp = path.join(os.tmpdir(), `cf-dl-${Date.now()}${ext}`);
    await fs.writeFile(tmp, buf);
    return tmp;
  } catch {
    return null;
  }
}

/**
 * Internal image-to-motion adapter using FFmpeg Ken Burns effects.
 *
 * Zero API cost — runs locally on the server via ffmpeg-static.
 * Always available as long as ffmpeg is present: if no source image is
 * available it falls back to a solid-color background so the whole Video
 * step never fails due to a missing still.
 *
 * Motion styles cycle per scene for natural variety.
 * Upgrade path: set VIDEO_PROVIDER=kling-ai|luma|runway for AI-generated motion.
 */
export class FfmpegSceneVideoAdapter implements VideoAdapter {
  readonly name = 'ffmpeg-kenburns';

  available(): boolean {
    return ffmpegPath() !== null;
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-scene-'));
    const outPath = path.join(dir, 'scene.mp4');
    const fps = 30;
    const frames = Math.max(1, Math.round(req.durationSecs * fps));
    const { width, height } = req;
    let tmpDownloaded: string | null = null;

    try {
      // Resolve source image: local path → URL download → solid-color fallback
      let imagePath = req.imagePath ?? null;
      if (!imagePath && req.imageUrl) {
        tmpDownloaded = await downloadToTemp(req.imageUrl);
        imagePath = tmpDownloaded;
      }

      if (imagePath) {
        // Ken Burns motion on the provided image
        const style = pickStyle(req);
        const { scaleW, scaleH, filter } = buildMotion(style, width, height, frames);
        await runFfmpeg([
          '-i', imagePath,
          '-filter_complex', `[0:v]scale=${scaleW}:${scaleH},${filter},setsar=1[v]`,
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
      }

      // No image available — generate a solid dark-gray placeholder video.
      // This keeps the pipeline alive: audio + subtitles will still render over it.
      await runFfmpeg([
        '-f', 'lavfi',
        '-i', `color=c=0x1a1a2e:size=${width}x${height}:rate=${fps}`,
        '-t', String(req.durationSecs),
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        outPath,
      ]);
      const buffer = await fs.readFile(outPath);
      return {
        buffer,
        mimeType: 'video/mp4',
        ext: 'mp4',
        durationMs: Math.round(req.durationSecs * 1000),
        model: 'ffmpeg-placeholder',
        notes: 'No scene image available — solid-color placeholder. Re-run Images step to get motion video.',
      };
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      if (tmpDownloaded) await fs.rm(tmpDownloaded, { force: true }).catch(() => undefined);
    }
  }
}
