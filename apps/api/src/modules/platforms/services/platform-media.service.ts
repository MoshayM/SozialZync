import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../../channels/token-encryption.service';

const FB_GRAPH = 'https://graph.facebook.com/v19.0';

export interface PlatformPost {
  id: string;
  type: 'photo' | 'video' | 'reel' | 'carousel' | 'text';
  caption?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink: string;
  timestamp: string;
  metrics: { likes?: number; comments?: number; shares?: number; views?: number };
}

export interface MediaPage {
  items: PlatformPost[];
  nextCursor: string | null;
  platformId: string;
  accountName?: string;
}

@Injectable()
export class PlatformMediaService {
  private readonly logger = new Logger(PlatformMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: TokenEncryptionService,
  ) {}

  async getMedia(
    userId: string,
    platformId: string,
    opts: { type: string; limit: number; cursor?: string },
  ): Promise<MediaPage> {
    const conn = await this.prisma.platformConnection.findUnique({
      where: { userId_platformId: { userId, platformId } },
    });
    if (!conn) throw new NotFoundException(`No ${platformId} connection found`);

    let tokens: Record<string, string> = {};
    try {
      tokens = JSON.parse(this.enc.decrypt(conn.encryptedTokens)) as Record<string, string>;
    } catch {
      throw new NotFoundException(`Invalid token data for ${platformId}`);
    }

    const base: Pick<MediaPage, 'platformId' | 'accountName'> = {
      platformId,
      accountName: conn.accountName ?? undefined,
    };

    switch (platformId) {
      case 'facebook':
        return { ...base, ...await this.fetchFacebookMedia(tokens, conn.accountId, opts) };
      case 'instagram':
        return { ...base, ...await this.fetchInstagramMedia(tokens, opts) };
      default:
        return { ...base, items: [], nextCursor: null };
    }
  }

  private async fetchFacebookMedia(
    tokens: Record<string, string>,
    pageId: string,
    opts: { type: string; limit: number; cursor?: string },
  ): Promise<Pick<MediaPage, 'items' | 'nextCursor'>> {
    const token = tokens['pageAccessToken'] ?? tokens['accessToken'];

    try {
      if (opts.type === 'video') {
        return this.fetchFacebookVideos(token, pageId, opts);
      }
      if (opts.type === 'photo') {
        return this.fetchFacebookPhotos(token, pageId, opts);
      }
      // 'all', 'reel', 'carousel', 'text' → use feed
      return this.fetchFacebookFeed(token, pageId, opts);
    } catch (err) {
      this.logger.error(`Facebook media fetch failed for page ${pageId}`, err);
      return { items: [], nextCursor: null };
    }
  }

