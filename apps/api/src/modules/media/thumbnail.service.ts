import { Injectable, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { z } from 'zod';

const ThumbnailPromptSchema = z.object({
  prompts: z.array(z.object({
    style: z.string(),
    prompt: z.string(),
    negativePrompt: z.string().optional(),
    reasoning: z.string(),
  })).min(1).max(4),
  suggestedTitle: z.string(),
  suggestedSubtitle: z.string().optional(),
  colorPalette: z.array(z.string()).optional(),
});

type ThumbnailPrompts = z.infer<typeof ThumbnailPromptSchema>;

export interface ThumbnailGenerationResult {
  prompts: ThumbnailPrompts['prompts'];
  suggestedTitle: string;
  suggestedSubtitle?: string;
  colorPalette?: string[];
  imageUrls: string[];
}

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  async generatePrompts(input: {
    videoTitle: string;
    scriptExcerpt: string;
    channelTopic?: string;
    style?: 'bold' | 'minimal' | 'dramatic' | 'educational' | 'vlog';
  }): Promise<ThumbnailPrompts> {
    const { videoTitle, scriptExcerpt, channelTopic = 'YouTube', style = 'bold' } = input;
    return callAIStructured(
      [{
        role: 'user',
        content: `Generate 3-4 YouTube thumbnail image prompts for this video.

Video title: "${videoTitle}"
Channel topic: ${channelTopic}
Preferred style: ${style}
Script excerpt: "${scriptExcerpt.slice(0, 400)}"

Rules:
- Each prompt must describe a compelling YouTube thumbnail scene (no text in image — text is added as overlay later)
- Use vivid, descriptive language optimized for AI image generation
- Include lighting, composition, and subject details
- Vary the styles across prompts (e.g. photorealistic, illustration, flat design, cinematic)
- Suggest a punchy YouTube title (max 60 chars) and optional subtitle

You MUST return ONLY a valid JSON object with this EXACT structure — no other keys allowed:
{
  "prompts": [
    {
      "style": "photorealistic",
      "prompt": "detailed AI image generation prompt here",
      "negativePrompt": "blurry, text, watermark",
      "reasoning": "why this visual style works for this video"
    }
  ],
  "suggestedTitle": "Punchy Title Here (max 60 chars)",
  "suggestedSubtitle": "Optional subtitle",
  "colorPalette": ["#hex1", "#hex2", "#hex3"]
}`,
      }],
      ThumbnailPromptSchema,
      { maxTokens: 1500 },
    );
  }

  async generateImages(prompts: string[]): Promise<string[]> {
    const openaiKey = process.env['OPENAI_API_KEY'];

    // Premium path: DALL-E 3 when OpenAI key is configured
    if (openaiKey) {
      const results: string[] = [];
      for (const prompt of prompts.slice(0, 2)) {
        try {
          const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: `YouTube thumbnail background image (no text). ${prompt}`,
              n: 1,
              size: '1792x1024',
              quality: 'standard',
              style: 'vivid',
            }),
          });
          if (res.ok) {
            const data = await res.json() as { data: Array<{ url: string }> };
            if (data.data[0]?.url) results.push(data.data[0].url);
          }
        } catch (err) {
          this.logger.warn('DALL-E generation failed, falling back to free provider', err);
        }
      }
      if (results.length) return results;
    }

    // Free fallback: Pollinations.ai — no API key, no cost
    // Each URL is an on-demand image endpoint; the browser fetches the actual image
    this.logger.log('Using Pollinations.ai (free) for thumbnail image generation');
    const seed = Date.now();
    return prompts.slice(0, 3).map((prompt, i) => {
      const text = `YouTube thumbnail background (no text overlay). ${prompt}`;
      const encoded = encodeURIComponent(text);
      return `https://image.pollinations.ai/prompt/${encoded}?width=1792&height=1024&nologo=true&model=flux&seed=${seed + i}`;
    });
  }

  async generate(input: {
    videoTitle: string;
    scriptExcerpt: string;
    channelTopic?: string;
    style?: 'bold' | 'minimal' | 'dramatic' | 'educational' | 'vlog';
    generateImages?: boolean;
  }): Promise<ThumbnailGenerationResult> {
    const prompts = await this.generatePrompts(input);
    const imageUrls = input.generateImages !== false
      ? await this.generateImages(prompts.prompts.map(p => p.prompt))
      : [];
    return {
      prompts: prompts.prompts,
      suggestedTitle: prompts.suggestedTitle,
      suggestedSubtitle: prompts.suggestedSubtitle,
      colorPalette: prompts.colorPalette,
      imageUrls,
    };
  }
}
