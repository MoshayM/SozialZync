import type { VideoAdapter, SceneVideoRequest, GeneratedMedia } from '../media.types';

const BASE_URL = 'https://api.piapi.ai';
const POLL_INTERVAL_MS = 6000;
const MAX_POLLS = 100;

type PiStatus = 'pending' | 'processing' | 'succeed' | 'failed' | 'canceled';

interface PiVideoResult {
  url: string;
  duration?: string;
}

interface PiTaskData {
  task_id: string;
  status?: PiStatus;
  task_status?: PiStatus;
  output?: { works?: Array<{ resource?: { resource?: string } }> };
  task_result?: { videos?: PiVideoResult[] };
  error?: { message?: string };
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

function extractVideoUrl(data: PiTaskData): string | undefined {
  // PiAPI wraps Kling — two known response shapes:
  return (
    data.task_result?.videos?.[0]?.url ??
    data.output?.works?.[0]?.resource?.resource
  );
}

function getStatus(data: PiTaskData): PiStatus | undefined {
  return data.status ?? data.task_status;
}

/**
 * AI video generation via Kling AI through PiAPI (api.piapi.ai).
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
      duration: String(duration),
      aspect_ratio: ratio,
    };
    if (req.imagePath) input['img_url'] = req.imagePath;

    const startRes = await fetch(`${BASE_URL}/kling/videogen`, {
      method: 'POST',
      headers: piHeaders(),
      body: JSON.stringify({ input }),
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
    let status = getStatus(taskData);

    for (let i = 0; i < MAX_POLLS && status !== 'succeed' && status !== 'failed' && status !== 'canceled'; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${BASE_URL}/kling/fetch`, {
        method: 'POST',
        headers: piHeaders(),
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!pollRes.ok) throw new Error(`Kling/PiAPI poll failed: ${pollRes.status}`);
      const pollData = (await pollRes.json()) as PiResponse;
      if (pollData.code !== 200 && pollData.code !== 0) throw new Error(`Kling/PiAPI poll error: ${pollData.message}`);
      taskData = pollData.data;
      status = getStatus(taskData);
    }

    const videoUrl = extractVideoUrl(taskData);
    if (status !== 'succeed' || !videoUrl) {
      throw new Error(`Kling/PiAPI failed: ${taskData.error?.message ?? status}`);
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
      notes: req.imagePath ? 'image-to-video' : 'text-to-video',
    };
  }
}
