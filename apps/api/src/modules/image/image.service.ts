import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { ImageBriefOutputSchema, type ImageBriefOutput } from '@cf/shared';
import type { ScriptOutput } from '@cf/shared';
import { enhanceImagePrompt, mergeNegativePrompts } from '@cf/shared';
import type { ImageVisualStyle } from '../media/media.types';

const IMAGE_SYSTEM_BASE = `You are a visual content director. Create detailed, vivid image generation briefs for each video section. No real people, no copyrighted IP. Respond only with valid JSON.`;

// Per-style system instruction appended to the base system prompt
const STYLE_SYSTEM: Record<ImageVisualStyle, string> = {
  // Auto
  'ai-best':         'Choose the BEST visual style for each section individually — cinematic for narrative beats, photorealistic for demonstrations, illustration for abstract concepts, infographic for data points.',
  // Realistic & Cinematic
  realistic:         'Visual style: PHOTOREALISTIC. Every prompt must describe real-world photography — DSLR quality, natural or studio lighting, candid or staged scenes, documentary feel. No illustrated or cartoon elements.',
  'hyper-realistic': 'Visual style: HYPER-REALISTIC. Every prompt must describe extreme photographic detail — macro textures, ultra-sharp focus, true-to-life colours, shot as if with a medium-format camera or high-end cinema rig.',
  cinematic:         'Visual style: CINEMATIC. Every prompt must feel like a film still — anamorphic wide lens, dramatic color grading, moody lighting, atmospheric depth of field, Hollywood production quality.',
  documentary:       'Visual style: DOCUMENTARY. Every prompt must feel like real-world journalism — handheld natural-light photography, candid subjects, gritty authenticity, reportage aesthetic. No staged or overly polished looks.',
  commercial:        'Visual style: COMMERCIAL / ADVERTISING. Every prompt must look like a high-budget product advertisement — studio lighting, perfect composition, clean white or gradient background, aspirational lifestyle feel.',
  // Animation & 3D
  '3d-animation':    'Visual style: 3D ANIMATION. Every prompt must describe a Pixar / DreamWorks-quality 3D render — smooth shading, expressive characters, rich environments, studio lighting rig. Think animated feature film.',
  cartoon:           'Visual style: CARTOON / ILLUSTRATION. Every prompt must describe a flat-design illustration — bold clean outlines, vibrant solid colors, friendly stylized shapes, vector art aesthetic. No photographic elements.',
  anime:             'Visual style: ANIME / MANGA. Every prompt must describe a Japanese animation art style — cel-shaded colouring, expressive eyes, dynamic action lines, vibrant palette, Studio Ghibli or Makoto Shinkai quality.',
  claymation:        'Visual style: CLAYMATION / STOP-MOTION. Every prompt must look hand-crafted from clay — tactile bumpy textures, soft plasticine shaping, warm colour palettes, studio lighting on 3D clay figures.',
  'low-poly':        'Visual style: LOW POLY / GEOMETRIC. Every prompt must use faceted geometric forms — visible triangular polygons, flat shading, vibrant solid colours, digital minimalist art aesthetic.',
  'pixel-art':       'Visual style: PIXEL ART / 8-BIT. Every prompt must look like retro game graphics — chunky square pixels, limited colour palette, crisp edges, 8-bit or 16-bit video game aesthetic.',
  // Artistic & Illustrated
  watercolor:        'Visual style: WATERCOLOR PAINTING. Every prompt must describe a traditional watercolor artwork — soft fluid edges, translucent colour washes, visible paper texture, delicate brushwork.',
  'oil-painting':    'Visual style: OIL PAINTING. Every prompt must describe a traditional oil painting — thick impasto brushstrokes, rich saturated pigments, classical Old Masters or impressionist style.',
  sketch:            'Visual style: SKETCH / LINE ART. Every prompt must describe a hand-drawn pencil or ink sketch — clean linework, minimal colour, hatching for shadow, architectural or editorial illustration feel.',
  storybook:         'Visual style: STORYBOOK / CHILDREN\'S ILLUSTRATION. Every prompt must describe warm, inviting book illustration — soft rounded shapes, pastel or saturated colours, friendly characters, picture-book aesthetic.',
  'paper-cutout':    'Visual style: PAPER CUTOUT / COLLAGE. Every prompt must look like layered paper cut-outs — flat silhouettes, torn or cut edges, shadow casting between layers, craft collage aesthetic.',
  'comic-book':      'Visual style: COMIC BOOK / GRAPHIC NOVEL. Every prompt must use comic illustration — bold black outlines, Ben-Day dot shading, speech-bubble panel framing, dynamic superhero or graphic-novel composition.',
  // Stylized & Creative
  cyberpunk:         'Visual style: CYBERPUNK. Every prompt must feel like a neon-drenched dystopian city — rain-slicked streets, holographic advertisements, dark alleys, blue and magenta neon glow, high-tech low-life aesthetic.',
  'neon-synthwave':  'Visual style: NEON / SYNTHWAVE / RETROWAVE. Every prompt must use a 1980s retro-futurist aesthetic — electric purple and hot pink neons, grid landscapes, chrome reflections, VHS scanlines, outrun vibes.',
  'vintage-retro':   'Visual style: VINTAGE / RETRO. Every prompt must evoke mid-century nostalgia — faded film grain, warm sepia or Kodachrome colours, vintage typography, analogue imperfections.',
  'black-white-noir': 'Visual style: BLACK & WHITE / FILM NOIR. Every prompt must be monochrome — stark contrast, dramatic shadows, chiaroscuro lighting, classic detective thriller or fine-art photography feel.',
  surreal:           'Visual style: SURREAL / DREAMY. Every prompt must describe dreamlike, impossible imagery — Dalí-esque melting objects, floating elements, double-exposed scenes, soft ethereal glow, fantasy atmosphere.',
  minimalist:        'Visual style: MINIMALIST / EDITORIAL. Every prompt must describe a clean, sparse composition — white or muted background, one focal element, soft shadows, editorial magazine feel. No clutter.',
  'text-carousel':   'Visual style: TEXT CAROUSEL / SLIDE. Every prompt must describe a clean slide design — large bold headline text centered on a minimal gradient background, brand color accents, no characters, pure typography and iconography. Infographic / presentation deck aesthetic.',
  // Legacy aliases
  animation:         'Visual style: 3D ANIMATION. Every prompt must describe a Pixar / DreamWorks-quality 3D render — smooth shading, expressive characters, rich environments, studio lighting rig. Think animated feature film.',
  minimal:           'Visual style: MINIMAL / EDITORIAL. Every prompt must describe a clean, sparse composition — white or muted background, one focal element, soft shadows, editorial magazine feel. No clutter.',
};

