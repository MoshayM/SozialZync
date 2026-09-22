import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import axios from 'axios';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../../channels/token-encryption.service';
import { IPlatformProvider, PublishOptions, PublishResult, ConnectionStatus } from '../platform.types';

const X_UPLOAD = 'https://upload.twitter.com/1.1/media/upload.json';
const X_TWEET  = 'https://api.twitter.com/2/tweets';

const CHUNK_SIZE = 5 * 1024 * 1024;

interface StoredTokens {
  accessToken: string;
  accessTokenSecret: string;
  xUserId: string;
  screenName: string;
}

function oauthSign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret = '',
): string {
  const encode = (s: string) => encodeURIComponent(s);
  const sorted = Object.keys(params).sort()
    .map(k => `${encode(k)}=${encode(params[k]!)}`)
    .join('&');
  const base = `${method}&${encode(url)}&${encode(sorted)}`;
  const signingKey = `${encode(consumerSecret)}&${encode(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(base).digest('base64');
}

function buildOAuthHeader(
  method: string,
  url: string,
  bodyParams: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  token: string,
  tokenSecret: string,
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };

  oauthParams['oauth_signature'] = oauthSign(
    method, url, { ...bodyParams, ...oauthParams }, consumerSecret, tokenSecret,
  );

  const encode = (s: string) => encodeURIComponent(s);
  return 'OAuth ' + Object.keys(oauthParams)
    .filter(k => k.startsWith('oauth_'))
    .sort()
    .map(k => `${encode(k)}="${encode(oauthParams[k]!)}"`)
    .join(', ');
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

  private get consumerKey()    { return process.env['X_API_KEY']    ?? ''; }
  private get consumerSecret() { return process.env['X_API_SECRET'] ?? ''; }

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

  private authHeader(method: string, url: string, bodyParams: Record<string, string>, tokens: StoredTokens) {
    return buildOAuthHeader(method, url, bodyParams, this.consumerKey, this.consumerSecret, tokens.accessToken, tokens.accessTokenSecret);
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
    const tokens = await this.getTokens(userId);
    if (!tokens) throw new Error('X not connected — complete OAuth first');

    const text = this.buildTweetText(opts);
    const body: Record<string, unknown> = { text };

    const isVideo = Boolean(opts.videoFilePath && /\.(mp4|mov|avi|webm)$/i.test(opts.videoFilePath));
    const mediaUrl = isVideo ? opts.videoFilePath : opts.thumbnailFilePath;

    if (mediaUrl) {
      const mediaId = await this.uploadMedia(tokens, mediaUrl, isVideo);
      body['media'] = { media_ids: [mediaId] };
    }

    // v2 tweets endpoint uses OAuth 1.0a user context
    const authHeader = this.authHeader('POST', X_TWEET, {}, tokens);
    const resp = await axios.post<{ data: { id: string; text: string } }>(
      X_TWEET,
      body,
      { headers: { Authorization: authHeader, 'Content-Type': 'application/json' } },
    );

    const tweetId = resp.data.data.id;
    this.logger.log(`X tweet posted: ${tweetId} by @${tokens.screenName}`);
    return {
      platformPostId: tweetId,
      url: `https://x.com/${tokens.screenName}/status/${tweetId}`,
      publishedAt: new Date(),
    };
  }

  async schedule(userId: string, opts: PublishOptions & { scheduledAt: Date }): Promise<PublishResult> {
    this.logger.warn('X does not support native scheduled tweets; publishing immediately via BullMQ delay');
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
    return parts.join('\n\n').slice(0, 280);
  }

  private async uploadMedia(tokens: StoredTokens, mediaUrl: string, isVideo: boolean): Promise<string> {
    const mediaResp = await axios.get<Buffer>(mediaUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(mediaResp.data);
    const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';
    const mediaType = isVideo ? 'video/mp4' : 'image/jpeg';

    if (!isVideo || buffer.byteLength <= CHUNK_SIZE) {
      const bodyParams = { media_category: mediaCategory };
      const authHeader = this.authHeader('POST', X_UPLOAD, bodyParams, tokens);
      const resp = await axios.post<{ media_id_string: string }>(
        X_UPLOAD,
        new URLSearchParams({ ...bodyParams, media_data: buffer.toString('base64') }).toString(),
        { headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      return resp.data.media_id_string;
    }

    return this.chunkedUpload(tokens, buffer, mediaType, mediaCategory);
  }

  private async chunkedUpload(
    tokens: StoredTokens,
    buffer: Buffer,
    mediaType: string,
    mediaCategory: string,
  ): Promise<string> {
    // INIT
    const initParams = { command: 'INIT', total_bytes: String(buffer.byteLength), media_type: mediaType, media_category: mediaCategory };
    const initHeader = this.authHeader('POST', X_UPLOAD, initParams, tokens);
    const initResp = await axios.post<{ media_id_string: string }>(
      X_UPLOAD,
      new URLSearchParams(initParams).toString(),
      { headers: { Authorization: initHeader, 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const mediaId = initResp.data.media_id_string;

    // APPEND
    const chunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      const chunk = buffer.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const appendParams = { command: 'APPEND', media_id: mediaId, segment_index: String(i) };
      const appendHeader = this.authHeader('POST', X_UPLOAD, appendParams, tokens);
      await axios.post(
        X_UPLOAD,
        new URLSearchParams({ ...appendParams, media_data: chunk.toString('base64') }).toString(),
        { headers: { Authorization: appendHeader, 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
    }

    // FINALIZE
    const finalParams = { command: 'FINALIZE', media_id: mediaId };
    const finalHeader = this.authHeader('POST', X_UPLOAD, finalParams, tokens);
    await axios.post(
      X_UPLOAD,
      new URLSearchParams(finalParams).toString(),
      { headers: { Authorization: finalHeader, 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    await this.waitForMediaProcessing(tokens, mediaId);
    return mediaId;
  }

  private async waitForMediaProcessing(tokens: StoredTokens, mediaId: string, maxWaitMs = 120_000): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const statusParams = { command: 'STATUS', media_id: mediaId };
      const statusHeader = this.authHeader('GET', X_UPLOAD, statusParams, tokens);
      const resp = await axios.get<{ processing_info?: { state: string; check_after_secs?: number } }>(
        X_UPLOAD,
        { params: statusParams, headers: { Authorization: statusHeader } },
      );
      const info = resp.data.processing_info;
      if (!info || info.state === 'succeeded') return;
      if (info.state === 'failed') throw new Error('X media processing failed');
      await new Promise(r => setTimeout(r, (info.check_after_secs ?? 5) * 1000));
    }
    throw new Error('X media processing timed out');
  }
}
