import type { VideoAdapter, SceneVideoRequest, GeneratedMedia } from '../media.types';

const BASE_URL = 'https://api.piapi.ai/api/v1';
const POLL_INTERVAL_MS = 8000;
const MAX_POLLS = 100;

type PiStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'canceled';

interface PiTaskData {
  task_id: string;
  status: PiStatus;
  output?: { video?: string };
  error?: { code?: number; message?: string };
}

interface PiResponse {
  code: number;
  message?: string;
  data: PiTaskData;
}

function piHeaders(): Record<string, string> {
  return {
    'X-API-Key': process.env['PIAPI_API_KEY'] ?? '',
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
 * AI video generation via Kling AI through PiAPI (api.piapi.ai/api/v1).
 * Supports text-to-video and image-to-video (imageUrl preferred).
 * Activates when PIAPI_API_KEY is set.
 * Env: PIAPI_API_KEY
 */
export class KlingVideoAdapter implements VideoAdapter {
  readonly name = 'kling-ai';

  available(): boolean {
    return !!process.env['PIAPI_API_KEY'];
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    const duration = Math.min(Math.max(req.durationSecs, 5), 10) >= 8 ? 10 : 5;
    const ratio = klingRatio(req.width, req.height);

    const input: Record<string, unknown> = {
      // Kling prompt limit is ~2500 chars — truncate to stay safe
      prompt: req.prompt.slice(0, 2400),
      duration,
      aspect_ratio: ratio,
    };

    // Cloud adapters require a public HTTPS URL with no auth gating.
    // Only pass image_url when imageUrl is a clean CDN URL (no ?token= query params).
    // Auth-token URLs (Railway API media endpoint) are inaccessible to external services.
    const imgSource = req.imageUrl && !req.imageUrl.includes('?') ? req.imageUrl : undefined;
    if (imgSource) input['image_url'] = imgSource;

    const body = { model: 'kling', task_type: 'video_generation', input };
    console.log('[Kling] submitting task — duration:', duration, 'ratio:', ratio, 'img:', !!imgSource, 'prompt[:100]:', String(input['prompt']).slice(0, 100));
    const startRes = await fetch(`${BASE_URL}/task`, {
      method: 'POST',
      headers: piHeaders(),
      body: JSON.stringify(body),
    });

    // PiAPI returns HTTP 500 for immediately-failed tasks (still has a response body).
    // Always parse the body to extract the real error detail.
    const startData = await startRes.json().catch(() => null) as PiResponse | null;
    if (!startRes.ok || !startData || (startData.code !== 200 && startData.code !== 0)) {
      const detail = startData?.data?.error?.message ?? startData?.message ?? String(startRes.status);
      throw new Error(`Kling/PiAPI start failed: ${detail}`);
    }
    if (startData.data.status === 'failed') {
      throw new Error(`Kling/PiAPI task immediately failed: ${startData.data.error?.message ?? 'unknown'}`);
    }

    const taskId = startData.data.task_id;
    let taskData = startData.data;

    for (let i = 0; i < MAX_POLLS && taskData.status !== 'completed' && taskData.status !== 'failed' && taskData.status !== 'canceled'; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${BASE_URL}/task/${taskId}`, { headers: piHeaders() });
      if (!pollRes.ok) throw new Error(`Kling/PiAPI poll failed: ${pollRes.status}`);
      const pollData = (await pollRes.json()) as PiResponse;
      if (pollData.code !== 200 && pollData.code !== 0) throw new Error(`Kling/PiAPI poll error: ${pollData.message}`);
      taskData = pollData.data;
    }

    const videoUrl = taskData.output?.video;
    if (taskData.status !== 'completed' || !videoUrl) {
      console.log('[Kling] task failed — status:', taskData.status, 'error:', JSON.stringify(taskData.error));
      throw new Error(`Kling/PiAPI failed: ${taskData.error?.message ?? taskData.status}`);
    }

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Kling video download failed: ${videoRes.status}`);

    const buffer = Buffer.from(await videoRes.arrayBuffer());
    return {
      buffer,
      mimeType: 'video/mp4',
      ext: 'mp4',
      durationMs: duration * 1000,
      model: 'kling-v1-via-piapi',
      notes: imgSource ? 'image-to-video' : 'text-to-video',
    };
  }
}
