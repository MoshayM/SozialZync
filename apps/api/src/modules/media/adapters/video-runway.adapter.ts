import type { VideoAdapter, SceneVideoRequest, GeneratedMedia } from '../media.types';

const BASE_URL = 'https://api.dev.runwayml.com/v1';
const MAX_DURATION_SECS = 10; // Runway Gen-3 Alpha max clip
const POLL_INTERVAL_MS = 6000;
const MAX_POLLS = 100;

type TaskStatus = 'PENDING' | 'THROTTLED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

interface RunwayTask {
  id: string;
  status: TaskStatus;
  failure?: string;
  output?: string[];
  progress?: number;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env['RUNWAYML_API_KEY'] ?? ''}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Runway-Version': '2024-11-06',
  };
}

function ratio(width: number, height: number): '1280:768' | '768:1280' | '1104:832' | '832:1104' | '960:960' {
  const r = width / height;
  if (r >= 1.5) return '1280:768';
  if (r <= 0.67) return '768:1280';
  return '960:960';
}

/**
 * AI video generation via Runway Gen-3 Alpha.
 * Supports text-to-video and image-to-video (when req.imagePath is a URL).
 * Activates when RUNWAYML_API_KEY is set.
 * Env: RUNWAYML_API_KEY
 */
export class RunwayVideoAdapter implements VideoAdapter {
  readonly name = 'runway-gen3-alpha';

  available(): boolean {
    return !!process.env['RUNWAYML_API_KEY'];
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    const duration = Math.min(Math.max(req.durationSecs, 5), MAX_DURATION_SECS) as 5 | 10;
    const resolution = ratio(req.width, req.height);

    const body: Record<string, unknown> = {
      model: 'gen3a_turbo',
      promptText: req.prompt,
      duration,
      ratio: resolution,
      watermark: false,
    };

    if (req.imagePath) {
      body['promptImage'] = req.imagePath;
    }

    const startRes = await fetch(`${BASE_URL}/image_to_video`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Runway start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    let task = (await startRes.json()) as RunwayTask;

    for (let i = 0; i < MAX_POLLS && task.status !== 'SUCCEEDED' && task.status !== 'FAILED' && task.status !== 'CANCELLED'; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${BASE_URL}/tasks/${task.id}`, { headers: authHeaders() });
      if (!pollRes.ok) throw new Error(`Runway poll failed: ${pollRes.status}`);
      task = (await pollRes.json()) as RunwayTask;
    }

    if (task.status !== 'SUCCEEDED' || !task.output?.[0]) {
      throw new Error(`Runway Gen-3 failed: ${task.failure ?? task.status}`);
    }

    const videoRes = await fetch(task.output[0]);
    if (!videoRes.ok) throw new Error(`Runway video download failed: ${videoRes.status}`);

    const buffer = Buffer.from(await videoRes.arrayBuffer());
    return {
      buffer,
      mimeType: 'video/mp4',
      ext: 'mp4',
      durationMs: duration * 1000,
      model: 'runway-gen3a-turbo',
      notes: req.imagePath ? 'image-to-video' : 'text-to-video',
    };
  }
}
