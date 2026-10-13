import { promises as fs } from 'fs';
import type { VideoAdapter, SceneVideoRequest, GeneratedMedia } from '../media.types';

const POLL_INTERVAL_MS = 8000;
const MAX_POLLS = 90; // 12 minutes max

// Try these model names in order until one works.
// VEO_MODEL env override lets operators pin a specific model without redeploying.
const MODEL_CANDIDATES: string[] = [
  process.env['VEO_MODEL'] ?? '',
  'veo-2.0-flash',          // GA name (Google AI Studio 2025)
  'veo-2',                  // short alias
  'veo-2.0-flash-exp',      // developer preview name
  'veo-2.0-generate-001',   // original limited-preview name
  'veo-001',                // older alias sometimes used in Vertex routes
].filter(Boolean);

// Try v1beta first (standard), then v1 (older stable channel)
const API_BASES = ['https://generativelanguage.googleapis.com/v1beta', 'https://generativelanguage.googleapis.com/v1'];

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
 * AI video generation via Google Veo 2.
 *
 * Activation: requires VEO_API_KEY (separate from GEMINI_API_KEY used for
 * image/text generation — sharing keys caused accidental Veo billing).
 *
 * Model resolution: tries VEO_MODEL env → veo-2.0-flash-exp → veo-2.0-generate-001.
 * 404 on one model name causes an automatic retry with the next candidate.
 *
 * Image-to-video: reads local imagePath and base64-encodes it (Veo does not
 * accept filesystem paths — the previous implementation was broken for local images).
 */
export class VeoVideoAdapter implements VideoAdapter {
  readonly name = 'google-veo-2';

  // Track model that succeeded last time to skip retrying failed ones
  private workingModel: string | null = null;
  private allModelsFailed = false;

  available(): boolean {
    // Veo requires both VEO_API_KEY AND VIDEO_PROVIDER=google-veo-2 to activate.
    // This keeps ffmpeg-kenburns as the default without needing to unset VEO_API_KEY.
    // GEMINI_API_KEY is intentionally NOT checked here — it is shared with image/text
    // generation and must not trigger Veo video billing.
    return (
      !this.allModelsFailed &&
      !!process.env['VEO_API_KEY'] &&
      process.env['VIDEO_PROVIDER'] === 'google-veo-2'
    );
  }

  async renderScene(req: SceneVideoRequest): Promise<GeneratedMedia> {
    const key = process.env['VEO_API_KEY']!;
    const duration = Math.min(Math.max(Math.round(req.durationSecs), 5), 8);
    const ar = aspectRatio(req.width, req.height);

    // Build image payload: Veo requires base64-encoded inline image, not a path.
    let imagePayload: Record<string, unknown> | undefined;
    if (req.imagePath) {
      try {
        const imgBuf = await fs.readFile(req.imagePath);
        const ext = req.imagePath.toLowerCase();
        const mimeType = ext.endsWith('.png') ? 'image/png' : 'image/jpeg';
        imagePayload = {
          image: {
            bytesBase64Encoded: imgBuf.toString('base64'),
            mimeType,
          },
        };
      } catch {
        // Image unreadable — proceed as text-to-video
      }
    } else if (req.imageUrl) {
      // Cloud adapters prefer a URL reference; Veo API accepts GCS URIs directly
      if (req.imageUrl.startsWith('gs://') || req.imageUrl.startsWith('https://storage.googleapis.com')) {
        imagePayload = { image: { imageUri: req.imageUrl } };
      }
      // Non-GCS public URLs: download and encode
      else {
        try {
          const dlRes = await fetch(req.imageUrl, { signal: AbortSignal.timeout(15_000) });
          if (dlRes.ok) {
            const buf = Buffer.from(await dlRes.arrayBuffer());
            const ct = dlRes.headers.get('content-type') ?? 'image/jpeg';
            imagePayload = { image: { bytesBase64Encoded: buf.toString('base64'), mimeType: ct.split(';')[0] } };
          }
        } catch { /* proceed as text-to-video */ }
      }
    }

    const candidates = this.workingModel
      ? [this.workingModel, ...MODEL_CANDIDATES.filter((m) => m !== this.workingModel)]
      : MODEL_CANDIDATES;

    let lastError = '';
    // Try each model name × each API base URL until something works
    outer: for (const model of candidates) {
      for (const base of API_BASES) {
        try {
          const result = await this.tryModel(model, base, key, req.prompt, duration, ar, imagePayload);
          this.workingModel = model;
          return result;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          lastError = msg;
          // 404 / "not found" = model name wrong or no access — try next combination
          if (msg.includes('404') || /not found|model.*unavailable|doesn.t exist/i.test(msg)) continue;
          // Auth / quota / timeout — propagate immediately; retrying won't help
          break outer;
        }
      }
    }

    // All combinations failed — mark adapter unavailable for this process lifetime
    this.allModelsFailed = true;
    throw new Error(
      `Veo model not available — tried all known model names (${candidates.join(', ')}) on both API versions. ` +
      `Falling back to internal motion rendering (ffmpeg Ken Burns). ` +
      `To use Veo: set VEO_MODEL to the correct model name and ensure your API key has Veo access. ` +
      `Last error: ${lastError}`,
    );
  }

  private async tryModel(
    model: string,
    base: string,
    key: string,
    prompt: string,
    duration: number,
    ar: string,
    imagePayload: Record<string, unknown> | undefined,
  ): Promise<GeneratedMedia> {
    const instance: Record<string, unknown> = { prompt: prompt.slice(0, 500) };
    if (imagePayload) Object.assign(instance, imagePayload);

    const startRes = await fetch(
      `${base}/models/${model}:predictLongRunning?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [instance],
          parameters: { aspectRatio: ar, sampleCount: 1, durationSeconds: duration },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => '');
      throw new Error(`Veo start failed: ${startRes.status} ${text.slice(0, 200)}`);
    }

    let op = (await startRes.json()) as VeoOperation;

    for (let i = 0; i < MAX_POLLS && !op.done; i++) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      // op.name is a full path like "operations/abc123" — prefix with the same base used to start
      const pollRes = await fetch(`${base}/${op.name}?key=${key}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!pollRes.ok) throw new Error(`Veo poll failed: ${pollRes.status}`);
      op = (await pollRes.json()) as VeoOperation;
    }

    if (!op.done) throw new Error('Veo operation timed out after 12 minutes');
    if (op.error) throw new Error(`Veo error: ${op.error.message}`);

    const sample = op.response?.generatedSamples?.[0]?.video;
    if (!sample) throw new Error('Veo: no video sample in response');

    if (sample.bytesBase64Encoded) {
      return {
        buffer: Buffer.from(sample.bytesBase64Encoded, 'base64'),
        mimeType: (sample.mimeType as 'video/mp4') ?? 'video/mp4',
        ext: 'mp4',
        durationMs: duration * 1000,
        model,
        notes: imagePayload ? 'image-to-video (Veo 2)' : 'text-to-video (Veo 2)',
      };
    }

    if (sample.uri) {
      const dlRes = await fetch(sample.uri, { signal: AbortSignal.timeout(120_000) });
      if (!dlRes.ok) throw new Error(`Veo download failed: ${dlRes.status}`);
      return {
        buffer: Buffer.from(await dlRes.arrayBuffer()),
        mimeType: 'video/mp4',
        ext: 'mp4',
        durationMs: duration * 1000,
        model,
        notes: imagePayload ? 'image-to-video (Veo 2)' : 'text-to-video (Veo 2)',
      };
    }

    throw new Error('Veo: response contained neither inline bytes nor a download URI');
  }
}
