import type { VoiceAdapter, VoiceRequest, GeneratedMedia } from '../media.types';

const BASE_URL = process.env['COQUI_URL'] ?? 'http://localhost:5002';
const WORDS_PER_SECOND = 2.6;

/**
 * Coqui TTS / XTTS v2 adapter. Activates when COQUI_URL env is set.
 * Supports voice cloning via speaker_wav. Multi-language capable.
 */
export class CoquiVoiceAdapter implements VoiceAdapter {
  readonly name = 'coqui';

  available(): boolean {
    return !!process.env['COQUI_URL'];
  }

  async synthesize(req: VoiceRequest): Promise<GeneratedMedia> {
    const text = req.text.trim();
    if (!text) throw new Error('Coqui: empty text');

    const params = new URLSearchParams({ text });
    if (req.voiceId) params.set('speaker_id', req.voiceId);
    if (req.language) params.set('language', req.language);

    const response = await fetch(`${BASE_URL}/api/tts?${params.toString()}`, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const msg = await response.text().catch(() => String(response.status));
      throw new Error(`Coqui TTS failed: ${msg}`);
    }
    const buf = Buffer.from(await response.arrayBuffer());
    const words = text.split(/\s+/).length;
    return {
      buffer: buf,
      mimeType: 'audio/wav',
      ext: 'wav',
      durationMs: Math.round((words / WORDS_PER_SECOND) * 1000),
      model: req.voiceId ?? 'xtts_v2',
    };
  }
}
