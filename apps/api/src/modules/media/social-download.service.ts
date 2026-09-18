import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
// @reason: ffmpeg-static ships a pre-built binary; its default export is the absolute path
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string | null = require('ffmpeg-static') as string | null;

const SOCIAL_PATTERNS: Array<[RegExp, string]> = [
  [/youtube\.com|youtu\.be/, 'YouTube'],
  [/tiktok\.com/, 'TikTok'],
  [/instagram\.com/, 'Instagram'],
  [/twitter\.com|^x\.com$/, 'Twitter/X'],
  [/facebook\.com|fb\.watch/, 'Facebook'],
  [/twitch\.tv/, 'Twitch'],
  [/vimeo\.com/, 'Vimeo'],
  [/dailymotion\.com/, 'Dailymotion'],
  [/reddit\.com/, 'Reddit'],
  [/bilibili\.com/, 'Bilibili'],
];

@Injectable()
export class SocialDownloadService {
  private readonly logger = new Logger(SocialDownloadService.name);

  isSocialUrl(url: string): boolean {
    return !!this.platformLabel(url);
  }

  platformLabel(url: string): string | null {
    let host: string;
    try { host = new URL(url).hostname.replace(/^(www\.|m\.|vm\.)/, ''); }
    catch { return null; }
    for (const [re, label] of SOCIAL_PATTERNS) {
      if (re.test(host)) return label;
    }
    return null;
  }

  async download(
    url: string,
    title?: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const tmpDir = os.tmpdir();
    const id = `ytdl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const outTemplate = path.join(tmpDir, `${id}.%(ext)s`);
    const expectedMp4 = path.join(tmpDir, `${id}.mp4`);

    this.logger.log(`yt-dlp download: ${url}`);

    const isYouTube = /youtube\.com|youtu\.be/.test(url);
    const args = [
      url,
      '--format',
      // prefer mp4 ≤1080p with separate audio; fall back to single best stream
      'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
      '--merge-output-format', 'mp4',
      '--output', outTemplate,
      '--no-playlist',
      '--max-filesize', '500m',
      '--no-progress',
      '--retries', '2',
      '--fragment-retries', '2',
      '--socket-timeout', '20',
    ];
    // Use alternate YouTube player clients (mweb/android) to bypass bot-detection
    // on cloud server IPs — avoids "sign in to confirm you're not a bot" errors.
    if (isYouTube) args.push('--extractor-args', 'youtube:player_client=mweb,android');
    // Point yt-dlp at ffmpeg-static's pre-built binary so stream merging works
    if (ffmpegPath) args.push('--ffmpeg-location', ffmpegPath);
    await this.runYtDlp(args);

    const outFile = fs.existsSync(expectedMp4)
      ? expectedMp4
      : this.findDownloaded(tmpDir, id);

    if (!outFile) {
      throw new BadRequestException(
        'Download produced no file — the video may be private, geo-blocked, or unsupported.',
      );
    }

    try {
      const buffer = fs.readFileSync(outFile);
      if (buffer.length === 0) throw new BadRequestException('Downloaded video is empty');

      const ext = path.extname(outFile).slice(1) || 'mp4';
      const mime =
        ext === 'webm' ? 'video/webm'
        : ext === 'mov' ? 'video/quicktime'
        : 'video/mp4';
      const base = title
        ? title.replace(/[^\w\s-]/g, '_').slice(0, 80)
        : `video`;
      const filename = `${base}.${ext}`;

      this.logger.log(`yt-dlp done — ${(buffer.length / 1024 / 1024).toFixed(1)} MB from ${url}`);
      return { buffer, filename, mimeType: mime };
    } finally {
      try { fs.unlinkSync(outFile); } catch { /* best-effort cleanup */ }
    }
  }

  private findDownloaded(dir: string, prefix: string): string | null {
    try {
      const match = fs.readdirSync(dir).find((f) => f.startsWith(prefix));
      return match ? path.join(dir, match) : null;
    } catch { return null; }
  }

  private runYtDlp(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      let proc: ReturnType<typeof spawn>;
      try {
        proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (err) {
        return reject(
          new BadRequestException('yt-dlp is not available on this server — social media import is disabled.'),
        );
      }

      let stderr = '';
      proc.stdout?.on('data', (c: Buffer) => this.logger.verbose(c.toString().trim()));
      proc.stderr?.on('data', (c: Buffer) => { stderr += c.toString(); });

      const timeout = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch { /* */ }
        reject(new BadRequestException('Social media download timed out after 5 minutes. Try a shorter clip.'));
      }, 5 * 60 * 1000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) return resolve();
        // Log full stderr so Railway logs show the actual yt-dlp error
        this.logger.error(`yt-dlp exit=${code} stderr: ${stderr.slice(-2000)}`);
        // Surface friendly errors based on yt-dlp stderr
        const tail = stderr.slice(-2000).toLowerCase();
        if (tail.includes('private') || tail.includes('members only'))
          return reject(new BadRequestException('That video is private or members-only — only public videos can be imported.'));
        if (tail.includes('not available') || tail.includes('removed') || tail.includes('deleted'))
          return reject(new BadRequestException('That video is no longer available.'));
        if (tail.includes('geo') || tail.includes('country'))
          return reject(new BadRequestException('That video is geo-blocked and cannot be imported.'));
        if (tail.includes('sign in') || tail.includes('login'))
          return reject(new BadRequestException('That video requires sign-in — only public videos can be imported.'));
        reject(new BadRequestException(
          'Could not download this video. Make sure it is public and the URL is correct.',
        ));
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(
          new BadRequestException(`yt-dlp not found: ${err.message}. Social media import is disabled.`),
        );
      });
    });
  }
}
