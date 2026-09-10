import {
  IMAGE_QUALITY_SUFFIX,
  IMAGE_NEGATIVE_BASE,
  VIDEO_QUALITY_SUFFIX,
  VIDEO_NEGATIVE_BASE,
  MUSIC_HUMANIZING,
  SHOT_TYPE_DESCRIPTORS,
  CAMERA_MOTION_DESCRIPTORS,
  EMOTION_VISUAL_MODIFIERS,
  ENERGY_DESCRIPTORS,
} from './templates';
import type { MusicBriefOutput } from '../schemas/agent.schema';

export interface EnhancedImagePrompt {
  prompt: string;
  negativePrompt: string;
}

export interface EnhancedVideoPrompt {
  prompt: string;
  negativePrompt: string;
}

export interface EnhancedMusicPrompt {
  prompt: string;
}

// ── Image ──────────────────────────────────────────────────────────────────────

export function enhanceImagePrompt(
  raw: string,
  context: { style?: string; emotion?: string; shotType?: string } = {},
): EnhancedImagePrompt {
  const emotionMod =
    EMOTION_VISUAL_MODIFIERS[context.emotion ?? ''] ??
    EMOTION_VISUAL_MODIFIERS['neutral']!;
  const stylePart = context.style ? `${context.style} aesthetic` : '';

  const prompt = [raw.trim(), stylePart, emotionMod, IMAGE_QUALITY_SUFFIX]
    .filter(Boolean)
    .join(', ');

  // Merge caller's existing negative with our baseline (dedup by splitting on comma)
  return { prompt, negativePrompt: IMAGE_NEGATIVE_BASE };
}

export function mergeNegativePrompts(...parts: (string | undefined)[]): string {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    for (const term of p.split(',').map(t => t.trim()).filter(Boolean)) {
      const key = term.toLowerCase();
      if (!seen.has(key)) { seen.add(key); merged.push(term); }
    }
  }
  return merged.join(', ');
}

// ── Video ──────────────────────────────────────────────────────────────────────

export function enhanceVideoPrompt(
  raw: string,
  scene: { shotType?: string; cameraMotion?: string; emotion?: string } = {},
): EnhancedVideoPrompt {
  const shotDesc = SHOT_TYPE_DESCRIPTORS[scene.shotType ?? ''] ?? '';
  const motionDesc = CAMERA_MOTION_DESCRIPTORS[scene.cameraMotion ?? ''] ?? '';
  const emotionMod =
    EMOTION_VISUAL_MODIFIERS[scene.emotion ?? ''] ??
    EMOTION_VISUAL_MODIFIERS['neutral']!;

  const prefix = [shotDesc, motionDesc].filter(Boolean).join(', ');
  const prompt = [prefix, raw.trim(), emotionMod, VIDEO_QUALITY_SUFFIX]
    .filter(Boolean)
    .join(', ');

  return { prompt, negativePrompt: VIDEO_NEGATIVE_BASE };
}

// ── Music ──────────────────────────────────────────────────────────────────────

export function enhanceMusicPrompt(
  brief: Pick<MusicBriefOutput, 'mood' | 'genre' | 'bpm' | 'energy' | 'instruments' | 'prompt'>,
): EnhancedMusicPrompt {
  const base = brief.prompt?.trim() || `${brief.genre} background music`;
  const instruments =
    brief.instruments?.length
      ? `featuring ${brief.instruments.slice(0, 4).join(', ')}`
      : '';
  const energyDesc = ENERGY_DESCRIPTORS[brief.energy] ?? '';

  const prompt = [
    `${brief.genre} instrumental, ${brief.mood} mood`,
    `${brief.bpm} BPM`,
    energyDesc,
    instruments,
    base,
    MUSIC_HUMANIZING,
    'no vocals, background score, royalty-free AI composition',
  ]
    .filter(Boolean)
    .join(', ');

  return { prompt };
}

// ── Voice ──────────────────────────────────────────────────────────────────────

// Appends naturalness directives to whatever base VOICE_SYSTEM prompt is passed.
export function buildEnhancedVoiceSystemPrompt(base: string): string {
  return `${base}

Voice naturalness requirements — apply to every section's ssmlMarkup:
- Insert <break time="300ms"/> at natural clause boundaries and between sentences.
- Wrap conversational passages in <prosody rate="95%" pitch="-2st"> for warmth.
- Increase rate to <prosody rate="108%"> for lists, fast transitions, and energy bursts.
- Add <emphasis level="moderate"> on the 2-3 most important hook words per section.
- Slow to <prosody rate="88%"> for emotional, instructional, or dramatic beats.
- Begin each section with a subtle <break time="500ms"/> to simulate natural breath.
- Target style: human podcast narrator — never monotone, never robotic.
- For ElevenLabs provider: stability 0.65-0.80 for conversational; 0.85 for formal narration.`;
}

// Build narration text for TTS from voice spec sections when ElevenLabs is the provider
// (ElevenLabs accepts SSML; OpenAI TTS does not, so falls back to raw script text).
export function buildVoiceNarration(
  spec: { sections?: Array<{ ssmlMarkup?: string; provider?: string }> } | null | undefined,
  rawFallback: string,
): string {
  const provider = spec?.sections?.[0]?.provider ?? 'openai';
  if (provider === 'elevenlabs' && spec?.sections?.length) {
    const ssml = spec.sections
      .map(s => s.ssmlMarkup ?? '')
      .filter(Boolean)
      .join('\n');
    if (ssml.length > 20) return ssml;
  }
  return rawFallback;
}
