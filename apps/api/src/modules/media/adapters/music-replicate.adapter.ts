import type { MusicAdapter, MusicRequest, GeneratedMedia } from '../media.types';

const PREDICTIONS_URL = 'https://api.replicate.com/v1/models/meta/musicgen/predictions';
const MAX_DURATION_SECS = 30; // MusicGen model hard limit
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 90;

interface ReplicatePred {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string[] | null;
  error: string | null;
  urls: { get: string };
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Token ${process.env['REPLICATE_API_TOKEN'] ?? ''}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Music generation via Replicate + Meta MusicGen (stereo-large).
 * Activates when REPLICATE_API_TOKEN is set.
 * Env: REPLICATE_API_TOKEN
 */
export class ReplicateMusicAdapter implements MusicAdapter {
  readonly name = 'replicate-musicgen';

  available(): boolean {
    return !!process.env['REPLICATE_API_TOKEN'];
  }

  async compose(req: MusicRequest): Promise<GeneratedMedia> {
    const duration = Math.min(Math.max(req.durationSecs, 5), MAX_DURATION_SECS);
    const prompt = `${req.genre} instrumental music, ${req.mood} mood, ${req.bpm} BPM, background score, no vocals`;

    const startRes = await fetch(PREDICTIONS_URL, {
      method: 'POST',
      headers: { ...authHeaders(), Prefer: 'wait=5' },
      body: JSON.stringify({
        input: {
          prompt,
          duration,
          model_version: 'stereo-large',
          output_format: 'mp3',
          normalization_strategy: 'peak',
        },
      }),
    });

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Replicate start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    let pred = (await startRes.json()) as ReplicatePred;

    // Poll until done (Prefer: wait=5 may already have resolved it)
    for (let i = 0; i < MAX_POLLS && pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled'; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(pred.urls.get, { headers: authHeaders() });
      if (!pollRes.ok) throw new Error(`Replicate poll failed: ${pollRes.status}`);
      pred = (await pollRes.json()) as ReplicatePred;
    }

    if (pred.status !== 'succeeded' || !pred.output?.[0]) {
      throw new Error(`Replicate MusicGen failed: ${pred.error ?? pred.status}`);
    }

    const audioRes = await fetch(pred.output[0]);
    if (!audioRes.ok) throw new Error(`Replicate audio download failed: ${audioRes.status}`);

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    return {
      buffer,
      mimeType: 'audio/mpeg',
      ext: 'mp3',
      durationMs: Math.round(duration * 1000),
      model: 'meta/musicgen:stereo-large',
      notes: `prompt: "${prompt}"`,
    };
  }
}
