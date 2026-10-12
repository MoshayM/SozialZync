import type { ImageAdapter, ImageRequest, GeneratedMedia, ImageVisualStyle } from '../media.types';

// Gemini 2.0 Flash image generation — free tier, no billing required
// Set IMAGE_GEMINI_MODEL=imagen-3.0-generate-002 to use Imagen 3 (requires billing)
const DEFAULT_MODEL = process.env['IMAGE_GEMINI_MODEL'] ?? 'gemini-2.0-flash-preview-image-generation';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const STYLE_SUFFIX: Record<ImageVisualStyle, string> = {
  realistic:       ', photorealistic, DSLR photography, sharp focus, natural lighting, 8K',
  cinematic:       ', cinematic shot, anamorphic lens, dramatic color grading, film quality',
  cartoon:         ', flat illustration, bold clean outlines, vibrant colors, vector art style',
  animation:       ', Pixar 3D animation style, smooth shading, studio lighting, high quality render',
  'text-carousel': ', clean slide design, bold typography, minimal background, infographic style',
  minimal:         ', minimalist composition, white space, clean lines, editorial photography',
  'ai-best':       ', high quality, professional, highly detailed, award-winning photography',
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

  async generateImage(req: ImageRequest): Promise<GeneratedMedia> {
    const style: ImageVisualStyle = (req.style ?? 'ai-best') as ImageVisualStyle;
    const suffix = STYLE_SUFFIX[style] ?? '';
    const fullPrompt = req.negativePrompt
      ? `${req.prompt}${suffix}. Avoid: ${req.negativePrompt}`
      : `${req.prompt}${suffix}`;

    const model = DEFAULT_MODEL;
    const key = process.env['GEMINI_API_KEY']!;

    // Imagen 3 uses /predict; Gemini Flash uses /generateContent
    const isImagen = model.startsWith('imagen');

    if (isImagen) {
      return this.generateViaImagen(fullPrompt, req, model, key);
    }
    return this.generateViaGeminiFlash(fullPrompt, model, key);
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
