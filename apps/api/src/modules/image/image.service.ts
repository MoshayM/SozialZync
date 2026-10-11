import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { ImageBriefOutputSchema, type ImageBriefOutput } from '@cf/shared';
import type { ScriptOutput } from '@cf/shared';
import { enhanceImagePrompt, mergeNegativePrompts } from '@cf/shared';
import type { ImageVisualStyle } from '../media/media.types';

const IMAGE_SYSTEM_BASE = `You are a visual content director. Create detailed, vivid image generation briefs for each video section. No real people, no copyrighted IP. Respond only with valid JSON.`;

// Per-style system instruction appended to the base system prompt
const STYLE_SYSTEM: Record<ImageVisualStyle, string> = {
  realistic:
    'Visual style: PHOTOREALISTIC. Every prompt must describe real-world photography — DSLR quality, natural or studio lighting, candid or staged scenes, documentary feel. No illustrated or cartoon elements.',
  cinematic:
    'Visual style: CINEMATIC. Every prompt must feel like a film still — anamorphic wide lens, dramatic color grading, moody lighting, atmospheric depth of field, Hollywood production quality.',
  cartoon:
    'Visual style: CARTOON / ILLUSTRATION. Every prompt must describe a flat-design illustration — bold clean outlines, vibrant solid colors, friendly stylized shapes, vector art aesthetic. No photographic elements.',
  animation:
    'Visual style: 3D ANIMATION. Every prompt must describe a Pixar / DreamWorks-quality 3D render — smooth shading, expressive characters, rich environments, studio lighting rig. Think animated feature film.',
  'text-carousel':
    'Visual style: TEXT CAROUSEL / SLIDE. Every prompt must describe a clean slide design — large bold headline text centered on a minimal gradient background, brand color accents, no characters, pure typography and iconography. Infographic / presentation deck aesthetic.',
  minimal:
    'Visual style: MINIMAL / EDITORIAL. Every prompt must describe a clean, sparse composition — white or muted background, one focal element, soft shadows, editorial magazine feel. No clutter.',
  'ai-best':
    'Choose the BEST visual style for each section individually — cinematic for narrative beats, photorealistic for demonstrations, illustration for abstract concepts, infographic for data points.',
};

// Negative prompts per style to suppress style bleed
const STYLE_NEGATIVE: Record<ImageVisualStyle, string> = {
  realistic:       'cartoon, illustration, painting, anime, 3d render, cgi',
  cinematic:       'amateur, snapshot, flat lighting, cartoon, illustration',
  cartoon:         'photorealistic, photograph, 3d render, blurry, noisy',
  animation:       'photorealistic, photograph, hand-drawn, flat design',
  'text-carousel': 'people, faces, complex backgrounds, busy scenes, photorealistic',
  minimal:         'busy, cluttered, cartoon, illustration, dark',
  'ai-best':       'blurry, low quality, watermark, distorted faces, amateur',
};

// What the style field in each brief should default to (if AI isn't overriding per-section)
const STYLE_BRIEF_VALUE: Record<ImageVisualStyle, string> = {
  realistic:       'photorealistic',
  cinematic:       'cinematic',
  cartoon:         'illustration',
  animation:       'illustration',
  'text-carousel': 'infographic',
  minimal:         'cinematic',
  'ai-best':       'cinematic',
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

      const userContent = `Create image generation briefs for each section of this video.

Title: "${script.title}"
Hook: "${scriptHook}"
Brand style: ${JSON.stringify(brand)}${charNote}${prefsNote}
Visual style requested: ${visualStyle}

Sections:
${sectionsJson}

For EACH section produce one image brief:
- sceneId: "scene-0", "scene-1", etc.
- sectionHeading: the section title
- prompt: A vivid 2-3 sentence visual description in the ${visualStyle} style. Include exact setting, lighting, colors, camera angle, emotional mood. Make it HIGHLY SPECIFIC — no generic descriptions. Reference characters by appearance/role (not real names). NO real people, celebrities, brands, or copyrighted characters.
- negativePrompt: "${styleNeg}, blurry, low quality, watermark, distorted"
- ${styleInstruction}
- aspectRatio: "16:9"
- count: 1
- purpose: "b-roll" for story scenes, "diagram" for explanation, "thumbnail-candidate" for the most striking scene`;

      const raw = await callAIStructured(
        [{ role: 'user', content: userContent }],
        ImageBriefOutputSchema,
        { systemPrompt, maxTokens: 4096 },
      ) as ImageBriefOutput;

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
