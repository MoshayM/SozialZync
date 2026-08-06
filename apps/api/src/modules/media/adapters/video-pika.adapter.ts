import type { VideoAdapter, SceneVideoRequest, GeneratedMedia } from '../media.types';

const BASE_URL = 'https://api.pika.art/v1';
const POLL_INTERVAL_MS = 6000;
const MAX_POLLS = 80;

type PikaStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface PikaJob {
  id: string;
  status: PikaStatus;
  video?: { url: string; duration?: number };
  error?: string;
}

function pikaDuration(secs: number): number {
  // Pika supports 3–10 s
  return Math.min(Math.max(Math.round(secs), 3), 10);
}

function pikaAspect(width: number, height: number): string {
  const r = width / height;
  if (r >= 1.6) return '16:9';
  if (r <= 0.65) return '9:16';
  return '1:1';
}

function pikaHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env['PIKA_API_KEY'] ?? ''}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * AI video generation via Pika Labs (api.pika.art).
 * Activates when PIKA_API_KEY is set.
 * Env: PIKA_API_KEY
 */
export class PikaVideoAdapter implements VideoAdapter {
  readonly name = 'pika-labs';

  available(): boolean {
    return !!process.env['PIKA_API_KEY'];
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    const duration = pikaDuration(req.durationSecs);
    const aspectRatio = pikaAspect(req.width, req.height);

    const body: Record<string, unknown> = {
      prompt: req.prompt,
      options: {
        aspectRatio,
        duration,
        fps: 24,
        motion: 2,
      },
    };

    if (req.imagePath) {
      body['image'] = req.imagePath;
    }

    const startRes = await fetch(`${BASE_URL}/generate/text2video`, {
      method: 'POST',
      headers: pikaHeaders(),
      body: JSON.stringify(body),
    });

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Pika start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    let job = (await startRes.json()) as PikaJob;

    for (let i = 0; i < MAX_POLLS && job.status !== 'completed' && job.status !== 'failed'; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${BASE_URL}/task/${job.id}`, { headers: pikaHeaders() });
      if (!pollRes.ok) throw new Error(`Pika poll failed: ${pollRes.status}`);
      job = (await pollRes.json()) as PikaJob;
    }

    if (job.status !== 'completed' || !job.video?.url) {
      throw new Error(`Pika failed: ${job.error ?? job.status}`);
    }

    const videoRes = await fetch(job.video.url);
    if (!videoRes.ok) throw new Error(`Pika download failed: ${videoRes.status}`);

    const buffer = Buffer.from(await videoRes.arrayBuffer());
    return {
      buffer,
      mimeType: 'video/mp4',
      ext: 'mp4',
      durationMs: duration * 1000,
      model: 'pika-labs',
      notes: req.imagePath ? 'image-to-video' : 'text-to-video',
    };
  }
}
