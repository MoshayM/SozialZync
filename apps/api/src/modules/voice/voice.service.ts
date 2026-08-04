import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { VoiceSpecOutputSchema, type VoiceSpecOutput } from '@cf/shared';
import type { ScriptOutput } from '@cf/shared';
import { z } from 'zod';

const VOICE_SYSTEM = `You are a professional voice direction specialist for YouTube narration. Create detailed TTS specifications. Respond only with valid JSON.`;

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  async generateSpec(script: ScriptOutput, projectId: string, voiceProfile?: Record<string, unknown>): Promise<VoiceSpecOutput> {
    this.logger.log(`Generating voice spec — projectId="${projectId}" sections=${script.sections.length}`);
    try {
      const profile = voiceProfile ?? { name: 'Narrator', style: 'conversational', tone: 'engaging', pace: 'moderate' };
      const sectionsJson = JSON.stringify(
        script.sections.map((s, i) => ({ id: `section-${i}`, heading: s.heading, content: s.content.slice(0, 300) })),
      );

      return await callAIStructured(
        [{
          role: 'user',
          content: `Create voice narration specifications for YouTube script.\n\nVoice Profile: ${JSON.stringify(profile)}\nTitle: "${script.title}"\nSections: ${sectionsJson}\nProject: ${projectId}\n\nFor each section, include: sectionId (e.g. "section-0"), heading, ssmlMarkup, provider (use "elevenlabs"), speed (number 0.5-2.0, default 1.0), stability (number 0-1, default 0.75), pronunciationNotes (array). Total duration estimate. Set disclosureRequired: true.`,
        }],
        VoiceSpecOutputSchema,
        { systemPrompt: VOICE_SYSTEM, maxTokens: 4096 },
      ) as VoiceSpecOutput;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Voice spec failed — ${msg}`);
      throw new InternalServerErrorException(`Voice spec generation failed: ${msg}`);
    }
  }

  // ── Voice library browser (premade voices from providers) ────────────────────

  async getVoiceLibrary(source?: 'elevenlabs' | 'openai' | 'all'): Promise<{
    voices: Array<{
      id: string;
      source: string;
      name: string;
      description: string;
      previewUrl: string | null;
      labels: Record<string, string>;
      gender?: string;
      accent?: string;
      age?: string;
      useCase?: string;
    }>;
  }> {
    const voices: Array<{
      id: string;
      source: string;
      name: string;
      description: string;
      previewUrl: string | null;
      labels: Record<string, string>;
      gender?: string;
      accent?: string;
      age?: string;
      useCase?: string;
    }> = [];

    const src = source ?? 'all';

    if (src === 'elevenlabs' || src === 'all') {
      try {
        const apiKey = process.env['ELEVENLABS_API_KEY'];
        if (apiKey) {
          const res = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': apiKey },
          });
          if (res.ok) {
            const data = await res.json() as { voices: Array<{ voice_id: string; name: string; description?: string; preview_url?: string; labels?: Record<string, string>; category?: string }> };
            const premade = data.voices.filter(v => v.category === 'premade' || !v.category);
            voices.push(...premade.map(v => ({
              id: v.voice_id,
              source: 'elevenlabs',
              name: v.name,
              description: v.description ?? '',
              previewUrl: v.preview_url ?? null,
              labels: v.labels ?? {},
              gender: v.labels?.['gender'],
              accent: v.labels?.['accent'],
              age: v.labels?.['age'],
              useCase: v.labels?.['use case'],
            })));
          }
        }
      } catch (err) {
        this.logger?.warn?.('ElevenLabs voice library fetch failed');
      }
    }

    if (src === 'openai' || src === 'all') {
      const openaiVoices = [
        { id: 'alloy', name: 'Alloy', gender: 'neutral', description: 'Neutral, balanced voice suitable for most content' },
        { id: 'echo', name: 'Echo', gender: 'male', description: 'Deep, clear male voice with strong presence' },
        { id: 'fable', name: 'Fable', gender: 'male', description: 'British accent, warm storytelling tone' },
        { id: 'onyx', name: 'Onyx', gender: 'male', description: 'Deep authoritative voice, great for documentaries' },
        { id: 'nova', name: 'Nova', gender: 'female', description: 'Energetic female voice, upbeat and friendly' },
        { id: 'shimmer', name: 'Shimmer', gender: 'female', description: 'Soft, expressive female voice with warmth' },
      ] as const;

      voices.push(...openaiVoices.map(v => ({
        id: `openai-${v.id}`,
        source: 'openai',
        name: v.name,
        description: v.description,
        previewUrl: null,
        labels: { gender: v.gender },
        gender: v.gender,
      })));
    }

    return { voices };
  }

  async autoSelectVoice(scriptText: string): Promise<{
    voiceId: string;
    provider: 'elevenlabs' | 'openai';
    name: string;
    previewUrl: string | null;
    reason: string;
  }> {
    const { voices } = await this.getVoiceLibrary('all');

    if (voices.length === 0) {
      return { voiceId: 'nova', provider: 'openai', name: 'Nova', previewUrl: null, reason: 'Default voice (no voices available)' };
    }

    const voiceList = voices.slice(0, 30).map(v =>
      `${v.id} | ${v.name} | ${v.source} | ${v.gender ?? 'unknown'} | ${v.accent ?? ''} | ${v.useCase ?? ''} | ${v.description.slice(0, 80)}`
    ).join('\n');

    const VoicePickSchema = z.object({
      voiceId: z.string(),
      reason: z.string(),
    });

    try {
      const result = await callAIStructured(
        [{
          role: 'user',
          content: `You are selecting the best voice for a YouTube video narration.\n\nScript excerpt (first 300 chars):\n"${scriptText.slice(0, 300)}"\n\nAvailable voices (id | name | source | gender | accent | use_case | description):\n${voiceList}\n\nPick the single best voice for this content. Consider: content tone, energy level, target audience, and professionalism. Return the exact voiceId from the list above and a brief one-sentence reason.`,
        }],
        VoicePickSchema,
        { maxTokens: 256 },
      );

      const picked = voices.find(v => v.id === result.voiceId) ?? voices[0];
      return {
        voiceId: picked.id,
        provider: picked.source as 'elevenlabs' | 'openai',
        name: picked.name,
        previewUrl: picked.previewUrl,
        reason: result.reason,
      };
    } catch {
      const fallback = voices.find(v => v.gender === 'female') ?? voices[0];
      return {
        voiceId: fallback.id,
        provider: fallback.source as 'elevenlabs' | 'openai',
        name: fallback.name,
        previewUrl: fallback.previewUrl,
        reason: 'AI selection unavailable — using default voice',
      };
    }
  }
}
