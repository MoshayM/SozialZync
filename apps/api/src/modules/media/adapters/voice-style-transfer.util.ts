import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { runFfmpeg } from './ffmpeg.util';

export interface VoiceCharacteristics {
  zcrRate: number;   // zero-crossing rate — proxy for pitch height
  rmsDb: number;     // mean volume in dBFS
  durationMs: number;
}

/**
 * Analyze a reference voice sample using FFmpeg astats.
 * Zero-crossing rate is used as a pitch-height proxy:
 *   higher ZCR ≈ higher-pitched (female-range) voice
 *   lower  ZCR ≈ lower-pitched  (male-range)   voice
 */
export function analyzeReferenceVoice(audioPath: string): Promise<VoiceCharacteristics> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', [
      '-i', audioPath,
      '-af', 'astats',
      '-f', 'null', '-',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let out = '';
    proc.stderr.on('data', (d: Buffer) => { out += d.toString(); });
    proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });

    proc.on('close', () => {
      const zcrMatch = out.match(/Zero_crossings_rate[:\s]+([\d.]+)/i);
      const rmsMatch = out.match(/RMS level dB[:\s]+([-\d.]+)/i);
      const durMatch = out.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);

      const zcrRate   = zcrMatch ? parseFloat(zcrMatch[1]) : 0.015;
      const rmsDb     = rmsMatch ? parseFloat(rmsMatch[1]) : -20;
      let durationMs  = 5000;
      if (durMatch) {
        durationMs =
          (parseInt(durMatch[1]) * 3600 +
           parseInt(durMatch[2]) * 60 +
           parseFloat(durMatch[3])) * 1000;
      }
      resolve({ zcrRate, rmsDb, durationMs });
    });

    proc.on('error', () => resolve({ zcrRate: 0.015, rmsDb: -20, durationMs: 5000 }));
  });
}

/**
 * Apply pitch-shift style transfer so the TTS narration loosely matches the
 * pitch range of the reference voice. Uses FFmpeg's asetrate+aresample trick
 * (no external plugins required).
 *
 *   pitchRatio > 1 → raise pitch (female-range reference)
 *   pitchRatio < 1 → lower pitch (male-range reference)
 *   pitchRatio = 1 → copy unchanged
 *
 * atempo is the reciprocal of pitchRatio to restore natural duration.
 */
export async function applyVoiceStyleTransfer(
  narrationPath: string,
  ref: VoiceCharacteristics,
  outPath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  let pitchRatio = 1.0;
  if (ref.zcrRate > 0.018) pitchRatio = 1.12;       // higher-pitched reference
  else if (ref.zcrRate < 0.010) pitchRatio = 0.90;  // lower-pitched reference

  if (Math.abs(pitchRatio - 1.0) < 0.02) {
    await fs.copyFile(narrationPath, outPath);
    return;
  }

  // atempo must stay in [0.5, 2.0] — clamped to be safe
  const atempo = Math.min(2.0, Math.max(0.5, 1 / pitchRatio));

  await runFfmpeg([
    '-i', narrationPath,
    '-af', `asetrate=44100*${pitchRatio.toFixed(4)},aresample=44100,atempo=${atempo.toFixed(4)}`,
    '-c:a', 'libmp3lame', '-b:a', '128k',
    outPath,
  ]);
}
