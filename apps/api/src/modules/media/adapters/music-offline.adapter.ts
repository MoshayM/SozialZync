import type { MusicAdapter, MusicRequest, GeneratedMedia } from '../media.types';
import { encodeWav } from './codec.util';

const SAMPLE_RATE = 44100;
const TWO_PI = 2 * Math.PI;

// Root frequency for each musical key (Hz, middle-low octave for warmth)
const KEY_HZ: Record<string, number> = {
  C: 261.63, D: 293.66, E: 329.63, F: 349.23,
  G: 196.00, A: 220.00, B: 246.94, Bb: 233.08, Eb: 311.13,
};

// Mood → root frequency: bright/major for happy moods, darker roots for emotional/tense
function moodRootHz(mood: string): number {
  const m = mood.toLowerCase();
  if (/happy|upbeat|cheerful|fun|excited|celebrat/.test(m)) return KEY_HZ['C']!;
  if (/energetic|driving|hype|motivat|uplift/.test(m))       return KEY_HZ['D']!;
  if (/epic|powerful|dramatic|cinematic|grand|triumph/.test(m)) return KEY_HZ['G']!;
  if (/inspir|aspir|hopeful/.test(m))                        return KEY_HZ['E']!;
  if (/emotional|sad|melanchol|nostalgi|longing/.test(m))    return KEY_HZ['A']!;
  if (/calm|peaceful|gentle|relaxed|chill|mellow/.test(m))   return KEY_HZ['F']!;
  if (/dark|tense|suspens|eerie|mysteriou/.test(m))          return KEY_HZ['Bb']!;
  if (/romantic|warm|intimate|tender/.test(m))               return KEY_HZ['Eb']!;
  return KEY_HZ['C']!;
}

// Chord progressions: semitone intervals from root per chord step
// Four chords per loop — standard progressions for each genre
const GENRE_PROGRESSIONS: Record<string, number[][]> = {
  pop:        [[0,4,7], [7,11,14], [9,12,16], [5,9,12]],        // I  V  vi IV
  electronic: [[0,3,7], [10,14,17], [8,12,15], [10,14,17]],     // i  VII VI VII (minor)
  cinematic:  [[0,4,7], [9,13,16], [5,9,12], [7,11,14]],        // I  vi  IV V
  lofi:       [[9,12,16], [5,9,12], [0,4,7], [2,5,9]],          // vi IV  I  ii  (minor)
  jazz:       [[0,4,7,11], [7,11,14,17], [5,9,12,16], [2,5,9,12]], // Imaj7 V7 IVmaj7 ii7
  ambient:    [[0,4,7], [5,9,12], [0,4,7], [7,11,14]],          // I  IV  I  V   (sparse)
  classical:  [[0,4,7], [7,11,14], [5,9,12], [0,4,7]],          // I  V   IV I
  rock:       [[0,4,7], [7,11,14], [10,14,17], [5,9,12]],       // I  V   VII IV
  'hip-hop':  [[9,12,16], [5,9,12], [0,4,7], [2,5,9]],          // vi IV  I  ii  (same as lofi)
};

function semToHz(rootHz: number, semitones: number): number {
  return rootHz * Math.pow(2, semitones / 12);
}

function sine(f: number, t: number): number {
  return Math.sin(TWO_PI * f * t);
}

// Bandlimited soft-sawtooth — warmer, string/synth-pad character
function softSaw(f: number, t: number): number {
  return (
    Math.sin(TWO_PI * f * t) +
    Math.sin(TWO_PI * f * 2 * t) * 0.42 +
    Math.sin(TWO_PI * f * 3 * t) * 0.22 +
    Math.sin(TWO_PI * f * 4 * t) * 0.12
  ) / 1.76;
}

const ENERGY_GAIN: Record<MusicRequest['energy'], number> = {
  low: 0.07, medium: 0.10, high: 0.13, dynamic: 0.11,
};

/**
 * In-app music synthesis — the DEFAULT music generator for SozialZynk.
 *
 * Produces original, royalty-free background tracks entirely in-process from
 * the Music Brief parameters (genre, mood, BPM, energy, duration).
 *
 * Four synthesis layers — each active layer determined by energy level:
 *   1. Chord pad   — bandlimited soft-saw for all energy levels
 *   2. Bass line   — sine-wave root + 5th, one octave below (all levels)
 *   3. Arpeggio    — pluck-envelope melody above the pad (medium / high / dynamic)
 *   4. Rhythm kick — frequency-descending pulse at each beat (high / dynamic)
 *
 * Suno / Udio / Replicate / MusicGen remain available as optional external
 * providers — set MUSIC_PROVIDER=<name> to activate one of them.
 */
