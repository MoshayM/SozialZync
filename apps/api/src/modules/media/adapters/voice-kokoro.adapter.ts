import type { VoiceAdapter, VoiceRequest, GeneratedMedia } from '../media.types';

const BASE_URL = process.env['KOKORO_URL'] ?? 'http://localhost:8880';
const WORDS_PER_SECOND = 2.8;

/**
 * Kokoro TTS adapter — connects to a local Kokoro server (github.com/remsky/Kokoro-FastAPI).
 * Activates only when KOKORO_URL is explicitly set.
 * Priority: higher than ElevenLabs so local TTS is tried first.
 */
export class KokoroVoiceAdapter implements VoiceAdapter {
  readonly name = 'kokoro';

  available(): boolean {
    return !!process.env['KOKORO_URL'];
  }

  async synthesize(req: VoiceRequest): Promise<GeneratedMedia> {
    const voice = req.voiceId ?? 'af_bella';
    const speed = req.speed ?? 1.0;
    const text = req.text.trim();
    if (!text) throw new Error('Kokoro: empty text');

    const response = await fetch(`${BASE_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'kokoro', input: text, voice, speed, response_format: 'mp3' }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const msg = await response.text().catch(() => String(response.status));
      throw new Error(`Kokoro TTS failed: ${msg}`);
    }
    const buf = Buffer.from(await response.arrayBuffer());
    const words = text.split(/\s+/).length;
    return {
      buffer: buf,
      mimeType: 'audio/mpeg',
      ext: 'mp3',
      durationMs: Math.round((words / (WORDS_PER_SECOND * speed)) * 1000),
      model: 'kokoro',
    };
  }
}
