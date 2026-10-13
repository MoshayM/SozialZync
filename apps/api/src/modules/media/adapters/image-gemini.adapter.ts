import type { ImageAdapter, ImageRequest, GeneratedMedia, ImageVisualStyle } from '../media.types';

// Gemini image generation — free tier via generateContent with IMAGE modality.
// IMAGE_GEMINI_MODEL env override pins a specific model (e.g. imagen-3.0-generate-002).
// Without override: probes candidates in order — Google retires preview model names frequently.
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_IMAGE_MODELS: string[] = [
  process.env['IMAGE_GEMINI_MODEL'] ?? '',
  'gemini-2.0-flash-exp',                      // experimental, supports IMAGE modality
  'gemini-2.0-flash',                          // stable channel (may support image output)
  'gemini-2.0-flash-preview-image-generation', // old preview name (frequently 404s)
  'gemini-1.5-flash',                          // last-resort fallback
].filter(Boolean);

const STYLE_SUFFIX: Record<ImageVisualStyle, string> = {
  'ai-best':          ', high quality, professional, highly detailed, award-winning photography',
  realistic:          ', photorealistic, DSLR photography, sharp focus, natural lighting, 8K',
  'hyper-realistic':  ', hyper-realistic, ultra-detailed, 8K photography, medium format camera, perfect sharpness',
  cinematic:          ', cinematic shot, anamorphic lens, dramatic color grading, film quality',
  documentary:        ', documentary photography, handheld, natural lighting, candid, photojournalism',
  commercial:         ', commercial photography, studio lighting, product advertisement, aspirational quality',
  '3d-animation':     ', Pixar 3D animation style, smooth shading, studio lighting, high quality render',
  cartoon:            ', flat illustration, bold clean outlines, vibrant colors, vector art style',
  anime:              ', anime art style, cel-shaded, expressive eyes, Studio Ghibli quality',
  claymation:         ', claymation stop-motion, clay texture, soft plasticine figures, tactile material',
  'low-poly':         ', low poly art, geometric faceted shapes, flat shading, digital minimalist art',
  'pixel-art':        ', pixel art, 8-bit retro game style, chunky pixels, limited colour palette',
  watercolor:         ', watercolor painting, soft fluid washes, visible paper texture, delicate brushwork',
  'oil-painting':     ', oil painting, thick impasto brushstrokes, rich saturated pigments, classical style',
  sketch:             ', pencil sketch, clean linework, hatching for shadow, hand-drawn illustration',
  storybook:          ', children\'s storybook illustration, warm colours, rounded shapes, picture book aesthetic',
  'paper-cutout':     ', paper cutout collage, layered flat shapes, shadow between layers, craft aesthetic',
  'comic-book':       ', comic book illustration, bold black outlines, Ben-Day dot shading, graphic novel panel',
  cyberpunk:          ', cyberpunk, neon lights, rain-slicked streets, holographic advertisements, dystopian city',
  'neon-synthwave':   ', synthwave retrowave, neon purple and pink, grid landscape, 1980s retro-futurism, VHS',
  'vintage-retro':    ', vintage photography, film grain, faded Kodachrome colours, retro analogue aesthetic',
  'black-white-noir': ', black and white film noir, high contrast, dramatic shadows, chiaroscuro lighting',
  surreal:            ', surreal dreamscape, impossible imagery, ethereal glow, Dalí-inspired, fantasy atmosphere',
  minimalist:         ', minimalist composition, white space, clean lines, editorial photography',
  'text-carousel':    ', clean slide design, bold typography, minimal background, infographic style',
  // Legacy aliases
  animation:          ', Pixar 3D animation style, smooth shading, studio lighting, high quality render',
  minimal:            ', minimalist composition, white space, clean lines, editorial photography',
};

// Imagen 3 aspect-ratio mapping
const ASPECT_RATIO = (w: number, h: number): string => {
  const r = w / h;
  if (r >= 1.7) return '16:9';
  if (r >= 1.2) return '4:3';
  if (r >= 0.9) return '1:1';
  if (r >= 0.7) return '3:4';
  return '9:16';
};

/** Real image generation via Gemini — active whenever GEMINI_API_KEY is set. */
export class GeminiImageAdapter implements ImageAdapter {
  readonly name = 'gemini-image';

  private authFailed = false;

  available(): boolean {
    return !this.authFailed && !!process.env['GEMINI_API_KEY'];
  }

  // Track the last model that worked to skip retrying failed ones
  private workingModel: string | null = null;