export class OfflineMusicAdapter implements MusicAdapter {
  readonly name = 'internal-music-synth';

  available(): boolean {
    return true;
  }

  compose(req: MusicRequest): Promise<GeneratedMedia> {
    const durationSecs = Math.min(Math.max(req.durationSecs, 10), 1200);
    const totalSamples = Math.round(durationSecs * SAMPLE_RATE);
    const samples = new Float32Array(totalSamples);

    // Root frequency — derived from mood
    const root = moodRootHz(req.mood ?? 'upbeat');

    // Chord progression — derived from genre
    const genre = (req.genre ?? '').toLowerCase();
    const progKey = Object.keys(GENRE_PROGRESSIONS).find((k) => genre.includes(k)) ?? 'pop';
    const progression = GENRE_PROGRESSIONS[progKey]!;

    // Timing
    const bpm = Math.max(40, Math.min(200, req.bpm));
    const barSecs  = (60 / bpm) * 4; // 4 beats per bar
    const beatSecs = 60 / bpm;

    const gain       = ENERGY_GAIN[req.energy] ?? 0.10;
    const fadeSamples  = Math.round(2.5 * SAMPLE_RATE);
    const buildSamples = Math.round(totalSamples / 3); // for 'dynamic' build-up

    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;

      // Which chord
      const chordIdx = Math.floor(t / barSecs) % progression.length;
      const chord    = progression[chordIdx]!;

      // Amplitude envelope: fade in + fade out
      let env = Math.min(1, i / fadeSamples, (totalSamples - i) / fadeSamples);
      // Dynamic energy: gradually build intensity over first third of track
      if (req.energy === 'dynamic') env *= 0.3 + 0.7 * Math.min(1, i / buildSamples);

      // Slow tremolo for organic, non-static feel (≈0.35 Hz)
      const tremolo = 0.87 + 0.13 * sine(0.35, t);

      let s = 0;

      // ── Layer 1: Chord pad (softSaw = warm, analogue string / synth character) ─
      for (const sem of chord) {
        s += softSaw(semToHz(root, sem), t) * 0.5;
      }
      s /= Math.max(1, chord.length);

      // ── Layer 2: Bass (root + 5th, one octave below, sine = deep and clean) ────
      const bassRoot  = semToHz(root * 0.5, chord[0] ?? 0);
      const bassFifth = semToHz(root * 0.5, (chord[0] ?? 0) + 7);
      s += sine(bassRoot, t)  * 0.50;
      s += sine(bassFifth, t) * 0.14;

      // ── Layer 3: Arpeggio melody (medium / high / dynamic only) ─────────────────
      if (req.energy !== 'low') {
        // 8th notes for high, quarter notes for medium
        const arpRate = (req.energy === 'high' || req.energy === 'dynamic')
          ? beatSecs / 2 : beatSecs;
        const arpIdx  = Math.floor(t / arpRate) % Math.max(1, chord.length);
        const arpHz   = semToHz(root * 2, chord[arpIdx] ?? 0); // one octave above pad
        // Pluck-like attack + decay per note so it sounds melodic, not blurred
        const notePhase = (t % arpRate) / arpRate;
        const noteEnv   = Math.exp(-notePhase * 6) * 0.75 + 0.25 * (1 - notePhase);
        const arpGain   = req.energy === 'medium' ? 0.07 : 0.11;
        s += sine(arpHz, t) * arpGain * noteEnv;
      }

      // ── Layer 4: Rhythm kick pulse (high / dynamic only) ────────────────────────
      if (req.energy === 'high' || req.energy === 'dynamic') {
        const beatPhase = t % beatSecs;
        if (beatPhase < 0.09) {
          // Frequency-descending kick: 120 Hz → 55 Hz over 90 ms with fast decay
          const kickHz  = 55 + 65 * Math.exp(-beatPhase * 45);
          const kickAmp = Math.exp(-beatPhase * 28);
          s += sine(kickHz, t) * 0.30 * kickAmp;
        }
      }

      // Soft clip via tanh to prevent inter-layer distortion, then apply envelope
      samples[i] = gain * env * tremolo * Math.tanh(s * 0.9);
    }

    return Promise.resolve({
      buffer: encodeWav(samples, SAMPLE_RATE),
      mimeType: 'audio/wav',
      ext: 'wav',
      durationMs: Math.round(durationSecs * 1000),
      model: 'internal-music-synth-v2',
      notes: `In-app: ${progKey} · ${req.mood} · ${bpm} BPM · ${req.energy}. Original, royalty-free.`,
    });
  }
}
