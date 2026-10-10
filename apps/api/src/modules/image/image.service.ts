import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { ImageBriefOutputSchema, type ImageBriefOutput } from '@cf/shared';
import type { ScriptOutput } from '@cf/shared';
import { enhanceImagePrompt, mergeNegativePrompts } from '@cf/shared';

const IMAGE_SYSTEM = `You are a visual content director for YouTube. Create detailed image generation briefs. No real people, no copyrighted IP. Respond only with valid JSON.`;

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  async generateBriefs(script: ScriptOutput, projectId: string, brandKit?: Record<string, unknown>, prefs?: Record<string, string>): Promise<ImageBriefOutput> {
    this.logger.log(`Generating image briefs — projectId="${projectId}" sections=${script.sections.length}`);
    const brand = brandKit ?? { colorPalette: ['#1a1a2e', '#16213e', '#0f3460'], fontStyle: 'modern', visualMood: 'professional' };

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

      const userContent = `Create image generation briefs for each section of this YouTube video.

Title: "${script.title}"
Hook: "${scriptHook}"
Brand style: ${JSON.stringify(brand)}${charNote}${prefsNote}

Sections:
${sectionsJson}

For EACH section produce one image brief:
- sceneId: "scene-0", "scene-1", etc.
- sectionHeading: the section title
- prompt: A vivid 2-3 sentence visual description. Include exact setting, lighting, colors, camera angle, emotional mood. Represent the section's MESSAGE visually. Reference characters by appearance/role (not real names). NO real people, celebrities, brands, or copyrighted characters.
- negativePrompt: "blurry, low quality, watermark, text overlay, distorted faces, amateur"
- style: "cinematic" for narrative, "photorealistic" for how-to, "infographic" for data/stats, "illustration" for abstract concepts
- aspectRatio: "16:9"
- count: 1
- purpose: "b-roll" for story scenes, "diagram" for explanation, "thumbnail-candidate" for the most striking scene`;

      const raw = await callAIStructured(
        [{ role: 'user', content: userContent }],
        ImageBriefOutputSchema,
        { systemPrompt: IMAGE_SYSTEM, maxTokens: 4096 },
      ) as ImageBriefOutput;

      // Enhance each brief with cinematic/realism directives before the prompts
      // reach image generation APIs — improves visual authenticity at zero extra cost.
      return {
        ...raw,
        briefs: raw.briefs.map(brief => {
          const { prompt, negativePrompt } = enhanceImagePrompt(brief.prompt, { style: brief.style });
          return {
            ...brief,
            prompt,
            negativePrompt: mergeNegativePrompts(brief.negativePrompt, negativePrompt),
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
