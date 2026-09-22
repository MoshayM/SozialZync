import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../../channels/token-encryption.service';
import { IPlatformProvider, PublishOptions, PublishResult, ConnectionStatus } from '../platform.types';

const FB_GRAPH = 'https://graph.facebook.com/v19.0';

interface StoredTokens {
  accessToken: string;
  pageId: string;
  pageAccessToken: string;
  expiresAt?: string;
}

@Injectable()
export class FacebookPlatformProvider implements IPlatformProvider {
  readonly platformId = 'facebook';
  readonly name = 'Facebook';
  private readonly logger = new Logger(FacebookPlatformProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: TokenEncryptionService,
  ) {}

  private async getTokens(userId: string): Promise<StoredTokens | null> {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { userId, platformId: 'facebook', readOnly: false },
    });
    if (!conn) return null;
    try {
      return JSON.parse(this.enc.decrypt(conn.encryptedTokens)) as StoredTokens;
    } catch {
      return null;
    }
  }

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { userId, platformId: 'facebook', readOnly: false },
      select: { accountName: true, accountId: true },
    });
    if (!conn) return { connected: false };
    return { connected: true, accountName: conn.accountName ?? undefined, accountId: conn.accountId };
  }

  async getOAuthUrl(userId: string, returnUrl: string): Promise<string> {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const params = new URLSearchParams({ userId, returnTo: returnUrl });
    return `${apiBase}/platforms/facebook/auth?${params.toString()}`;
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.platformConnection.deleteMany({
      where: { userId, platformId: 'facebook' },
    });
  }

  async publish(userId: string, opts: PublishOptions): Promise<PublishResult> {
    const tokens = await this.getTokens(userId);
    if (!tokens) throw new Error('Facebook not connected — complete OAuth first');
    const { pageAccessToken, pageId } = tokens;

    const message = this.buildMessage(opts);
    const isVideo = Boolean(opts.videoFilePath && /\.(mp4|mov|avi|webm)$/i.test(opts.videoFilePath));

    if (isVideo && opts.videoFilePath) {
      const resp = await axios.post<{ id: string }>(
        `${FB_GRAPH}/${pageId}/videos`,
        null,
        {
          params: {
            file_url: opts.videoFilePath,
            title: opts.title,
            description: message,
            access_token: pageAccessToken,
          },
        },
      );
      const videoId = resp.data.id;
      this.logger.log(`Facebook video posted to page ${pageId}: ${videoId}`);
      return {
        platformPostId: videoId,
        url: `https://www.facebook.com/${pageId}/videos/${videoId}`,
        publishedAt: new Date(),
      };
    }

    if (opts.thumbnailFilePath) {
      const resp = await axios.post<{ id: string; post_id?: string }>(
        `${FB_GRAPH}/${pageId}/photos`,
        null,
        {
          params: {
            url: opts.thumbnailFilePath,
            caption: message,
            access_token: pageAccessToken,
          },
        },
      );
      const postId = resp.data.post_id ?? resp.data.id;
      this.logger.log(`Facebook photo posted to page ${pageId}: ${postId}`);
      return {
        platformPostId: postId,
        url: `https://www.facebook.com/${pageId}`,
        publishedAt: new Date(),
      };
    }

    // Text-only post
    const resp = await axios.post<{ id: string }>(
      `${FB_GRAPH}/${pageId}/feed`,
      null,
      {
        params: {
          message,
          access_token: pageAccessToken,
        },
      },
    );
    const postId = resp.data.id;
    const parts = postId.split('_');
    const storyId = parts.length > 1 ? parts[1] : postId;
    this.logger.log(`Facebook text post to page ${pageId}: ${postId}`);
    return {
      platformPostId: postId,
      url: `https://www.facebook.com/permalink.php?story_fbid=${storyId}&id=${pageId}`,
      publishedAt: new Date(),
    };
  }

  async schedule(userId: string, opts: PublishOptions & { scheduledAt: Date }): Promise<PublishResult> {
    const tokens = await this.getTokens(userId);
    if (!tokens) throw new Error('Facebook not connected — complete OAuth first');
    const { pageAccessToken, pageId } = tokens;

    const scheduledTime = Math.floor(opts.scheduledAt.getTime() / 1000);
    const message = this.buildMessage(opts);

    const resp = await axios.post<{ id: string }>(
      `${FB_GRAPH}/${pageId}/feed`,
      null,
      {
        params: {
          message,
          published: 'false',
          scheduled_publish_time: scheduledTime,
          access_token: pageAccessToken,
        },
      },
    );
    const postId = resp.data.id;
    const parts = postId.split('_');
    const storyId = parts.length > 1 ? parts[1] : postId;
    this.logger.log(`Facebook post scheduled on page ${pageId} at ${opts.scheduledAt.toISOString()}: ${postId}`);
    return {
      platformPostId: postId,
      url: `https://www.facebook.com/permalink.php?story_fbid=${storyId}&id=${pageId}`,
      publishedAt: opts.scheduledAt,
    };
  }

  validate(opts: PublishOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!opts.title && !opts.description) errors.push('Title or description is required');
    return { valid: errors.length === 0, errors };
  }

  private buildMessage(opts: PublishOptions): string {
    const parts: string[] = [];
    if (opts.title) parts.push(opts.title);
    if (opts.description) parts.push(opts.description);
    if (opts.tags?.length) parts.push(opts.tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' '));
    return parts.join('\n\n').slice(0, 63_206);
  }
}
