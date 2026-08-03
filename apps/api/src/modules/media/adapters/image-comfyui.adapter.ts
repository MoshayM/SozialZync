import type { SelfHostedImageAdapter, SelfHostedImageRequest, GeneratedImage, ImageAdapter, ImageRequest, GeneratedMedia } from '../media.types';

const BASE_URL = process.env['COMFYUI_URL'] ?? 'http://localhost:8188';

type ComfyHistoryEntry = {
  outputs?: Record<
    string,
    { images?: Array<{ filename: string; subfolder: string; type: string }> }
  >;
};

/**
 * ComfyUI image adapter. Activates when COMFYUI_URL env is set.
 * Uses ComfyUI's /prompt API with a basic SDXL txt2img workflow.
 */
export class ComfyUIImageAdapter implements SelfHostedImageAdapter, ImageAdapter {
  readonly name = 'comfyui';

  available(): boolean {
    return !!process.env['COMFYUI_URL'];
  }

  async generate(req: SelfHostedImageRequest): Promise<GeneratedImage> {
    const clientId = `cf_${Date.now()}`;
    const width = req.width ?? 1024;
    const height = req.height ?? 1024;
    const steps = req.steps ?? 20;
    const cfg = req.cfgScale ?? 7;
    const seed = req.seed ?? Math.floor(Math.random() * 2 ** 32);
    const model = req.model ?? 'sd_xl_base_1.0.safetensors';

    // Minimal SDXL workflow
    const workflow = {
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: model } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: req.prompt, clip: ['4', 1] } },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: { text: req.negativePrompt ?? 'blurry, low quality', clip: ['4', 1] },
      },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['10', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'cf_gen', images: ['8', 0] } },
      '10': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps,
          cfg,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['11', 0],
        },
      },
      '11': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    };

    // Queue the prompt
    const queueResp = await fetch(`${BASE_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!queueResp.ok) throw new Error(`ComfyUI queue failed: ${queueResp.status}`);
    const { prompt_id } = (await queueResp.json()) as { prompt_id: string };

    // Poll history until complete (max 5 min)
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const histResp = await fetch(`${BASE_URL}/history/${prompt_id}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!histResp.ok) continue;
      const hist = (await histResp.json()) as Record<string, ComfyHistoryEntry>;
      const entry = hist[prompt_id];
      if (!entry?.outputs) continue;
      // Find the SaveImage output
      for (const nodeOut of Object.values(entry.outputs)) {
        const imgs = nodeOut.images;
        if (!imgs?.length) continue;
        const img = imgs[0];
        if (!img) continue;
        // Fetch the image
        const imgUrl = `${BASE_URL}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
        const imgResp = await fetch(imgUrl, { signal: AbortSignal.timeout(30_000) });
        if (!imgResp.ok) throw new Error(`ComfyUI image fetch failed: ${imgResp.status}`);
        const buffer = Buffer.from(await imgResp.arrayBuffer());
        return {
          buffer,
          mimeType: 'image/png',
          width,
          height,
          provider: 'comfyui',
          model,
          seed,
          prompt: req.prompt,
        };
      }
    }
    throw new Error('ComfyUI generation timed out after 5 minutes');
  }

  async generateImage(req: ImageRequest): Promise<GeneratedMedia> {
    const result = await this.generate({
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      width: req.width,
      height: req.height,
      seed: req.seed,
    });
    return {
      buffer: result.buffer,
      mimeType: result.mimeType,
      ext: result.mimeType === 'image/jpeg' ? 'jpg' : result.mimeType === 'image/webp' ? 'webp' : 'png',
      model: result.model,
      notes: `ComfyUI generated ${result.width}×${result.height}`,
    };
  }
}