// Negative prompts per style to suppress style bleed
const STYLE_NEGATIVE: Record<ImageVisualStyle, string> = {
  'ai-best':          'blurry, low quality, watermark, distorted faces, amateur',
  realistic:          'cartoon, illustration, painting, anime, 3d render, cgi',
  'hyper-realistic':  'cartoon, illustration, painting, anime, blurry, low quality',
  cinematic:          'amateur, snapshot, flat lighting, cartoon, illustration',
  documentary:        'posed, studio lighting, illustration, cartoon, over-edited',
  commercial:         'amateur, clutter, dark, messy, low quality',
  '3d-animation':     'photorealistic, photograph, hand-drawn, flat design',
  cartoon:            'photorealistic, photograph, 3d render, blurry, noisy',
  anime:              'photorealistic, western cartoon, 3d render, blurry',
  claymation:         'digital, photorealistic, flat design, anime',
  'low-poly':         'photorealistic, smooth shading, detailed textures, blurry',
  'pixel-art':        'photorealistic, smooth gradients, high resolution details, blur',
  watercolor:         'photorealistic, digital sharp, 3d render, anime',
  'oil-painting':     'photorealistic, digital, anime, cartoon, sketch',
  sketch:             'colour, photorealistic, 3d render, painted',
  storybook:          'dark, photorealistic, scary, complex details',
  'paper-cutout':     'photorealistic, smooth, 3d render, digital painting',
  'comic-book':       'photorealistic, watercolour, anime, sketch',
  cyberpunk:          'bright daylight, clean, suburban, countryside, pastel',
  'neon-synthwave':   'daylight, natural lighting, muted colours, realism',
  'vintage-retro':    'modern, digital, sharp, high saturation, clean',
  'black-white-noir': 'colour, vibrant, saturated, bright',
  surreal:            'realistic, mundane, ordinary, photographic',
  minimalist:         'busy, cluttered, cartoon, illustration, dark',
  'text-carousel':    'people, faces, complex backgrounds, busy scenes, photorealistic',
  // Legacy aliases
  animation:          'photorealistic, photograph, hand-drawn, flat design',
  minimal:            'busy, cluttered, cartoon, illustration, dark',
};

