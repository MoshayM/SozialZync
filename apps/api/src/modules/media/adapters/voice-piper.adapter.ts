import type { VoiceAdapter, VoiceRequest, GeneratedMedia } from '../media.types';

const BASE_URL = process.env['PIPER_URL'] ?? 'http://localhost:5000';
const WORDS_PER_SECOND = 2.5;

/**
 * Piper TTS adapter — connects to a local Piper HTTP server (rhasspy/piper).
 * Activates only when PIPER_URL is explicitly set.
 */
export class PiperVoiceAdapter implements VoiceAdapter {
  readonly name = 'piper';

  available(): boolean {
    return !!process.env['PIPER_URL'];
  }

  async synthesize(req: VoiceRequest): Promise<GeneratedMedia> {
    const text = req.text.trim();
    if (!text) throw new Error('Piper: empty text');

    // Piper HTTP server: POST /synthesize → audio/wav
    const response = await fetch(`${BASE_URL}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: req.voiceId ?? 'en_US-lessac-medium', output_file: null }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const msg = await response.text().catch(() => String(response.status));
      throw new Error(`Piper TTS failed: ${msg}`);
    }
    const buf = Buffer.from(await response.arrayBuffer());
    const words = text.split(/\s+/).length;
    return {
      buffer: buf,
      mimeType: 'audio/wav',
      ext: 'wav',
      durationMs: Math.round((words / (WORDS_PER_SECOND * (req.speed ?? 1))) * 1000),
      model: req.voiceId ?? 'en_US-lessac-medium',
    };
  }
}
