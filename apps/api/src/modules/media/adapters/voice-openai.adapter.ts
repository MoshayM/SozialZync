import type { VoiceAdapter, VoiceRequest, GeneratedMedia } from '../media.types';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const DEFAULT_MODEL = process.env['VOICE_OPENAI_MODEL'] ?? 'gpt-4o-mini-tts';
const WORDS_PER_SECOND = 2.5;

function buildTTSInstructions(styleExaggeration: number): string {
  if (styleExaggeration >= 0.7) return 'Speak with strong expressiveness and emotion. Vary your pitch and pace dynamically. Be energetic and engaging.';
  if (styleExaggeration >= 0.4) return 'Speak with clear expressiveness. Use natural variation in pace and emphasis. Sound warm and engaging.';
  return 'Speak with gentle expressiveness. Maintain a natural, conversational tone with subtle variation.';
}

/** Real TTS via the OpenAI audio API — active whenever OPENAI_API_KEY is set. */
export class OpenAiVoiceAdapter implements VoiceAdapter {
  readonly name = 'openai-tts';

  available(): boolean {
    return !!process.env['OPENAI_API_KEY'];
  }

  async synthesize(req: VoiceRequest): Promise<GeneratedMedia> {
    const body: Record<string, unknown> = {
      model: DEFAULT_MODEL,
      voice: req.voiceId ?? 'alloy',
      input: req.text.slice(0, 4096),
      speed: req.speed ?? 1,
      response_format: 'mp3',
    };
    // gpt-4o-mini-tts supports a free-text instructions field for delivery style
    if (req.styleExaggeration && req.styleExaggeration > 0.2) {
      body['instructions'] = buildTTSInstructions(req.styleExaggeration);
    }

    const res = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env['OPENAI_API_KEY']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`OpenAI TTS failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const words = req.text.trim().split(/\s+/).length;
    return {
      buffer,
      mimeType: 'audio/mpeg',
      ext: 'mp3',
      durationMs: Math.round((words / (WORDS_PER_SECOND * (req.speed ?? 1))) * 1000),
      model: DEFAULT_MODEL,
    };
  }
}
