import type { MusicAdapter, MusicRequest, GeneratedMedia } from '../media.types';

const BASE_URL = 'https://api.piapi.ai/api/suno/v1';
const POLL_INTERVAL_MS = 6000;
const MAX_POLLS = 80;

type SunoStatus = 'pending' | 'processing' | 'queued' | 'succeed' | 'failed' | 'canceled';

interface SunoTask {
  task_id: string;
  status?: SunoStatus;
  output?: {
    clips?: Array<{ audio_url?: string; duration?: number }>;
    audio_url?: string;
  };
  error?: { message?: string };
}

interface SunoResponse {
  code: number;
  message?: string;
  data: SunoTask;
}

function piHeaders(): Record<string, string> {
  return {
    'X-API-Key': process.env['PIAPI_API_KEY'] ?? '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function buildPrompt(req: MusicRequest): string {
  const energyWords: Record<MusicRequest['energy'], string> = {
    low:     'calm, soft, gentle',
    medium:  'moderate, flowing, relaxed',
    high:    'energetic, upbeat, driving',
    dynamic: 'cinematic, epic, building',
  };
  return `${req.genre} ${req.mood} background music, ${energyWords[req.energy]}, ${req.bpm} BPM, no vocals, instrumental`;
}

/**
 * Music generation via Suno v4.5 through PiAPI (api.piapi.ai/api/suno).
 * Shares PIAPI_API_KEY with the Kling video adapter.
 * Env: PIAPI_API_KEY
 */
export class SunoMusicAdapter implements MusicAdapter {
  readonly name = 'suno-v4-piapi';

  available(): boolean {
    return !!process.env['PIAPI_API_KEY'];
  }

  async compose(req: MusicRequest): Promise<GeneratedMedia> {
    const duration = Math.min(Math.max(req.durationSecs, 15), 120);
    const prompt = buildPrompt(req);

    const startRes = await fetch(`${BASE_URL}/music`, {
      method: 'POST',
      headers: piHeaders(),
      body: JSON.stringify({
        prompt,
        model: 'chirp-v4-5',
        audio_duration: duration,
        make_instrumental: true,
        mv: 'chirp-v4-5',
      }),
    });

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Suno/PiAPI start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    const startData = (await startRes.json()) as SunoResponse;
    if (startData.code !== 200 && startData.code !== 0) {
      throw new Error(`Suno/PiAPI error: ${startData.message ?? startData.code}`);
    }

    const taskId = startData.data.task_id;
    let task = startData.data;

    for (
      let i = 0;
      i < MAX_POLLS && task.status !== 'succeed' && task.status !== 'failed' && task.status !== 'canceled';
      i++
    ) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${BASE_URL}/music/${taskId}`, { headers: piHeaders() });
      if (!pollRes.ok) throw new Error(`Suno/PiAPI poll failed: ${pollRes.status}`);
      const pollData = (await pollRes.json()) as SunoResponse;
      task = pollData.data;
    }

    const audioUrl =
      task.output?.clips?.[0]?.audio_url ??
      task.output?.audio_url;

    if (task.status !== 'succeed' || !audioUrl) {
      throw new Error(`Suno/PiAPI failed: ${task.error?.message ?? task.status}`);
    }

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Suno download failed: ${audioRes.status}`);

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    return {
      buffer,
      mimeType: 'audio/mpeg',
      ext: 'mp3',
      durationMs: duration * 1000,
      model: 'suno-chirp-v4-5',
      notes: `prompt: "${prompt}"`,
    };
  }
}
