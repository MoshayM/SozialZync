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
      prompt: req.prompt,
      duration,
      aspect_ratio: ratio,
    };

    // Cloud adapters need a public HTTPS URL; imageUrl takes priority over local imagePath
    const imgSource = req.imageUrl ?? req.imagePath;
    if (imgSource) input['image_url'] = imgSource;

    const startRes = await fetch(`${BASE_URL}/task`, {
      method: 'POST',
      headers: piHeaders(),
      body: JSON.stringify({ model: 'kling', task_type: 'video_generation', input }),
    });

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Kling/PiAPI start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    const startData = (await startRes.json()) as PiResponse;
    if (startData.code !== 200 && startData.code !== 0) {
      throw new Error(`Kling/PiAPI error: ${startData.message ?? startData.code}`);
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
