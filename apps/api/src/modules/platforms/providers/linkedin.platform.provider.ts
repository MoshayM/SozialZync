import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../../channels/token-encryption.service';
import { IPlatformProvider, PublishOptions, PublishResult, ConnectionStatus } from '../platform.types';

const LI_API = 'https://api.linkedin.com/v2';

interface StoredTokens {
  accessToken: string;
  refreshToken?: string | null;
  linkedInId: string;
  expiresAt: string;
  refreshExpiresAt?: string | null;
}

interface RegisterUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
        headers: Record<string, string>;
      };
    };
    asset: string;
  };
}

@Injectable()
export class LinkedInPlatformProvider implements IPlatformProvider {
  readonly platformId = 'linkedin';
  readonly name = 'LinkedIn';
  private readonly logger = new Logger(LinkedInPlatformProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: TokenEncryptionService,
  ) {}

  private async getTokens(userId: string): Promise<StoredTokens | null> {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { userId, platformId: 'linkedin', readOnly: false },
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
      where: { userId, platformId: 'linkedin', readOnly: false },
      select: { accountName: true, accountId: true },
    });
    if (!conn) return { connected: false };
    return { connected: true, accountName: conn.accountName ?? undefined, accountId: conn.accountId };
  }

  async getOAuthUrl(userId: string, returnUrl: string): Promise<string> {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    return `${apiBase}/platforms/linkedin/auth?userId=${encodeURIComponent(userId)}&returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.platformConnection.deleteMany({ where: { userId, platformId: 'linkedin' } });
  }

  async publish(userId: string, opts: PublishOptions): Promise<PublishResult> {
    const tokens = await this.getTokens(userId);
    if (!tokens) throw new Error('LinkedIn not connected — complete OAuth first');
    const { accessToken, linkedInId } = tokens;

    const authorUrn = `urn:li:person:${linkedInId}`;
    const commentary = this.buildCommentary(opts);
    const isVideo = Boolean(opts.videoFilePath && /\.(mp4|mov|avi|webm)$/i.test(opts.videoFilePath));

    let mediaAsset: string | null = null;
    if (isVideo && opts.videoFilePath) {
      mediaAsset = await this.uploadMedia(accessToken, opts.videoFilePath, 'urn:li:digitalmediaRecipe:feedshare-video', 'video/mp4');
    } else if (opts.thumbnailFilePath) {
      mediaAsset = await this.uploadMedia(accessToken, opts.thumbnailFilePath, 'urn:li:digitalmediaRecipe:feedshare-image', 'image/jpeg');
    }

    const postBody = this.buildUgcPost(authorUrn, commentary, opts.title, mediaAsset, isVideo);
    const resp = await axios.post<{ id?: string }>(
      `${LI_API}/ugcPosts`,
      postBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
        },
      },
    );

    // LinkedIn returns the post ID in the x-restli-id header
    const postId = (resp.headers['x-restli-id'] as string | undefined) ?? resp.data.id ?? 'unknown';
    this.logger.log(`LinkedIn post created: ${postId}`);
    return {
      platformPostId: postId,
      url: `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}/`,
      publishedAt: new Date(),
    };
  }

  async schedule(userId: string, opts: PublishOptions & { scheduledAt: Date }): Promise<PublishResult> {
    // LinkedIn UGC Posts API does not support native scheduling — BullMQ delay handles timing.
    this.logger.warn('LinkedIn does not support native scheduled publishing; publishing immediately');
    return this.publish(userId, opts);
  }

  validate(opts: PublishOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!opts.title && !opts.description) errors.push('Title or description is required');
    if (this.buildCommentary(opts).length > 3000) errors.push('Post text exceeds LinkedIn 3000-character limit');
    return { valid: errors.length === 0, errors };
  }

  private buildCommentary(opts: PublishOptions): string {
    const parts: string[] = [];
    if (opts.title) parts.push(opts.title);
    if (opts.description) parts.push(opts.description);
    if (opts.tags?.length) parts.push(opts.tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' '));
    return parts.join('\n\n').slice(0, 3000);
  }

  private buildUgcPost(
    authorUrn: string,
    commentary: string,
    title: string | undefined,
    mediaAsset: string | null,
    isVideo: boolean,
  ): object {
    if (!mediaAsset) {
      return {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: commentary },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      };
    }

    return {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: commentary },
          shareMediaCategory: isVideo ? 'VIDEO' : 'IMAGE',
          media: [{
            status: 'READY',
            media: mediaAsset,
            title: { text: (title ?? '').slice(0, 200) },
          }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };
  }

  private async uploadMedia(
    accessToken: string,
    mediaUrl: string,
    recipe: string,
    contentType: string,
  ): Promise<string> {
    // Step 1: Register upload with LinkedIn
    const registerResp = await axios.post<RegisterUploadResponse>(
      `${LI_API}/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: [recipe],
          owner: 'urn:li:person:me',
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          }],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
        },
      },
    );

    const mechanism = registerResp.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
    const { uploadUrl, headers: uploadHeaders } = mechanism;
    const assetUrn = registerResp.data.value.asset;

    // Step 2: Fetch the media bytes from CDN and upload to LinkedIn
    const mediaResp = await axios.get<Buffer>(mediaUrl, { responseType: 'arraybuffer' });
    await axios.put(uploadUrl, mediaResp.data, {
      headers: {
        ...uploadHeaders,
        'Content-Type': contentType,
      },
    });

    this.logger.log(`LinkedIn media uploaded: ${assetUrn}`);
    return assetUrn;
  }
}
