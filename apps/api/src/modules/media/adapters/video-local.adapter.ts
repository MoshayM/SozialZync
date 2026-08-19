import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { VideoGenerationAdapter, VideoRequest, GeneratedVideo } from '../media.types';
import { ffmpegPath, runFfmpeg } from './ffmpeg.util';

const STYLES = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'drift'] as const;
type MotionStyle = typeof STYLES[number];

function pickStyle(req: VideoRequest): MotionStyle {
  if (req.style && STYLES.includes(req.style as MotionStyle)) return req.style as MotionStyle;
  return STYLES[(req.seed ?? 0) % STYLES.length];
}

function zoompanFilter(style: MotionStyle, width: number, height: number, frames: number, fps: number): { scaleW: number; scaleH: number; filter: string } {
  const sw = Math.round(width * 1.3);
  const sh = Math.round(height * 1.3);
  const sw25 = Math.round(width * 1.25);
  const sh25 = Math.round(height * 1.25);
  const sw20 = Math.round(width * 1.2);
  const sh20 = Math.round(height * 1.2);

  switch (style) {
    case 'zoom-in':
      return {
        scaleW: sw, scaleH: sh,
        filter: `zoompan=z='min(zoom+0.0008,1.25)':d=${frames}:s=${width}x${height}:fps=${fps}`,
      };
    case 'zoom-out':
      return {
        scaleW: sw, scaleH: sh,
        filter: `zoompan=z='max(1.25-0.0015*(on-1),1.0)':d=${frames}:s=${width}x${height}:fps=${fps}`,
      };
    case 'pan-left':
      return {
        scaleW: sw25, scaleH: sh25,
        filter: `zoompan=z=1.15:x='(iw-iw/zoom)*(1-on/${frames})':d=${frames}:s=${width}x${height}:fps=${fps}`,
      };
    case 'pan-right':
      return {
        scaleW: sw25, scaleH: sh25,
        filter: `zoompan=z=1.15:x='(iw-iw/zoom)*on/${frames}':d=${frames}:s=${width}x${height}:fps=${fps}`,
      };
    case 'drift':
      return {
        scaleW: sw20, scaleH: sh20,
        filter: `zoompan=z='min(zoom+0.0004,1.15)':x='iw*0.002*on/${frames}':y='ih*0.001*on/${frames}':d=${frames}:s=${width}x${height}:fps=${fps}`,
      };
  }
}

function escapeDrawtext(text: string): string {
  return text
    .slice(0, 100)
    .replace(/'/g, "’")   // replace straight quote with curly to avoid filter parse issues
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Local ffmpeg video generator. Always available when ffmpeg is on PATH.
 * Renders image-to-video (Ken Burns motion) or text-to-video (title card).
 * Zero API cost.
 */
export class LocalFfmpegVideoAdapter implements VideoGenerationAdapter {
  readonly name = 'ffmpeg-local';

  available(): boolean {
    return ffmpegPath() !== null;
  }

  async generate(req: VideoRequest): Promise<GeneratedVideo> {
    const width = req.width ?? 1280;
    const height = req.height ?? 720;
    const fps = req.fps ?? 30;
    const durationSeconds = req.durationSeconds ?? 5;
    const style = pickStyle(req);

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-local-vid-'));
    const outPath = path.join(dir, 'output.mp4');

    try {
      if (req.referenceImageUrl || req.referenceImageBuffer) {
        await this._renderImageToVideo(req, dir, outPath, width, height, fps, durationSeconds, style);
      } else {
        await this._renderTitleCard(req, outPath, width, height, fps, durationSeconds);
      }

      const buffer = await fs.readFile(outPath);
      return {
        buffer,
        mimeType: 'video/mp4',
        width,
        height,
        durationSeconds,
        fps,
        provider: this.name,
        model: `ffmpeg-${style}`,
        seed: req.seed,
        prompt: req.prompt,
      };
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async _renderImageToVideo(
    req: VideoRequest,
    dir: string,
    outPath: string,
    width: number,
    height: number,
    fps: number,
    durationSeconds: number,
    style: MotionStyle,
  ): Promise<void> {
    let imgPath: string;

    if (req.referenceImageBuffer) {
      imgPath = path.join(dir, 'input.jpg');
      await fs.writeFile(imgPath, req.referenceImageBuffer);
    } else {
      const res = await fetch(req.referenceImageUrl!);
      if (!res.ok) throw new Error(`Failed to download reference image: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      imgPath = path.join(dir, 'input.jpg');
      await fs.writeFile(imgPath, buf);
    }

    const frames = Math.max(1, Math.round(durationSeconds * fps));
    const { scaleW, scaleH, filter } = zoompanFilter(style, width, height, frames, fps);

    await runFfmpeg([
      '-i', imgPath,
      '-filter_complex',
      `[0:v]scale=${scaleW}:${scaleH},${filter},setsar=1[v]`,
      '-map', '[v]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      outPath,
    ]);
  }

  private async _renderTitleCard(
    req: VideoRequest,
    outPath: string,
    width: number,
    height: number,
    fps: number,
    durationSeconds: number,
  ): Promise<void> {
    const colorSrc = `color=c=0x1e1b4b:size=${width}x${height}:rate=${fps}:duration=${durationSeconds}`;
    const fontSize = Math.max(18, Math.round(width / 28));
    const escapedText = escapeDrawtext(req.prompt);
    const fontFile = process.env['FFMPEG_FONT_PATH'];
    const fontArg = fontFile ? `fontfile=${fontFile}:` : '';
    const drawtextFilter = `drawtext=${fontArg}text='${escapedText}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=(h-text_h)/2:borderw=2:bordercolor=0x00000088`;

    try {
      await runFfmpeg([
        '-f', 'lavfi', '-i', colorSrc,
        '-vf', drawtextFilter,
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        outPath,
      ]);
    } catch {
      // Font not available — fall back to plain coloured background
      await runFfmpeg([
        '-f', 'lavfi', '-i', colorSrc,
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        outPath,
      ]);
    }
  }
}
