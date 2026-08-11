import { Injectable, Logger } from '@nestjs/common';
import { VOICE_EFFECT_FFMPEG, type VoiceEffect } from './character.types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface CharacterVoiceOptions {
  text: string;
  voiceProvider: 'kokoro' | 'piper' | 'coqui';
  voiceId: string;
  voicePitch: number;
  voiceSpeed: number;
  voiceEffect: VoiceEffect;
}

@Injectable()
export class CharacterVoiceService {
  private readonly logger = new Logger(CharacterVoiceService.name);

  async synthesize(opts: CharacterVoiceOptions): Promise<Buffer> {
    // 1. Generate base TTS audio
    const rawAudio = await this.generateTTS(opts);

    // 2. Apply FFmpeg voice effect if needed
    const effectFilter = VOICE_EFFECT_FFMPEG[opts.voiceEffect];
    if (!effectFilter && opts.voicePitch === 1.0 && opts.voiceSpeed === 1.0) {
      return rawAudio;
    }

    return this.applyEffects(rawAudio, {
      pitch: opts.voicePitch,
      speed: opts.voiceSpeed,
      effectFilter,
    });
  }

  private async generateTTS(opts: CharacterVoiceOptions): Promise<Buffer> {
    if (opts.voiceProvider === 'kokoro') {
      return this.kokoroTTS(opts.voiceId, opts.text, opts.voiceSpeed);
    }
    if (opts.voiceProvider === 'piper') {
      return this.piperTTS(opts.voiceId, opts.text);
    }
    // coqui or default
    return this.coquiTTS(opts.voiceId, opts.text);
  }

  private async kokoroTTS(voiceId: string, text: string, speed: number): Promise<Buffer> {
    const url = process.env['KOKORO_URL'] ?? 'http://localhost:8880';
    const res = await fetch(`${url}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'kokoro', input: text, voice: voiceId, speed }),
    });
    if (!res.ok) throw new Error(`Kokoro TTS HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async piperTTS(voiceId: string, text: string): Promise<Buffer> {
    const url = process.env['PIPER_URL'] ?? 'http://localhost:5000';
    const res = await fetch(`${url}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceId }),
    });
    if (!res.ok) throw new Error(`Piper TTS HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async coquiTTS(voiceId: string, text: string): Promise<Buffer> {
    const url = process.env['COQUI_URL'] ?? 'http://localhost:5002';
    const res = await fetch(`${url}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker_id: voiceId }),
    });
    if (!res.ok) throw new Error(`Coqui TTS HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async applyEffects(audio: Buffer, opts: { pitch: number; speed: number; effectFilter: string }): Promise<Buffer> {
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `cf-char-in-${Date.now()}.mp3`);
    const outputPath = path.join(tmpDir, `cf-char-out-${Date.now()}.mp3`);

    try {
      fs.writeFileSync(inputPath, audio);

      // Build FFmpeg filter chain
      const filters: string[] = [];
      if (opts.effectFilter) filters.push(opts.effectFilter);
      // Additional pitch/speed if not already handled by effect
      if (opts.pitch !== 1.0 && !opts.effectFilter.includes('asetrate')) {
        filters.push(`asetrate=44100*${opts.pitch},aresample=44100`);
      }
      if (opts.speed !== 1.0 && !opts.effectFilter.includes('atempo')) {
        filters.push(`atempo=${Math.min(Math.max(opts.speed, 0.5), 2.0)}`);
      }

      const args = ['-i', inputPath, '-y'];
      if (filters.length > 0) {
        args.push('-af', filters.join(','));
      }
      args.push('-codec:a', 'libmp3lame', '-q:a', '2', outputPath);

      await execFileAsync('ffmpeg', args, { timeout: 30_000 }).catch(() => {
        // FFmpeg not available — return raw audio
        fs.copyFileSync(inputPath, outputPath);
      });

      return fs.readFileSync(outputPath);
    } finally {
      [inputPath, outputPath].forEach(f => { try { fs.unlinkSync(f); } catch {} });
    }
  }
}
