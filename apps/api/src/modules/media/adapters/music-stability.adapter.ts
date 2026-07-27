import type { MusicAdapter, MusicRequest, GeneratedMedia } from '../media.types';

const API_URL = 'https://api.stability.ai/v2beta/audio/stable-audio-open-1.0/generate';
const MAX_DURATION_SECS = 180;

const ENERGY_WORDS: Record<MusicRequest['energy'], string> = {
  low:     'calm, gentle, soft, peaceful',
  medium:  'flowing, relaxed, moderate, steady',
  high:    'energetic, upbeat, driving, powerful',
  dynamic: 'cinematic, building, epic, evolving',
};

function buildPrompt(req: MusicRequest): string {
  const energy = ENERGY_WORDS[req.energy];
  return `${req.genre} instrumental background music, ${req.mood} mood, ${energy}, ${req.bpm} BPM, no vocals, royalty-free`;
}

/**
 * Music generation via Stability AI Stable Audio (stable-audio-open-1.0).
 * Activates when STABILITY_API_KEY is set. Returns binary MP3.
 * Env: STABILITY_API_KEY
 */
export class StabilityMusicAdapter implements MusicAdapter {
  readonly name = 'stability-audio';

  available(): boolean {
    return !!process.env['STABILITY_API_KEY'];
  }

  async compose(req: MusicRequest): Promise<GeneratedMedia> {
    const duration = Math.min(Math.max(req.durationSecs, 5), MAX_DURATION_SECS);
    const prompt = buildPrompt(req);

    const form = new FormData();
    form.append('prompt', prompt);
    form.append('output_format', 'mp3');
    form.append('duration', String(duration));
    form.append('steps', '35');

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env['STABILITY_API_KEY'] ?? ''}`,
        Accept: 'audio/mpeg',
      },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Stability Audio failed: ${res.status} ${text.slice(0, 200)}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      buffer,
      mimeType: 'audio/mpeg',
      ext: 'mp3',
      durationMs: Math.round(duration * 1000),
      model: 'stable-audio-open-1.0',
      notes: `prompt: "${prompt}"`,
    };
  }
}
