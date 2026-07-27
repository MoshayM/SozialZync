import type { VideoAdapter, SceneVideoRequest, GeneratedMedia } from '../media.types';
import { createHmac } from 'crypto';

const BASE_URL = 'https://api.klingai.com/v1/videos';
const MAX_DURATION_SECS = 10;
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 120;

type KlingStatus = 'submitted' | 'processing' | 'succeed' | 'failed';

interface KlingTask {
  task_id: string;
  task_status: KlingStatus;
  task_status_msg?: string;
  task_result?: { videos?: Array<{ url: string; duration: string }> };
}

interface KlingResponse {
  code: number;
  message: string;
  data: KlingTask;
}

/**
 * Build a JWT for Kling API authentication.
 * Header: { alg: HS256, typ: JWT }
 * Payload: { iss: accessKeyId, exp: now + 1800, nbf: now - 5 }
 */
function buildJwt(): string {
  const accessKeyId = process.env['KLING_ACCESS_KEY_ID'] ?? '';
  const secret = process.env['KLING_ACCESS_KEY_SECRET'] ?? '';

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: accessKeyId, exp: now + 1800, nbf: now - 5 })).toString('base64url');
  const signing = `${header}.${payload}`;
  const sig = createHmac('sha256', secret).update(signing).digest('base64url');
  return `${signing}.${sig}`;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${buildJwt()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function klingRatio(width: number, height: number): '16:9' | '9:16' | '1:1' {
  const r = width / height;
  if (r >= 1.5) return '16:9';
  if (r <= 0.67) return '9:16';
  return '1:1';
}

/**
 * AI video generation via Kling AI (Kuaishou).
 * Supports text-to-video and image-to-video.
 * Activates when KLING_ACCESS_KEY_ID + KLING_ACCESS_KEY_SECRET are set.
 * Env: KLING_ACCESS_KEY_ID, KLING_ACCESS_KEY_SECRET
 */
export class KlingVideoAdapter implements VideoAdapter {
  readonly name = 'kling-ai';

  available(): boolean {
    return !!(process.env['KLING_ACCESS_KEY_ID'] && process.env['KLING_ACCESS_KEY_SECRET']);
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    const duration = (Math.min(Math.max(req.durationSecs, 5), MAX_DURATION_SECS) >= 8 ? 10 : 5) as 5 | 10;
    const ratio = klingRatio(req.width, req.height);

    const endpoint = req.imagePath ? `${BASE_URL}/image2video` : `${BASE_URL}/text2video`;

    const body: Record<string, unknown> = {
      model_name: 'kling-v1',
      prompt: req.prompt,
      duration: String(duration),
      aspect_ratio: ratio,
      mode: 'std',
    };

    if (req.imagePath) {
      body['image_url'] = req.imagePath;
    }

    const startRes = await fetch(endpoint, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Kling start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    let resp = (await startRes.json()) as KlingResponse;
    if (resp.code !== 0) throw new Error(`Kling error: ${resp.message}`);

    let task = resp.data;

    for (
      let i = 0;
      i < MAX_POLLS && task.task_status !== 'succeed' && task.task_status !== 'failed';
      i++
    ) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${BASE_URL}/${task.task_id}`, { headers: authHeaders() });
      if (!pollRes.ok) throw new Error(`Kling poll failed: ${pollRes.status}`);
      resp = (await pollRes.json()) as KlingResponse;
      if (resp.code !== 0) throw new Error(`Kling poll error: ${resp.message}`);
      task = resp.data;
    }

    const videoUrl = task.task_result?.videos?.[0]?.url;
    if (task.task_status !== 'succeed' || !videoUrl) {
      throw new Error(`Kling AI failed: ${task.task_status_msg ?? task.task_status}`);
    }

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Kling video download failed: ${videoRes.status}`);

    const buffer = Buffer.from(await videoRes.arrayBuffer());
    return {
      buffer,
      mimeType: 'video/mp4',
      ext: 'mp4',
      durationMs: duration * 1000,
      model: 'kling-v1',
      notes: req.imagePath ? 'image-to-video' : 'text-to-video',
    };
  }
}
