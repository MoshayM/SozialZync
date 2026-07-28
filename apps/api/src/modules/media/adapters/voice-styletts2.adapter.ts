import type { VoiceAdapter, VoiceRequest, GeneratedMedia } from '../media.types';

const BASE_URL = process.env['STYLETTS2_URL'] ?? 'http://localhost:7777';
const WORDS_PER_SECOND = 2.7;

/**
 * StyleTTS2 adapter. Activates when STYLETTS2_URL env is set.
 * High-quality human-level TTS with style control.
 */
export class StyleTTS2VoiceAdapter implements VoiceAdapter {
  readonly name = 'styletts2';

  available(): boolean {
    return !!process.env['STYLETTS2_URL'];
  }

  async synthesize(req: VoiceRequest): Promise<GeneratedMedia> {
    const text = req.text.trim();
    if (!text) throw new Error('StyleTTS2: empty text');

    const response = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        style: req.voiceId ?? 'default',
        speed: req.speed ?? 1.0,
        output_format: 'wav',
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const msg = await response.text().catch(() => String(response.status));
      throw new Error(`StyleTTS2 failed: ${msg}`);
    }
    const buf = Buffer.from(await response.arrayBuffer());
    const words = text.split(/\s+/).length;
    return {
      buffer: buf,
      mimeType: 'audio/wav',
      ext: 'wav',
      durationMs: Math.round((words / (WORDS_PER_SECOND * (req.speed ?? 1))) * 1000),
      model: req.voiceId ?? 'default',
    };
  }
}
