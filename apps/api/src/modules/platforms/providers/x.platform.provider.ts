import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../../channels/token-encryption.service';
import { IPlatformProvider, PublishOptions, PublishResult, ConnectionStatus } from '../platform.types';

const X_API    = 'https://api.twitter.com/2';
const X_UPLOAD = 'https://upload.twitter.com/1.1/media/upload.json';
const X_TOKEN  = 'https://api.twitter.com/2/oauth2/token';

// 5 MB chunk size for chunked video upload
const CHUNK_SIZE = 5 * 1024 * 1024;

interface StoredTokens {
  accessToken: string;
  refreshToken?: string | null;
  xId: string;
  username: string;
  expiresAt: string;
}

@Injectable()
export class XPlatformProvider implements IPlatformProvider {
  readonly platformId = 'x';
  readonly name = 'X (Twitter)';
  private readonly logger = new Logger(XPlatformProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: TokenEncryptionService,
  ) {}

  private async getTokens(userId: string): Promise<StoredTokens | null> {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { userId, platformId: 'x', readOnly: false },
    });
    if (!conn) return null;
    try {
      return JSON.parse(this.enc.decrypt(conn.encryptedTokens)) as StoredTokens;
    } catch {
      return null;
    }
  }

  private async refreshIfExpired(userId: string, tokens: StoredTokens): Promise<StoredTokens> {
    const expiresAt = new Date(tokens.expiresAt).getTime();
    if (Date.now() < expiresAt - 60_000) return tokens; // still valid with 1-min buffer

    if (!tokens.refreshToken) throw new Error('X access token expired and no refresh token stored');

    const basicAuth = Buffer.from(
      `${process.env['X_CLIENT_ID'] ?? ''}:${process.env['X_CLIENT_SECRET'] ?? ''}`,
    ).toString('base64');

    const resp = await axios.post<{ access_token: string; refresh_token?: string; expires_in: number }>(
      X_TOKEN,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: process.env['X_CLIENT_ID'] ?? '',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basicAuth}` } },
    );

    const updated: StoredTokens = {
      ...tokens,
      accessToken: resp.data.access_token,
      refreshToken: resp.data.refresh_token ?? tokens.refreshToken,
      expiresAt: new Date(Date.now() + (resp.data.expires_in ?? 7200) * 1000).toISOString(),
    };

    const conn = await this.prisma.platformConnection.findFirst({ where: { userId, platformId: 'x' } });
    if (conn) {
      await this.prisma.platformConnection.update({
        where: { id: conn.id },
        data: { encryptedTokens: this.enc.encrypt(JSON.stringify(updated)) },
      });
    }
    return updated;
  }

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { userId, platformId: 'x', readOnly: false },
      select: { accountName: true, accountId: true },
    });
    if (!conn) return { connected: false };
    return { connected: true, accountName: conn.accountName ?? undefined, accountId: conn.accountId };
  }

  async getOAuthUrl(userId: string, returnUrl: string): Promise<string> {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const params = new URLSearchParams({ userId, returnTo: returnUrl });
    return `${apiBase}/platforms/x/auth?${params.toString()}`;
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.platformConnection.deleteMany({ where: { userId, platformId: 'x' } });
  }

  async publish(userId: string, opts: PublishOptions): Promise<PublishResult> {
    let tokens = await this.getTokens(userId);
    if (!tokens) throw new Error('X not connected — complete OAuth first');
    tokens = await this.refreshIfExpired(userId, tokens);

    const text = this.buildTweetText(opts);
    const body: Record<string, unknown> = { text };

    const isVideo = Boolean(opts.videoFilePath && /\.(mp4|mov|avi|webm)$/i.test(opts.videoFilePath));
    const mediaUrl = isVideo ? opts.videoFilePath : opts.thumbnailFilePath;

    if (mediaUrl) {
      const mediaId = await this.uploadMedia(tokens.accessToken, mediaUrl, isVideo);
      body['media'] = { media_ids: [mediaId] };
    }

    const resp = await axios.post<{ data: { id: string; text: string } }>(
      `${X_API}/tweets`,
      body,
      { headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Content-Type': 'application/json' } },
    );

    const tweetId = resp.data.data.id;
    this.logger.log(`X tweet posted: ${tweetId} by @${tokens.username}`);
    return {
      platformPostId: tweetId,
      url: `https://x.com/${tokens.username}/status/${tweetId}`,
      publishedAt: new Date(),
    };
  }

  async schedule(userId: string, opts: PublishOptions & { scheduledAt: Date }): Promise<PublishResult> {
    // X API does not support native scheduled tweets via OAuth 2.0 user context.
    // BullMQ delay handles timing; publish immediately when the job fires.
    this.logger.warn('X does not support native scheduled tweets; publishing immediately');
    return this.publish(userId, opts);
  }

  validate(opts: PublishOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!opts.title && !opts.description) errors.push('Title or description is required');
    return { valid: errors.length === 0, errors };
  }

  private buildTweetText(opts: PublishOptions): string {
    const parts: string[] = [];
    if (opts.title) parts.push(opts.title);
    if (opts.description) parts.push(opts.description);
    if (opts.tags?.length) parts.push(opts.tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' '));
    // X limit: 280 chars for standard accounts
    return parts.join('\n\n').slice(0, 280);
  }

  private async uploadMedia(accessToken: string, mediaUrl: string, isVideo: boolean): Promise<string> {
    const mediaResp = await axios.get<Buffer>(mediaUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(mediaResp.data);
    const mediaType = isVideo ? 'video/mp4' : 'image/jpeg';
    const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';

    if (!isVideo || buffer.byteLength <= CHUNK_SIZE) {
      // Single upload via media_data (base64) — no form-data dependency
      const resp = await axios.post<{ media_id_string: string }>(
        X_UPLOAD,
        new URLSearchParams({
          media_data: buffer.toString('base64'),
          media_category: mediaCategory,
        }).toString(),
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      return resp.data.media_id_string;
    }

    // Chunked upload for large videos
    return this.chunkedUpload(accessToken, buffer, mediaType, mediaCategory);
  }

  private async chunkedUpload(
    accessToken: string,
    buffer: Buffer,
    mediaType: string,
    mediaCategory: string,
  ): Promise<string> {
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' };

    // INIT
    const initResp = await axios.post<{ media_id_string: string }>(
      X_UPLOAD,
      new URLSearchParams({
        command: 'INIT',
        total_bytes: String(buffer.byteLength),
        media_type: mediaType,
        media_category: mediaCategory,
      }).toString(),
      { headers },
    );
    const mediaId = initResp.data.media_id_string;

    // APPEND chunks — use media_data (base64) to avoid binary multipart
    const chunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      const chunk = buffer.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await axios.post(
        X_UPLOAD,
        new URLSearchParams({
          command: 'APPEND',
          media_id: mediaId,
          segment_index: String(i),
          media_data: chunk.toString('base64'),
        }).toString(),
        { headers },
      );
    }

    // FINALIZE
    await axios.post(
      X_UPLOAD,
      new URLSearchParams({ command: 'FINALIZE', media_id: mediaId }).toString(),
      { headers },
    );

    // Poll until processing complete
    await this.waitForMediaProcessing(accessToken, mediaId);
    return mediaId;
  }

  private async waitForMediaProcessing(
    accessToken: string,
    mediaId: string,
    maxWaitMs = 120_000,
  ): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const resp = await axios.get<{
        processing_info?: { state: string; check_after_secs?: number };
      }>(X_UPLOAD, {
        params: { command: 'STATUS', media_id: mediaId },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const info = resp.data.processing_info;
      if (!info || info.state === 'succeeded') return;
      if (info.state === 'failed') throw new Error('X media processing failed');
      const waitSecs = info.check_after_secs ?? 5;
      await new Promise(r => setTimeout(r, waitSecs * 1000));
    }
    throw new Error('X media processing timed out');
  }
}