  async generateImage(req: ImageRequest): Promise<GeneratedMedia> {
    const style: ImageVisualStyle = (req.style ?? 'ai-best') as ImageVisualStyle;
    const suffix = STYLE_SUFFIX[style] ?? '';
    const fullPrompt = req.negativePrompt
      ? `${req.prompt}${suffix}. Avoid: ${req.negativePrompt}`
      : `${req.prompt}${suffix}`;

    const key = process.env['GEMINI_API_KEY']!;

    // Imagen models use /predict; everything else uses /generateContent
    const candidates = this.workingModel
      ? [this.workingModel, ...GEMINI_IMAGE_MODELS.filter((m) => m !== this.workingModel)]
      : GEMINI_IMAGE_MODELS;

    let lastErr = '';
    for (const model of candidates) {
      try {
        let result: GeneratedMedia;
        if (model.startsWith('imagen')) {
          result = await this.generateViaImagen(fullPrompt, req, model, key);
        } else {
          result = await this.generateViaGeminiFlash(fullPrompt, model, key);
        }
        this.workingModel = model;
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastErr = msg;
        // 404 = model not found or not supported — try next candidate
        if (msg.includes('404') || /not found|not supported/i.test(msg)) continue;
        // Auth / rate-limit: propagate immediately
        throw err;
      }
    }
    throw new Error(`Gemini image generation failed (tried ${candidates.length} models): ${lastErr}`);
  }

  /** Gemini 2.0 Flash image generation — free tier */
  private async generateViaGeminiFlash(prompt: string, model: string, key: string): Promise<GeneratedMedia> {
    let lastErr = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${API_BASE}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
        signal: AbortSignal.timeout(90_000),
      });

      if (res.status === 401 || res.status === 403) {
        this.authFailed = true;
        throw new Error(`Gemini auth failed: ${res.status}`);
      }
      if (res.status === 429) {
        const body = await res.text();
        const delayMatch = /"retryDelay"\s*:\s*"(\d+)/.exec(body);
        const waitMs = Math.min((delayMatch ? Number(delayMatch[1]) : 60) * 1000 + 2000, 90_000);
        if (attempt < 2) { await new Promise((r) => setTimeout(r, waitMs)); continue; }
        lastErr = `Gemini rate limit after ${attempt + 1} attempts`;
        break;
      }
      if (!res.ok) {
        lastErr = `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`;
        break;
      }

      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
      };
      const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!inline?.data) { lastErr = 'Gemini returned no image data'; break; }

      const mimeType = (inline.mimeType ?? 'image/png') as 'image/png' | 'image/jpeg';
      return {
        buffer: Buffer.from(inline.data, 'base64'),
        mimeType,
        ext: mimeType.includes('jpeg') ? 'jpg' : 'png',
        model,
      };
    }
    throw new Error(`Gemini Flash image generation failed: ${lastErr}`);
  }

  /** Imagen 3 via /predict — requires billing enabled */
  private async generateViaImagen(prompt: string, req: ImageRequest, model: string, key: string): Promise<GeneratedMedia> {
    const aspectRatio = ASPECT_RATIO(req.width, req.height);
    let lastErr = '';

    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${API_BASE}/${model}:predict?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            safetyFilterLevel: 'block_few',
            personGeneration: 'allow_adult',
          },
        }),
        signal: AbortSignal.timeout(90_000),
      });

      if (res.status === 401 || res.status === 403) {
        this.authFailed = true;
        throw new Error(`Imagen auth failed: ${res.status}`);
      }
      if (res.status === 429) {
        const body = await res.text();
        const delayMatch = /"retryDelay"\s*:\s*"(\d+)/.exec(body);
        const waitMs = Math.min((delayMatch ? Number(delayMatch[1]) : 60) * 1000 + 2000, 90_000);
        if (attempt < 2) { await new Promise((r) => setTimeout(r, waitMs)); continue; }
        lastErr = `Imagen rate limit`;
        break;
      }
      if (!res.ok) {
        lastErr = `Imagen ${res.status}: ${(await res.text()).slice(0, 200)}`;
        break;
      }

      const json = (await res.json()) as {
        predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
      };
      const pred = json.predictions?.[0];
      if (!pred?.bytesBase64Encoded) { lastErr = 'Imagen returned no image data'; break; }

      const mimeType = (pred.mimeType ?? 'image/png') as 'image/png' | 'image/jpeg';
      return {
        buffer: Buffer.from(pred.bytesBase64Encoded, 'base64'),
        mimeType,
        ext: mimeType.includes('jpeg') ? 'jpg' : 'png',
        model,
      };
    }
    throw new Error(`Imagen 3 image generation failed: ${lastErr}`);
  }
}
