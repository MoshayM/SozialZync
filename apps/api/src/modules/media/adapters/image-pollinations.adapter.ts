import type { ImageAdapter, ImageRequest, GeneratedMedia, ImageVisualStyle } from '../media.types';

/**
 * Pollinations.ai image generation — always available, no API key required.
 * Uses FLUX-family models; style preference selects the best model variant.
 * Free tier, suitable for production use (rate-limited by IP, not credits).
 */

// Map visual style → Pollinations free-tier model (flux-pro returns 402 — paid only)
const STYLE_MODEL: Record<ImageVisualStyle, string> = {
  'ai-best':          'flux-realism',
  realistic:          'flux-realism',
  'hyper-realistic':  'flux-realism',
  cinematic:          'flux-realism',
  documentary:        'flux-realism',
  commercial:         'flux-realism',
  '3d-animation':     'flux-3d',
  cartoon:            'flux-anime',
  anime:              'flux-anime',
  claymation:         'flux-3d',
  'low-poly':         'flux',
  'pixel-art':        'flux',
  watercolor:         'flux',
  'oil-painting':     'flux',
  sketch:             'flux',
  storybook:          'flux',
  'paper-cutout':     'flux',
  'comic-book':       'flux-anime',
  cyberpunk:          'flux-realism',
  'neon-synthwave':   'flux',
  'vintage-retro':    'flux-realism',
  'black-white-noir': 'flux-realism',
  surreal:            'flux',
  minimalist:         'flux',
  'text-carousel':    'flux',
  // Legacy aliases
  animation:          'flux-3d',
  minimal:            'flux',
};

// Style-specific prompt suffixes to anchor generation quality
const STYLE_SUFFIX: Record<ImageVisualStyle, string> = {
  'ai-best':          ', high quality, professional, detailed',
  realistic:          ', photorealistic, DSLR photography, sharp focus, natural lighting',
  'hyper-realistic':  ', hyper-realistic, ultra-detailed, 8K photography, medium format camera',
  cinematic:          ', cinematic shot, anamorphic lens, dramatic color grading, film quality',
  documentary:        ', documentary photography, handheld, natural lighting, candid, photojournalism',
  commercial:         ', commercial photography, studio lighting, product shot, advertising quality',
  '3d-animation':     ', Pixar 3D animation style, smooth shading, studio lighting, high quality render',
  cartoon:            ', flat illustration, bold clean outlines, vibrant colors, vector art',
  anime:              ', anime art style, cel-shaded, expressive eyes, Studio Ghibli quality',
  claymation:         ', claymation stop-motion, clay texture, soft plasticine figures, tactile material',
  'low-poly':         ', low poly art, geometric faceted shapes, flat shading, digital minimalist',
  'pixel-art':        ', pixel art, 8-bit retro game style, chunky pixels, limited colour palette',
  watercolor:         ', watercolor painting, soft fluid washes, paper texture, delicate brushwork',
  'oil-painting':     ', oil painting, thick impasto brushstrokes, rich pigments, classical style',
  sketch:             ', pencil sketch, line art, hatching, hand-drawn illustration',
  storybook:          ', children\'s storybook illustration, warm colours, rounded shapes, picture book',
  'paper-cutout':     ', paper cutout collage, layered flat shapes, shadow casting, craft aesthetic',
  'comic-book':       ', comic book illustration, bold outlines, Ben-Day dots, graphic novel panel',
  cyberpunk:          ', cyberpunk, neon lights, rain-slicked streets, holographic ads, dystopian city',
  'neon-synthwave':   ', synthwave, retrowave, neon purples and pinks, grid landscape, 1980s retro-futurism',
  'vintage-retro':    ', vintage photography, film grain, faded Kodachrome colours, retro analogue',
  'black-white-noir': ', black and white, film noir, high contrast shadows, chiaroscuro, monochrome',
  surreal:            ', surreal dreamscape, dreamlike impossible imagery, ethereal glow, fantasy',
  minimalist:         ', minimalist composition, white space, clean lines, editorial photography',
  'text-carousel':    ', clean slide design, bold typography, minimal background, infographic style',
  // Legacy aliases
  animation:          ', Pixar 3D animation style, smooth shading, studio lighting, high quality render',
  minimal:            ', minimalist composition, white space, clean lines, editorial photography',
};

export class PollinationsImageAdapter implements ImageAdapter {
  readonly name = 'pollinations-image';

  available(): boolean {
    return true; // always available — no API key
  }

  async generateImage(req: ImageRequest): Promise<GeneratedMedia> {
    const style: ImageVisualStyle = (req.style ?? 'ai-best') as ImageVisualStyle;
    const model  = STYLE_MODEL[style]  ?? 'flux-realism';
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
    // Shorter timeouts so failures fall through to OfflineImageAdapter quickly.
    const attempts: Array<{ enhance: boolean; timeoutMs: number }> = [
      { enhance: true,  timeoutMs: 40_000 },
      { enhance: false, timeoutMs: 50_000 },
    ];

    let lastError = '';
    for (const attempt of attempts) {
      try {
        const res = await fetch(buildUrl(attempt.enhance), {
          signal: AbortSignal.timeout(attempt.timeoutMs),
          headers: { Accept: 'image/*' },
        });

        if (!res.ok) {
          const body = await res.text().then(t => t.slice(0, 200)).catch(() => '');
          lastError = `Pollinations ${res.status} ${body}`;
          // 402 = IP rate-limited or paid-only model — retrying the same IP won't help
          if (res.status === 402 || res.status === 403) break;
          // 429 or 5xx — try next attempt (enhance=false is more lenient)
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

    let userMessage: string;
    if (lastError.includes('402') || lastError.includes('403')) {
      userMessage = 'Image generation is temporarily unavailable — the free image service quota is exhausted. Please try again in a few minutes.';
    } else if (/abort|timeout/i.test(lastError)) {
      userMessage = 'Image generation timed out — the image service is taking too long to respond. Please try again.';
    } else {
      userMessage = 'Image generation failed — the image service is temporarily unavailable. Please try again.';
    }
    throw new Error(userMessage);
  }
}
