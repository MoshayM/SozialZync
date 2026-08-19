import type { VideoAdapter, SceneVideoRequest, GeneratedMedia } from '../media.types';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'veo-2.0-generate-001';
const POLL_INTERVAL_MS = 8000;
const MAX_POLLS = 90; // 12 minutes max

interface VeoOperation {
  name: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: {
    generatedSamples?: Array<{
      video?: {
        uri?: string;
        bytesBase64Encoded?: string;
        mimeType?: string;
      };
    }>;
  };
}

function aspectRatio(width: number, height: number): string {
  const r = width / height;
  if (r >= 1.6) return '16:9';
  if (r <= 0.65) return '9:16';
  return '1:1';
}

/**
 * AI video generation via Google Veo 2 (generativelanguage.googleapis.com).
 * Activates when VEO_API_KEY or GEMINI_API_KEY is set.
 * Env: VEO_API_KEY (preferred), GEMINI_API_KEY (fallback)
 */
export class VeoVideoAdapter implements VideoAdapter {
  readonly name = 'google-veo-2';

  private apiKey(): string {
    return process.env['VEO_API_KEY'] ?? process.env['GEMINI_API_KEY'] ?? '';
  }

  available(): boolean {
    return !!(process.env['VEO_API_KEY'] ?? process.env['GEMINI_API_KEY']);
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    const duration = Math.min(Math.max(Math.round(req.durationSecs), 5), 8);
    const ar = aspectRatio(req.width, req.height);
    const key = this.apiKey();

    const body: Record<string, unknown> = {
      instances: [{ prompt: req.prompt }],
      parameters: {
        aspectRatio: ar,
        sampleCount: 1,
        durationSeconds: duration,
      },
    };

    if (req.imagePath) {
      (body['instances'] as Array<Record<string, unknown>>)[0]['image'] = {
        imageUri: req.imagePath,
      };
    }

    const startRes = await fetch(
      `${BASE_URL}/models/${MODEL}:predictLongRunning?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Veo start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    let op = (await startRes.json()) as VeoOperation;

    for (let i = 0; i < MAX_POLLS && !op.done; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(
        `${BASE_URL}/${op.name}?key=${key}`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (!pollRes.ok) throw new Error(`Veo poll failed: ${pollRes.status}`);
      op = (await pollRes.json()) as VeoOperation;
    }

    if (!op.done) throw new Error('Veo operation timed out');
    if (op.error) throw new Error(`Veo error: ${op.error.message}`);

    const sample = op.response?.generatedSamples?.[0]?.video;
    if (!sample) throw new Error('Veo: no video sample in response');

    // Prefer inline base64 bytes; GCS URIs require separate auth
    if (sample.bytesBase64Encoded) {
      const buffer = Buffer.from(sample.bytesBase64Encoded, 'base64');
      return {
        buffer,
        mimeType: sample.mimeType ?? 'video/mp4',
        ext: 'mp4',
        durationMs: duration * 1000,
        model: 'veo-2.0-generate-001',
        notes: req.imagePath ? 'image-to-video' : 'text-to-video',
      };
    }

    if (sample.uri) {
      const dlRes = await fetch(sample.uri);
      if (!dlRes.ok) throw new Error(`Veo download failed: ${dlRes.status}`);
      const buffer = Buffer.from(await dlRes.arrayBuffer());
      return {
        buffer,
        mimeType: 'video/mp4',
        ext: 'mp4',
        durationMs: duration * 1000,
        model: 'veo-2.0-generate-001',
        notes: req.imagePath ? 'image-to-video' : 'text-to-video',
      };
    }

    throw new Error('Veo: response contained neither inline bytes nor a download URI');
  }
}
