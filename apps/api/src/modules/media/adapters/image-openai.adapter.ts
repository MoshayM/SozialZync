import type { ImageAdapter, ImageRequest, GeneratedMedia } from '../media.types';

const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';

/**
 * Real image generation via the OpenAI images API — active whenever OPENAI_API_KEY is set.
 *
 * Cost tiers:
 *   fast/standard → DALL-E 2 @ 1024×1024 (~$0.016–0.020/image, 60-75% cheaper)
 *   high          → configured model (default DALL-E 3) @ best orientation
 *
 * IMAGE_OPENAI_MODEL env overrides the high-quality model only.
 */
export class OpenAiImageAdapter implements ImageAdapter {
  readonly name = 'openai-image';

  // A 401/403 means the key is revoked — skip for the rest of this process lifetime
  private authFailed = false;

  available(): boolean {
    return !this.authFailed && !!process.env['OPENAI_API_KEY'];
  }

  async generateImage(req: ImageRequest): Promise<GeneratedMedia> {
    const quality = req.quality ?? 'standard';

    // Cost optimization: use DALL-E 2 unless user explicitly requested high quality.
    // DALL-E 2: ~$0.018/image vs DALL-E 3: $0.040–0.080/image (2-4× cheaper).
    const model = quality === 'high'
      ? (process.env['IMAGE_OPENAI_MODEL'] ?? 'dall-e-3')
      : 'dall-e-2';

    // DALL-E 2 only supports 256×256, 512×512, 1024×1024 — always use 1024×1024.
    // DALL-E 3: pick orientation; avoid HD ($0.080+) unless explicitly configured.
    const size = model === 'dall-e-2'
      ? '1024x1024'
      : (req.width >= req.height ? '1792x1024' : '1024x1792');

    const prompt = req.negativePrompt
      ? `${req.prompt.slice(0, 900)}\n\nAvoid: ${req.negativePrompt.slice(0, 100)}`
      : req.prompt.slice(0, 1000);

    const body: Record<string, unknown> = { model, prompt, n: 1, size, response_format: 'b64_json' };
    // Only pass quality param for dall-e-3; keep it 'standard' to avoid hd pricing
    if (model === 'dall-e-3') body['quality'] = 'standard';

    const res = await fetch(OPENAI_IMAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env['OPENAI_API_KEY']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 429) this.authFailed = true;
      throw new Error(`OpenAI image generation failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI image generation returned no image data');
    return {
      buffer: Buffer.from(b64, 'base64'),
      mimeType: 'image/png',
      ext: 'png',
      model,
      notes: model === 'dall-e-2' ? 'Standard quality (DALL-E 2)' : undefined,
    };
  }
}
