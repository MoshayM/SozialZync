import type { ImageAdapter, ImageRequest, GeneratedMedia, ImageVisualStyle } from '../media.types';

/**
 * Pollinations.ai image generation — always available, no API key required.
 * Uses FLUX-family models; style preference selects the best model variant.
 * Free tier, suitable for production use (rate-limited by IP, not credits).
 */

// Map visual style → Pollinations model that produces the best output
const STYLE_MODEL: Record<ImageVisualStyle, string> = {
  realistic:       'flux-realism',
  cinematic:       'flux-pro',
  cartoon:         'flux-anime',
  animation:       'flux-3d',
  'text-carousel': 'flux',
  minimal:         'flux-pro',
  'ai-best':       'flux-pro',
};

// Style-specific prompt suffixes to anchor generation quality
const STYLE_SUFFIX: Record<ImageVisualStyle, string> = {
  realistic:       ', photorealistic, DSLR photography, sharp focus, natural lighting',
  cinematic:       ', cinematic shot, anamorphic lens, dramatic color grading, film quality',
  cartoon:         ', flat illustration, bold clean outlines, vibrant colors, vector art',
  animation:       ', Pixar 3D animation style, smooth shading, studio lighting, high quality render',
  'text-carousel': ', clean slide design, bold typography, minimal background, infographic style',
  minimal:         ', minimalist composition, white space, clean lines, editorial photography',
  'ai-best':       ', high quality, professional, detailed',
};

export class PollinationsImageAdapter implements ImageAdapter {
  readonly name = 'pollinations-image';

  available(): boolean {
    return true; // always available — no API key
  }

  async generateImage(req: ImageRequest): Promise<GeneratedMedia> {
    const style: ImageVisualStyle = (req.style ?? 'ai-best') as ImageVisualStyle;
    const model  = STYLE_MODEL[style]  ?? 'flux-pro';
    const suffix = STYLE_SUFFIX[style] ?? '';

    const fullPrompt = req.negativePrompt
      ? `${req.prompt}${suffix}. Avoid: ${req.negativePrompt}`
      : `${req.prompt}${suffix}`;

    const buildUrl = (enhance: boolean): string => {
      const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}`);
      url.searchParams.set('width',   String(req.width));
      url.searchParams.set('height',  String(req.height));
      url.searchParams.set('model',   model);
      url.searchParams.set('nologo',  'true');
      url.searchParams.set('enhance', String(enhance));
      if (req.seed !== undefined) url.searchParams.set('seed', String(req.seed));
      return url.toString();
    };

    // Attempt 1: enhance=true (better prompt expansion, but slower)
    // Attempt 2: enhance=false (direct, more reliable on rate-limited IPs)
    const attempts: Array<{ enhance: boolean; timeoutMs: number }> = [
      { enhance: true,  timeoutMs: 75_000 },
      { enhance: false, timeoutMs: 90_000 },
    ];

    let lastError = '';
    for (const attempt of attempts) {
      try {
        const res = await fetch(buildUrl(attempt.enhance), {
          signal: AbortSignal.timeout(attempt.timeoutMs),
          headers: { Accept: 'image/*' },
        });

        if (!res.ok) {
          lastError = `Pollinations ${res.status} ${await res.text().then(t => t.slice(0, 200)).catch(() => '')}`;
          // 429 on this IP — no point retrying with same enhance flag; try without
          continue;
        }

        const contentType = res.headers.get('content-type') ?? 'image/jpeg';
        // Guard against HTML error pages served with 200
        if (!contentType.startsWith('image/')) {
          lastError = `Pollinations returned non-image content-type: ${contentType}`;
          continue;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 2048) {
          lastError = `Pollinations returned suspiciously small buffer (${buffer.length} bytes)`;
          continue;
        }

        const ext = contentType.includes('png') ? 'png' : 'jpg';
        return {
          buffer,
          mimeType: contentType as 'image/png' | 'image/jpeg',
          ext,
          model: `pollinations-${model}`,
          notes: attempt.enhance ? undefined : 'Generated with enhance=false (retry path)',
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // AbortError = timeout — try next attempt
      }
    }

    throw new Error(`Pollinations image generation failed after ${attempts.length} attempts: ${lastError}`);
  }
}
