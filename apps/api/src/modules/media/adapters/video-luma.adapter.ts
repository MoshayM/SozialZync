import type { VideoAdapter, SceneVideoRequest, GeneratedMedia } from '../media.types';

const BASE_URL = 'https://api.lumalabs.ai/dream-machine/v1/generations';
const MAX_DURATION_SECS = 9; // Luma Dream Machine clip limit
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 120;

interface LumaAssets { video?: string; }

interface LumaGen {
  id: string;
  state: 'pending' | 'dreaming' | 'completed' | 'failed';
  failure_reason: string | null;
  assets: LumaAssets | null;
}

function aspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio >= 1.6) return '16:9';
  if (ratio <= 0.65) return '9:16';
  return '1:1';
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env['LUMA_API_KEY'] ?? ''}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * AI video generation via Luma AI Dream Machine.
 * Supports text-to-video and image-to-video (when req.imagePath is a URL).
 * Activates when LUMA_API_KEY is set.
 * Env: LUMA_API_KEY
 */
export class LumaVideoAdapter implements VideoAdapter {
  readonly name = 'luma-dream-machine';

  available(): boolean {
    return !!process.env['LUMA_API_KEY'];
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    const duration = Math.min(Math.max(req.durationSecs, 3), MAX_DURATION_SECS);
    const ar = aspectRatio(req.width, req.height);

    const body: Record<string, unknown> = {
      prompt: req.prompt,
      aspect_ratio: ar,
      loop: false,
    };

    // Image-to-video when a source image URL is provided
    if (req.imagePath) {
      body['keyframes'] = {
        frame0: { type: 'image', url: req.imagePath },
      };
    }

    const startRes = await fetch(BASE_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Luma start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    let gen = (await startRes.json()) as LumaGen;

    // Poll until completed or failed
    for (let i = 0; i < MAX_POLLS && gen.state !== 'completed' && gen.state !== 'failed'; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${BASE_URL}/${gen.id}`, { headers: authHeaders() });
      if (!pollRes.ok) throw new Error(`Luma poll failed: ${pollRes.status}`);
      gen = (await pollRes.json()) as LumaGen;
    }

    if (gen.state !== 'completed' || !gen.assets?.video) {
      throw new Error(`Luma Dream Machine failed: ${gen.failure_reason ?? gen.state}`);
    }

    const videoRes = await fetch(gen.assets.video);
    if (!videoRes.ok) throw new Error(`Luma video download failed: ${videoRes.status}`);

    const buffer = Buffer.from(await videoRes.arrayBuffer());
    return {
      buffer,
      mimeType: 'video/mp4',
      ext: 'mp4',
      durationMs: Math.round(duration * 1000),
      model: 'luma-dream-machine',
      notes: req.imagePath ? 'image-to-video' : 'text-to-video',
    };
  }
}
