import type { MusicAdapter, MusicRequest, GeneratedMedia } from '../media.types';

const BASE_URL = process.env['MUSICGEN_URL'] ?? 'http://localhost:7861';
const MAX_DURATION_SECS = 30;
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 120;

/**
 * Local MusicGen via a self-hosted AudioCraft API server.
 * Compatible with: github.com/GrandaddyShmax/audiocraft_plus (Gradio port 7861)
 * or any FastAPI wrapper that accepts POST /generate with prompt+duration.
 * Activates when MUSICGEN_URL is set.
 * Env: MUSICGEN_URL
 */
export class MusicGenLocalAdapter implements MusicAdapter {
  readonly name = 'musicgen-local';

  available(): boolean {
    return !!process.env['MUSICGEN_URL'];
  }

  async compose(req: MusicRequest): Promise<GeneratedMedia> {
    const duration = Math.min(Math.max(req.durationSecs, 5), MAX_DURATION_SECS);
    const prompt = `${req.genre} instrumental music, ${req.mood} mood, ${req.bpm} BPM, background score, no lyrics, no vocals`;

    const body = JSON.stringify({ prompt, duration, output_format: 'mp3' });
    const res = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(240_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MusicGen local failed: ${res.status} ${text.slice(0, 200)}`);
    }

    const contentType = res.headers.get('content-type') ?? '';

    if (contentType.includes('audio/')) {
      const buffer = Buffer.from(await res.arrayBuffer());
      return { buffer, mimeType: 'audio/mpeg', ext: 'mp3', durationMs: duration * 1000, model: 'musicgen-local', notes: prompt };
    }

    const json = (await res.json()) as {
      audio_url?: string;
      url?: string;
      audio?: string;
      output?: string[];
      job_id?: string;
      id?: string;
    };

    const audioUrl = json.audio_url ?? json.url ?? json.output?.[0];
    if (audioUrl) {
      const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
      if (!audioRes.ok) throw new Error(`MusicGen audio download failed: ${audioRes.status}`);
      return { buffer: Buffer.from(await audioRes.arrayBuffer()), mimeType: 'audio/mpeg', ext: 'mp3', durationMs: duration * 1000, model: 'musicgen-local', notes: prompt };
    }

    if (json.audio) {
      return { buffer: Buffer.from(json.audio, 'base64'), mimeType: 'audio/mpeg', ext: 'mp3', durationMs: duration * 1000, model: 'musicgen-local', notes: prompt };
    }

    const jobId = json.job_id ?? json.id;
    if (!jobId) throw new Error(`MusicGen: unexpected response: ${JSON.stringify(json).slice(0, 200)}`);

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${BASE_URL}/status/${jobId}`, { signal: AbortSignal.timeout(10_000) });
      if (!pollRes.ok) continue;
      const poll = (await pollRes.json()) as { status?: string; audio_url?: string; url?: string; audio?: string; output?: string[] };
      if (poll.status === 'failed') throw new Error('MusicGen job failed');
      const url = poll.audio_url ?? poll.url ?? poll.output?.[0];
      if (url) {
        const audioRes = await fetch(url, { signal: AbortSignal.timeout(60_000) });
        if (!audioRes.ok) throw new Error(`MusicGen audio download failed: ${audioRes.status}`);
        return { buffer: Buffer.from(await audioRes.arrayBuffer()), mimeType: 'audio/mpeg', ext: 'mp3', durationMs: duration * 1000, model: 'musicgen-local', notes: prompt };
      }
      if (poll.audio) {
        return { buffer: Buffer.from(poll.audio, 'base64'), mimeType: 'audio/mpeg', ext: 'mp3', durationMs: duration * 1000, model: 'musicgen-local', notes: prompt };
      }
    }
    throw new Error('MusicGen local: polling timed out');
  }
}