// What the style field in each brief should default to (if AI isn't overriding per-section)
const STYLE_BRIEF_VALUE: Record<ImageVisualStyle, string> = {
  'ai-best':          'cinematic',
  realistic:          'photorealistic',
  'hyper-realistic':  'hyper-realistic photography',
  cinematic:          'cinematic',
  documentary:        'documentary photography',
  commercial:         'commercial photography',
  '3d-animation':     '3D animation',
  cartoon:            'illustration',
  anime:              'anime illustration',
  claymation:         'claymation',
  'low-poly':         'low poly art',
  'pixel-art':        'pixel art',
  watercolor:         'watercolor painting',
  'oil-painting':     'oil painting',
  sketch:             'pencil sketch',
  storybook:          'storybook illustration',
  'paper-cutout':     'paper cutout collage',
  'comic-book':       'comic book illustration',
  cyberpunk:          'cyberpunk',
  'neon-synthwave':   'synthwave',
  'vintage-retro':    'vintage photography',
  'black-white-noir': 'black and white film noir',
  surreal:            'surreal dreamscape',
  minimalist:         'minimalist editorial',
  'text-carousel':    'infographic',
  // Legacy aliases
  animation:          'illustration',
  minimal:            'cinematic',
};

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  async generateBriefs(
    script: ScriptOutput,
    projectId: string,
    brandKit?: Record<string, unknown>,
    prefs?: Record<string, string>,
    visualStyle: ImageVisualStyle = 'ai-best',
  ): Promise<ImageBriefOutput> {
    this.logger.log(`Generating image briefs — projectId="${projectId}" sections=${script.sections.length} style=${visualStyle}`);
    const brand = brandKit ?? { colorPalette: ['#1a1a2e', '#16213e', '#0f3460'], fontStyle: 'modern', visualMood: 'professional' };

    const styleSystemNote = STYLE_SYSTEM[visualStyle] ?? STYLE_SYSTEM['ai-best'];
    const styleNeg = STYLE_NEGATIVE[visualStyle] ?? STYLE_NEGATIVE['ai-best'];
    const defaultBriefStyle = STYLE_BRIEF_VALUE[visualStyle] ?? 'cinematic';
    const systemPrompt = `${IMAGE_SYSTEM_BASE}\n\n${styleSystemNote}`;

    try {
      const sectionsJson = JSON.stringify(
        script.sections.map((s, i) => ({ id: `scene-${i}`, heading: s.heading, content: s.content.slice(0, 400) })),
      );
      const scriptHook = (script as { hook?: string }).hook ?? '';
      const charNote = (() => {
        const chars = (script as { characters?: Array<{ name: string; description?: string }> }).characters;
        return chars?.length ? `\nCharacters: ${chars.map(c => `${c.name}${c.description ? ` (${c.description})` : ''}`).join(', ')}.` : '';
      })();

      const prefsNote = prefs && Object.keys(prefs).length > 0
        ? `\nCreator preferences: ${[
            prefs['videoStyle'] ? `video style=${prefs['videoStyle']}` : '',
            prefs['tone'] ? `tone=${prefs['tone']}` : '',
            prefs['notes'] ? `notes: ${prefs['notes']}` : '',
          ].filter(Boolean).join(', ')}.`
        : '';

      const styleInstruction = visualStyle === 'ai-best'
        ? `style: choose "cinematic" for narrative, "photorealistic" for demonstrations, "infographic" for data/stats, "illustration" for abstract concepts`
        : `style: always use "${defaultBriefStyle}" (user selected ${visualStyle} style)`;

      const userContent = `Create image generation briefs for each section of this video. Return ONLY a JSON object with this exact structure — no other keys, no markdown:

{
  "briefs": [
    {
      "sceneId": "scene-0",
      "sectionHeading": "section title here",
      "prompt": "vivid 2-3 sentence visual description",
      "negativePrompt": "things to avoid",
      "style": "cinematic",
      "aspectRatio": "16:9",
      "count": 1,
      "purpose": "b-roll"
    }
  ]
}

Video details:
Title: "${script.title}"
Hook: "${scriptHook}"
Brand style: ${JSON.stringify(brand)}${charNote}${prefsNote}
Visual style requested: ${visualStyle}

Sections (produce exactly one brief per section):
${sectionsJson}

Rules for each brief:
- sceneId: "scene-0", "scene-1", ... (incrementing, matching section order)
- sectionHeading: copy the section heading exactly
- prompt: A vivid 2-3 sentence visual description in the ${visualStyle} style. Include setting, lighting, colors, camera angle, emotional mood. HIGHLY SPECIFIC — no generic descriptions. Reference characters by appearance/role not real names. NO real people, celebrities, brands, or copyrighted characters.
- negativePrompt: "${styleNeg}, blurry, low quality, watermark, distorted"
- ${styleInstruction}
- aspectRatio: "16:9"
- count: 1
- purpose: "b-roll" for story/narrative scenes, "diagram" for data/explanation scenes, "thumbnail-candidate" for the single most visually striking scene

Produce exactly ${script.sections.length} brief(s) — one per section. The top-level key MUST be "briefs".`;

      const raw = await callAIStructured(
        [{ role: 'user', content: userContent }],
        ImageBriefOutputSchema,
        { systemPrompt, maxTokens: 2048 },
      ) as ImageBriefOutput;

      // Explicit guard: if the AI returned valid JSON but wrong key name, briefs will be [].
      // Throw early with a clear message rather than silently storing empty results.
      if (!raw.briefs || raw.briefs.length === 0) {
        throw new Error(
          `AI returned 0 image briefs for ${script.sections.length} section(s). ` +
          `The model may have used a different JSON key. Retry to get a fresh response.`,
        );
      }

      return {
        ...raw,
        briefs: raw.briefs.map(brief => {
          const { prompt, negativePrompt } = enhanceImagePrompt(brief.prompt, { style: brief.style });
          return {
            ...brief,
            prompt,
            negativePrompt: mergeNegativePrompts(
              mergeNegativePrompts(brief.negativePrompt, negativePrompt),
              styleNeg,
            ),
          };
        }),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Image briefs failed — ${msg}`);
      throw new InternalServerErrorException(`Image brief generation failed: ${msg}`);
    }
  }
}