  private async fetchFacebookFeed(
    token: string,
    pageId: string,
    opts: { type: string; limit: number; cursor?: string },
  ): Promise<Pick<MediaPage, 'items' | 'nextCursor'>> {
    const params: Record<string, string | number> = {
      access_token: token,
      limit: opts.limit * 2, // fetch extra to allow client-side type filtering
      fields: [
        'id', 'message', 'story', 'permalink_url', 'created_time',
        'attachments{media_type,media,subattachments}',
        'reactions.summary(true)',
        'comments.summary(true)',
        'shares',
      ].join(','),
    };
    if (opts.cursor) params['after'] = opts.cursor;

    const resp = await axios.get<{ data: any[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `${FB_GRAPH}/${pageId}/feed`,
      { params },
    );

    const items: PlatformPost[] = resp.data.data.map((item: any) => {
      const attach = item.attachments?.data?.[0];
      const rawType = (attach?.media_type ?? '').toLowerCase();
      let type: PlatformPost['type'] = 'text';
      if (rawType === 'photo') type = 'photo';
      else if (rawType === 'video') type = 'video';
      else if (rawType === 'album' || rawType === 'multi_share') type = 'carousel';

      return {
        id: item.id,
        type,
        caption: item.message ?? item.story,
        mediaUrl: attach?.media?.image?.src,
        thumbnailUrl: attach?.media?.image?.src,
        permalink: item.permalink_url ?? `https://www.facebook.com/${item.id}`,
        timestamp: item.created_time,
        metrics: {
          likes: item.reactions?.summary?.total_count ?? 0,
          comments: item.comments?.summary?.total_count ?? 0,
          shares: item.shares?.count ?? 0,
        },
      };
    });

    const filtered = opts.type === 'all' ? items : items.filter((i) => i.type === opts.type);

    return {
      items: filtered.slice(0, opts.limit),
      nextCursor: resp.data.paging?.cursors?.after && resp.data.paging?.next
        ? resp.data.paging.cursors.after : null,
    };
  }

  private async fetchFacebookVideos(
    token: string,
    pageId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<Pick<MediaPage, 'items' | 'nextCursor'>> {
    const params: Record<string, string | number> = {
      access_token: token,
      limit: opts.limit,
      fields: 'id,title,description,permalink_url,created_time,picture,length,reactions.summary(true),comments.summary(true)',
    };
    if (opts.cursor) params['after'] = opts.cursor;

    const resp = await axios.get<{ data: any[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `${FB_GRAPH}/${pageId}/videos`,
      { params },
    );

    const items: PlatformPost[] = resp.data.data.map((item: any) => ({
      id: item.id,
      type: 'video' as const,
      caption: item.title ?? item.description,
      thumbnailUrl: item.picture,
      permalink: item.permalink_url ?? `https://www.facebook.com/${item.id}`,
      timestamp: item.created_time,
      metrics: {
        likes: item.reactions?.summary?.total_count ?? 0,
        comments: item.comments?.summary?.total_count ?? 0,
      },
    }));

    return {
      items,
      nextCursor: resp.data.paging?.cursors?.after && resp.data.paging?.next
        ? resp.data.paging.cursors.after : null,
    };
  }

  private async fetchFacebookPhotos(
    token: string,
    pageId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<Pick<MediaPage, 'items' | 'nextCursor'>> {
    const params: Record<string, string | number> = {
      access_token: token,
      limit: opts.limit,
      fields: 'id,name,created_time,picture,reactions.summary(true),comments.summary(true),link',
    };
    if (opts.cursor) params['after'] = opts.cursor;

    const resp = await axios.get<{ data: any[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `${FB_GRAPH}/${pageId}/photos?type=uploaded`,
      { params },
    );

    const items: PlatformPost[] = resp.data.data.map((item: any) => ({
      id: item.id,
      type: 'photo' as const,
      caption: item.name,
      thumbnailUrl: item.picture,
      mediaUrl: item.picture,
      permalink: item.link ?? `https://www.facebook.com/photo/${item.id}`,
      timestamp: item.created_time,
      metrics: {
        likes: item.reactions?.summary?.total_count ?? 0,
        comments: item.comments?.summary?.total_count ?? 0,
      },
    }));

    return {
      items,
      nextCursor: resp.data.paging?.cursors?.after && resp.data.paging?.next
        ? resp.data.paging.cursors.after : null,
    };
  }

  private async fetchInstagramMedia(
    tokens: Record<string, string>,
    opts: { type: string; limit: number; cursor?: string },
  ): Promise<Pick<MediaPage, 'items' | 'nextCursor'>> {
    const { accessToken, pageToken, igUserId } = tokens;
    if (!igUserId) return { items: [], nextCursor: null };
    const token = pageToken || accessToken;

    const params: Record<string, string | number> = {
      access_token: token,
      limit: opts.limit,
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    };
    if (opts.cursor) params['after'] = opts.cursor;

    try {
      const resp = await axios.get<{ data: any[]; paging?: { cursors?: { after?: string }; next?: string } }>(
        `${FB_GRAPH}/${igUserId}/media`,
        { params },
      );

      const items: PlatformPost[] = resp.data.data.map((item: any) => {
        let type: PlatformPost['type'] = 'photo';
        if (item.media_type === 'VIDEO') {
          type = item.permalink?.includes('/reel/') ? 'reel' : 'video';
        } else if (item.media_type === 'CAROUSEL_ALBUM') {
          type = 'carousel';
        }

        return {
          id: item.id,
          type,
          caption: item.caption,
          mediaUrl: item.media_url,
          thumbnailUrl: item.thumbnail_url ?? (type === 'photo' || type === 'carousel' ? item.media_url : undefined),
          permalink: item.permalink,
          timestamp: item.timestamp,
          metrics: { likes: item.like_count ?? 0, comments: item.comments_count ?? 0 },
        };
      });

      const typeMap: Record<string, PlatformPost['type'][]> = {
        photo: ['photo'],
        video: ['video'],
        reel: ['reel'],
        carousel: ['carousel'],
        all: ['photo', 'video', 'reel', 'carousel'],
      };
      const allowed = typeMap[opts.type] ?? typeMap['all']!;
      const filtered = items.filter((i) => allowed.includes(i.type));

      return {
        items: filtered,
        nextCursor: resp.data.paging?.cursors?.after && resp.data.paging?.next
          ? resp.data.paging.cursors.after : null,
      };
    } catch (err) {
      this.logger.error('Instagram media fetch failed', err);
      return { items: [], nextCursor: null };
    }
  }
}
