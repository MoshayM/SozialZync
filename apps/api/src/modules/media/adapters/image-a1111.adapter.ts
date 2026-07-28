import type { SelfHostedImageAdapter, SelfHostedImageRequest, GeneratedImage } from '../media.types';

const BASE_URL = process.env['A1111_URL'] ?? 'http://localhost:7860';

type A1111Response = { images: string[]; info?: string };
type A1111InfoJson = { seed?: number };

/**
 * Automatic1111/Forge/InvokeAI adapter. Activates when A1111_URL env is set.
 * Uses /sdapi/v1/txt2img (standard A1111 API, compatible with Forge + InvokeAI).
 */
export class A1111ImageAdapter implements SelfHostedImageAdapter {
  readonly name = 'a1111';

  available(): boolean {
    return !!process.env['A1111_URL'];
  }

  async generate(req: SelfHostedImageRequest): Promise<GeneratedImage> {
    const width = req.width ?? 1024;
    const height = req.height ?? 1024;
    const seed = req.seed ?? -1;

    const body: Record<string, unknown> = {
      prompt: req.prompt,
      negative_prompt: req.negativePrompt ?? 'blurry, low quality, watermark',
      width,
      height,
      steps: req.steps ?? 20,
      cfg_scale: req.cfgScale ?? 7,
      seed,
      sampler_name: 'DPM++ 2M',
      batch_size: 1,
      save_images: false,
      send_images: true,
    };

    if (req.model) {
      // Switch model before generation (non-fatal if it fails)
      await fetch(`${BASE_URL}/sdapi/v1/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sd_model_checkpoint: req.model }),
        signal: AbortSignal.timeout(30_000),
      }).catch(() => {});
    }

    const endpoint = req.referenceImageUrl ? '/sdapi/v1/img2img' : '/sdapi/v1/txt2img';
    if (req.referenceImageUrl) {
      const imgResp = await fetch(req.referenceImageUrl, { signal: AbortSignal.timeout(15_000) });
      const imgBuf = Buffer.from(await imgResp.arrayBuffer());
      body['init_images'] = [imgBuf.toString('base64')];
      body['denoising_strength'] = req.strength ?? 0.75;
    }

    const resp = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });
    if (!resp.ok) {
      throw new Error(`A1111 API error: ${resp.status} ${await resp.text()}`);
    }
    const data = (await resp.json()) as A1111Response;
    if (!data.images?.[0]) throw new Error('A1111 returned no image');

    const buffer = Buffer.from(data.images[0], 'base64');
    let actualSeed = seed;
    if (data.info) {
      try {
        actualSeed = (JSON.parse(data.info) as A1111InfoJson).seed ?? seed;
      } catch {
        // ignore unparseable info
      }
    }
    return {
      buffer,
      mimeType: 'image/png',
      width,
      height,
      provider: 'a1111',
      model: req.model ?? 'default',
      seed: actualSeed,
      prompt: req.prompt,
    };
  }
}
