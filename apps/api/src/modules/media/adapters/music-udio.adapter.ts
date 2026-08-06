import type { MusicAdapter, MusicRequest, GeneratedMedia } from '../media.types';

const BASE_URL = 'https://api.piapi.ai/api/udio/v1';
const POLL_INTERVAL_MS = 6000;
const MAX_POLLS = 80;

type UdioStatus = 'pending' | 'processing' | 'queued' | 'succeed' | 'failed' | 'canceled';

interface UdioTask {
  task_id: string;
  status?: UdioStatus;
  output?: {
    songs?: Array<{ song_path?: string; duration?: number }>;
    audio_url?: string;
  };
  error?: { message?: string };
}

interface UdioResponse {
  code: number;
  message?: string;
  data: UdioTask;
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
    low:     'ambient, peaceful, soft',
    medium:  'moderate, flowing, smooth',
    high:    'energetic, punchy, dynamic',
    dynamic: 'cinematic, sweeping, evolving',
  };
  return `${req.genre} ${req.mood} instrumental music, ${energyWords[req.energy]}, ${req.bpm} BPM, no lyrics, background track`;
}

/**
 * Music generation via Udio through PiAPI (api.piapi.ai/api/udio).
 * Shares PIAPI_API_KEY with the Kling and Suno adapters.
 * Env: PIAPI_API_KEY
 */
export class UdioMusicAdapter implements MusicAdapter {
  readonly name = 'udio-piapi';

  available(): boolean {
    return !!process.env['PIAPI_API_KEY'];
  }

  async compose(req: MusicRequest): Promise<GeneratedMedia> {
    const duration = Math.min(Math.max(req.durationSecs, 15), 120);
    const prompt = buildPrompt(req);

    const startRes = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      headers: piHeaders(),
      body: JSON.stringify({
        prompt,
        audio_length: duration,
        make_instrumental: true,
      }),
    });

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Udio/PiAPI start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    const startData = (await startRes.json()) as UdioResponse;
    if (startData.code !== 200 && startData.code !== 0) {
      throw new Error(`Udio/PiAPI error: ${startData.message ?? startData.code}`);
    }

    const taskId = startData.data.task_id;
    let task = startData.data;

    for (
      let i = 0;
      i < MAX_POLLS && task.status !== 'succeed' && task.status !== 'failed' && task.status !== 'canceled';
      i++
    ) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${BASE_URL}/fetch`, {
        method: 'POST',
        headers: piHeaders(),
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!pollRes.ok) throw new Error(`Udio/PiAPI poll failed: ${pollRes.status}`);
      const pollData = (await pollRes.json()) as UdioResponse;
      task = pollData.data;
    }

    const audioUrl =
      task.output?.songs?.[0]?.song_path ??
      task.output?.audio_url;

    if (task.status !== 'succeed' || !audioUrl) {
      throw new Error(`Udio/PiAPI failed: ${task.error?.message ?? task.status}`);
    }

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Udio download failed: ${audioRes.status}`);

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    return {
      buffer,
      mimeType: 'audio/mpeg',
      ext: 'mp3',
      durationMs: duration * 1000,
      model: 'udio-piapi',
      notes: `prompt: "${prompt}"`,
    };
  }
}
