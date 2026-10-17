import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runFfmpeg } from './ffmpeg.util';
import type { VoiceEffect } from '../media.types';

const SAMPLE_RATE = 44100;

/**
 * Apply a professional voice effects chain to a TTS audio buffer using FFmpeg.
 *
 * Effects applied in order:
 *   1. Pitch shift (asetrate + aresample + atempo) — semitone-accurate, no tempo change
 *   2. Studio EQ — presence boost at 3kHz, mud cut at 200Hz, air shelf at 8kHz
 *   3. Room reverb — subtle studio room ambience via aecho
 *   4. Loudness normalise — broadcast standard (-16 LUFS, -1.5 TP)
 *
 * Returns the input buffer unchanged if no effects are requested.
 */
export async function applyVoiceEffects(
  inputBuffer: Buffer,
  opts: { pitch?: number; effects?: VoiceEffect[] },
): Promise<Buffer> {
  const { pitch = 0, effects = [] } = opts;
  const needsPitch = typeof pitch === 'number' && Math.abs(pitch) >= 0.5;
  const needsEffects = effects.length > 0;

  if (!needsPitch && !needsEffects) return inputBuffer;

  const tmpDir = os.tmpdir();
  const id = `vfx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inPath  = path.join(tmpDir, `${id}-in.mp3`);
  const outPath = path.join(tmpDir, `${id}-out.mp3`);

  await fs.writeFile(inPath, inputBuffer);
  try {
    const filters: string[] = [];

    // 1. Pitch shift (semitones)
    if (needsPitch) {
      const clampedPitch = Math.max(-12, Math.min(12, pitch));
      const rateMultiplier = Math.pow(2, clampedPitch / 12);
      // atempo must stay in [0.5, 2.0]; our ±12st range keeps it in [0.5, 2.0]
      const atempo = Math.min(2.0, Math.max(0.5, 1 / rateMultiplier));
      filters.push(
        `asetrate=${SAMPLE_RATE}*${rateMultiplier.toFixed(6)}`,
        `aresample=${SAMPLE_RATE}`,
        `atempo=${atempo.toFixed(6)}`,
      );
    }

    // 2. Studio EQ — presence lift, mud cut, air shelf
    if (effects.includes('studio-eq')) {
      filters.push(
        'equalizer=f=200:t=o:w=0.7:g=-2',    // cut muddy low-mids
        'equalizer=f=3000:t=o:w=1:g=3',       // lift presence / clarity
        'equalizer=f=8000:t=o:w=0.5:g=1.5',  // gentle air shelf
      );
    }

    // 3. Room reverb — subtle studio ambience
    if (effects.includes('room-reverb')) {
      filters.push('aecho=0.8:0.85:40|60:0.25|0.15');
    }

    // 4. Loudness normalisation — broadcast standard
    if (effects.includes('normalize')) {
      filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    }

    const filterChain = filters.join(',');
    await runFfmpeg([
      '-i', inPath,
      '-af', filterChain,
      '-ar', String(SAMPLE_RATE),
      '-b:a', '128k',
      '-y', outPath,
    ]);

    const result = await fs.readFile(outPath);
    return result;
  } finally {
    await Promise.all([fs.unlink(inPath).catch(() => undefined), fs.unlink(outPath).catch(() => undefined)]);
  }
}
