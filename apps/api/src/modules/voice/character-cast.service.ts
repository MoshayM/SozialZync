import { Injectable, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { CharacterCastOutputSchema, type CharacterCastOutput } from '@cf/shared';
import type { ScriptOutput } from '@cf/shared';

const OPENAI_VOICES_BY_GENDER: Record<string, string[]> = {
  male:    ['echo', 'onyx', 'fable'],
  female:  ['nova', 'shimmer', 'coral'],
  neutral: ['alloy'],
};

const CAST_SYSTEM = [
  'You are a professional casting director and voice director for short-form storytelling videos.',
  'Analyze the script and identify every speaking character (including Narrator, Host, Guest, etc.).',
  'Return a structured JSON with detailed character profiles optimised for AI voice synthesis and image generation.',
  'Use ONLY these OpenAI TTS voice IDs: echo, onyx, fable (male), nova, shimmer, coral (female), alloy (neutral).',
  'IMPORTANT: Assign distinct voices — never give two characters the same voiceId.',
  'visualDescription must be a detailed cinematic image-generation prompt (150+ chars) describing the character\'s appearance, clothing, and setting.',
  'Respond ONLY with valid JSON matching the schema.',
].join('\n');

/** Extracts character profiles from a script for the Character Story pipeline. */
@Injectable()
export class CharacterCastService {
  private readonly logger = new Logger(CharacterCastService.name);

  async extractCharacters(script: ScriptOutput, projectId: string): Promise<CharacterCastOutput> {
    this.logger.log(`CHARACTER_CAST — projectId="${projectId}" title="${script.title}"`);

    const sectionsText = script.sections
      .map((s, i) => `[Section ${i + 1}: ${s.heading}]\n${s.content}`)
      .join('\n\n');

    const userPrompt = [
      `SCRIPT TITLE: "${script.title}"`,
      ``,
      `SCRIPT CONTENT:`,
      sectionsText.slice(0, 6000),
      ``,
      `Return a CharacterCastOutput JSON with:`,
      `- characters[]: each with name, role, gender, ageGroup, personality, voiceStyle (provider="openai", voiceId, speed, emotion, stability), visualDescription (detailed cinematic image prompt)`,
      `- hasMultipleCharacters: true/false`,
      `- narrativeStyle: "dialogue-driven" | "narrated" | "interview" | "monologue"`,
      `- totalCharacters: number`,
      `- scriptTitle: "${script.title}"`,
    ].join('\n');

    const result = await callAIStructured(
      [{ role: 'user', content: userPrompt }],
      CharacterCastOutputSchema,
      { systemPrompt: CAST_SYSTEM, maxTokens: 3000 },
    );

    // Ensure no two characters share the same voiceId
    const usedVoiceIds = new Set<string>();
    const allVoices = ['nova', 'echo', 'alloy', 'fable', 'onyx', 'shimmer', 'coral'];
    for (const char of result.characters) {
      if (usedVoiceIds.has(char.voiceStyle.voiceId)) {
        const pool = OPENAI_VOICES_BY_GENDER[char.gender] ?? allVoices;
        const fresh = pool.find((v) => !usedVoiceIds.has(v)) ?? allVoices.find((v) => !usedVoiceIds.has(v));
        if (fresh) char.voiceStyle.voiceId = fresh;
      }
      usedVoiceIds.add(char.voiceStyle.voiceId);
    }

    this.logger.log(
      `CHARACTER_CAST done — ${result.characters.length} character(s): ${result.characters.map((c) => c.name).join(', ')}`,
    );
    return result;
  }
}
