import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../../channels/token-encryption.service';
import { IPlatformProvider, PublishOptions, PublishResult, ConnectionStatus } from '../platform.types';

const FB_GRAPH = 'https://graph.facebook.com/v19.0';

interface StoredTokens {
  accessToken: string;
  igUserId: string;
  pageId: string;
  expiresAt?: string;
}

@Injectable()
export class InstagramPlatformProvider implements IPlatformProvider {
  readonly platformId = 'instagram';
  readonly name = 'Instagram';
  private readonly logger = new Logger(InstagramPlatformProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: TokenEncryptionService,
  ) {}

  private async getTokens(userId: string): Promise<StoredTokens | null> {
    const conn = await this.prisma.platformConnection.findUnique({
      where: { userId_platformId: { userId, platformId: 'instagram' } },
    });
    if (!conn) return null;
    try {
      return JSON.parse(this.enc.decrypt(conn.encryptedTokens)) as StoredTokens;
    } catch {
      return null;
    }
  }

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const conn = await this.prisma.platformConnection.findUnique({
      where: { userId_platformId: { userId, platformId: 'instagram' } },
      select: { accountName: true, accountId: true },
    });
    if (!conn) return { connected: false };
    return {
      connected: true,
      accountName: conn.accountName ?? undefined,
      accountId: conn.accountId,
    };
  }

  async getOAuthUrl(userId: string, returnUrl: string): Promise<string> {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const params = new URLSearchParams({ userId, returnTo: returnUrl });
    return `${apiBase}/platforms/instagram/auth?${params.toString()}`;
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.platformConnection.deleteMany({
      where: { userId, platformId: 'instagram' },
    });
  }

  async publish(userId: string, opts: PublishOptions): Promise<PublishResult> {
    const tokens = await this.getTokens(userId);
    if (!tokens) throw new Error('Instagram not connected — complete OAuth first');
    const { accessToken, igUserId } = tokens;

    const isVideo = Boolean(opts.videoFilePath && /\.(mp4|mov|avi)$/i.test(opts.videoFilePath));
    const caption = this.buildCaption(opts);
    let containerId: string;

    if (isVideo) {
      const containerResp = await axios.post<{ id: string }>(
        `${FB_GRAPH}/${igUserId}/media`,
        null,
        {
          params: {
            media_type: 'REELS',
            video_url: opts.videoFilePath,
            caption,
            share_to_feed: 'true',
            access_token: accessToken,
          },
        },
      );
      containerId = containerResp.data.id;
      await this.waitForContainer(containerId, accessToken);
    } else {
      const imageUrl = opts.thumbnailFilePath ?? opts.videoFilePath;
      if (!imageUrl) throw new Error('No image or video URL provided');
      const containerResp = await axios.post<{ id: string }>(
        `${FB_GRAPH}/${igUserId}/media`,
        null,
        { params: { image_url: imageUrl, caption, access_token: accessToken } },
      );
      containerId = containerResp.data.id;
    }

    const publishResp = await axios.post<{ id: string }>(
      `${FB_GRAPH}/${igUserId}/media_publish`,
      null,
      { params: { creation_id: containerId, access_token: accessToken } },
    );

    const postId = publishResp.data.id;
    return {
      platformPostId: postId,
      url: `https://www.instagram.com/p/${postId}`,
      publishedAt: new Date(),
    };
  }

  async schedule(
    userId: string,
    opts: PublishOptions & { scheduledAt: Date },
  ): Promise<PublishResult> {
    // Instagram Graph API does not support scheduled publishing for Reels via API.
    // Fall through to immediate publish — callers should queue this via BullMQ delay.
    this.logger.warn('Instagram scheduling via API is unsupported; publishing immediately');
    return this.publish(userId, opts);
  }

  validate(opts: PublishOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!opts.videoFilePath && !opts.thumbnailFilePath) {
      errors.push('A video URL (Reel) or image URL is required');
    }
    if (this.buildCaption(opts).length > 2200) {
      errors.push('Caption exceeds Instagram 2200-character limit');
    }
    return { valid: errors.length === 0, errors };
  }

  private buildCaption(opts: PublishOptions): string {
    const parts: string[] = [];
    if (opts.title) parts.push(opts.title);
    if (opts.description) parts.push(opts.description);
    if (opts.tags?.length) {
      parts.push(opts.tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' '));
    }
    return parts.join('\n\n').slice(0, 2200);
  }

  private async waitForContainer(
    containerId: string,
    accessToken: string,
    maxWaitMs = 120_000,
  ): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const resp = await axios.get<{ status_code: string }>(`${FB_GRAPH}/${containerId}`, {
        params: { fields: 'status_code', access_token: accessToken },
      });
      const status = resp.data.status_code;
      if (status === 'FINISHED') return;
      if (status === 'ERROR') throw new Error('Instagram video processing failed');
      await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error('Instagram video processing timed out after 2 minutes');
  }
}
