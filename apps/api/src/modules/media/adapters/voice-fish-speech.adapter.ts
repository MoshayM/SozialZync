import type { VoiceAdapter, VoiceRequest, GeneratedMedia } from '../media.types';

const BASE_URL = process.env['FISH_SPEECH_URL'] ?? 'http://localhost:8080';
const WORDS_PER_SECOND = 3.0;

/**
 * Fish Speech adapter. Activates when FISH_SPEECH_URL env is set.
 * Fast, high-quality neural TTS with voice cloning support.
 */
export class FishSpeechVoiceAdapter implements VoiceAdapter {
  readonly name = 'fish-speech';

  available(): boolean {
    return !!process.env['FISH_SPEECH_URL'];
  }

  async synthesize(req: VoiceRequest): Promise<GeneratedMedia> {
    const text = req.text.trim();
    if (!text) throw new Error('Fish Speech: empty text');

    const response = await fetch(`${BASE_URL}/v1/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: req.voiceId ?? 'default',
        format: 'mp3',
        streaming: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const msg = await response.text().catch(() => String(response.status));
      throw new Error(`Fish Speech failed: ${msg}`);
    }
    const buf = Buffer.from(await response.arrayBuffer());
    const words = text.split(/\s+/).length;
    return {
      buffer: buf,
      mimeType: 'audio/mpeg',
      ext: 'mp3',
      durationMs: Math.round((words / WORDS_PER_SECOND) * 1000),
      model: req.voiceId ?? 'default',
    };
  }
}
