import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { callAIStructured } from '@cf/shared';
import { VoiceSpecOutputSchema, type VoiceSpecOutput } from '@cf/shared';
import type { ScriptOutput } from '@cf/shared';
import { buildEnhancedVoiceSystemPrompt } from '@cf/shared';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../media/storage.service';

const VOICE_SYSTEM = buildEnhancedVoiceSystemPrompt(
  `You are a professional voice direction specialist for YouTube narration. Create detailed TTS specifications. Respond only with valid JSON.`,
);

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Detect character names from script sections (e.g. "NARRATOR:", "HOST:", "GUEST:"). */
  private detectCharacters(script: ScriptOutput): string[] {
    const pattern = /^([A-Z][A-Z\s]{1,20}):/gm;
    const found = new Set<string>();
    for (const section of script.sections) {
      for (const match of section.content.matchAll(pattern)) {
        if (match[1]) found.add(match[1].trim());
      }
    }
    return Array.from(found);
  }

  async generateSpec(script: ScriptOutput, projectId: string, voiceProfile?: Record<string, unknown>, characterVoices?: boolean): Promise<VoiceSpecOutput> {
    this.logger.log(`Generating voice spec — projectId="${projectId}" sections=${script.sections.length} characterVoices=${characterVoices ?? false}`);
    try {
      const sectionsJson = JSON.stringify(
        script.sections.map((s, i) => ({ id: `section-${i}`, heading: s.heading, content: s.content.slice(0, 400) })),
      );

      let userContent: string;

      if (characterVoices) {
        const characters = this.detectCharacters(script);
        const characterList = characters.length > 0
          ? characters.join(', ')
          : 'Narrator (single narrator)';

        userContent = [
          `Create character-aware voice narration specifications for this YouTube script. Different characters must have distinctly different voices, tones, and delivery styles.`,
          ``,
          `TITLE: "${script.title}"`,
          `DETECTED CHARACTERS: ${characterList}`,
          ``,
          `SECTIONS:`,
          sectionsJson,
          ``,
          `INSTRUCTIONS:`,
          `- Detect character dialogue lines (e.g. "HOST:", "NARRATOR:", "GUEST:", or inferred from context).`,
          `- Assign each character a distinct voice profile: different gender, pace, pitch, energy, and emotional tone.`,
          `- For each section, write ssmlMarkup that uses <prosody>, <emphasis>, and <break> tags to reflect the character's personality and the emotional weight of the moment.`,
          `- Vary speed (0.7–1.3) and stability (0.6–0.9) per character to sound natural.`,
          `- Dialogue between characters should feel like a real conversation — vary energy and pacing.`,
          `- For each section: sectionId ("section-0" etc), heading, ssmlMarkup, provider ("openai"), speed, stability, pronunciationNotes (array).`,
          `- totalDurationEstimateSecs: sum of all section durations.`,
          `- disclosureRequired: true.`,
          `- characters: array of each detected character with fields: name, gender ("male"/"female"/"neutral"), style (e.g. "warm", "energetic", "calm"), tone (e.g. "friendly", "authoritative", "playful"), pace ("slow"/"moderate"/"fast"), description (one sentence about this character's voice).`,
        ].join('\n');
      } else {
        const profile = voiceProfile ?? { name: 'Narrator', style: 'conversational', tone: 'engaging', pace: 'moderate' };
        userContent = [
          `Create voice narration specifications for YouTube script.`,
          ``,
          `Voice Profile: ${JSON.stringify(profile)}`,
          `Title: "${script.title}"`,
          `Sections: ${sectionsJson}`,
          `Project: ${projectId}`,
          ``,
          `For each section, include: sectionId (e.g. "section-0"), heading, ssmlMarkup (with <prosody> and <emphasis> tags matching the section's emotion and energy), provider ("openai"), speed (0.5–2.0, default 1.0), stability (0–1, default 0.75), pronunciationNotes (array). Total duration estimate. Set disclosureRequired: true.`,
        ].join('\n');
      }

      return await callAIStructured(
        [{ role: 'user', content: userContent }],
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

  /**
   * In-app voice style cloning — no external API required.
   * Stores the reference audio as an asset in the user's project and returns a
   * "local:<versionId>" voice ID. The supervisor's VOICE_GENERATE stage
   * detects this prefix and applies FFmpeg pitch-style transfer.
   */
  async cloneVoice(audioBuffer: Buffer, mimeType: string, projectId: string): Promise<{ voiceId: string; name: string }> {
    const ext = mimeType.includes('webm') ? 'webm'
      : mimeType.includes('mp3') ? 'mp3'
      : mimeType.includes('wav') ? 'wav'
      : 'webm';

    const asset = await this.prisma.asset.create({
      data: { projectId, kind: 'VOICE', label: 'Voice Reference Sample', status: 'GENERATING' },
    });

    const key = `assets/${projectId}/${asset.id}/v1/reference.${ext}`;
    const { sizeBytes } = await this.storage.put(key, audioBuffer);
    const contentHash = createHash('sha256').update(audioBuffer).digest('hex');

    const version = await this.prisma.assetVersion.create({
      data: {
        assetId: asset.id,
        version: 1,
        r2Key: key,
        contentHash,
        provider: 'user-upload',
        model: 'reference-sample',
        prompt: { source: 'user-voice-clone-upload' } as never,
        params: {} as never,
        provenance: {
          provider: 'user-upload',
          model: 'reference-sample',
          generatedAt: new Date().toISOString(),
          license: 'user-recorded',
          notes: 'Voice reference sample uploaded by user for in-app style matching',
        } as never,
        sizeBytes: BigInt(sizeBytes),
        data: audioBuffer.length < 8 * 1024 * 1024 ? (audioBuffer as unknown as Uint8Array<ArrayBuffer>) : null,
      },
    });

    await this.prisma.asset.update({
      where: { id: asset.id },
      data: { status: 'READY', currentVersionId: version.id },
    });

    this.logger.log(`Voice reference stored — versionId="${version.id}" size=${sizeBytes}B`);
    return { voiceId: `local:${version.id}`, name: 'Your Voice (Style Match)' };
  }

  /** In-app voice style cloning is always available — no external API needed. */
  checkCloneAvailability(): Promise<{ available: boolean; reason?: string; provider?: string }> {
    return Promise.resolve({ available: true, provider: 'in-app' });
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
