import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface BenchmarkResult {
  channel: { id: string; title: string; subscribers: number; videoCount: number; avgViews: number };
  peers: Array<{ title: string; subscribers: number; videoCount: number }>;
  insights: string[];
  subscriberPercentile: number;
}

// @reason: YouTube Data API v3 response shapes, not in @types
interface YTSearchResponse {
  items?: Array<{ id?: { channelId?: string }; snippet?: { title?: string } }>;
}
interface YTChannelStatsResponse {
  items?: Array<{ snippet?: { title?: string }; statistics?: { subscriberCount?: string; videoCount?: string } }>;
}

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(private readonly prisma: PrismaService) {}

  async benchmark(channelId: string, userId: string): Promise<BenchmarkResult> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, userId },
      include: {
        videos: { where: { status: 'PUBLISHED' }, select: { viewCount: true }, take: 50 },
      },
    });
    if (!channel) throw new Error('Channel not found');

    const avgViews = channel.videos.length
      ? Math.round(channel.videos.reduce((s, v) => s + v.viewCount, 0) / channel.videos.length)
      : 0;

    const subs = channel.subscriberCount;
    const peers: Array<{ title: string; subscribers: number; videoCount: number }> = [];

    const apiKey = process.env['YOUTUBE_API_KEY'];
    if (apiKey && channel.title) {
      try {
        const keywords = channel.title.split(' ').slice(0, 3).join(' ');
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keywords)}&type=channel&maxResults=5&key=${apiKey}`,
        ).catch(() => null);

        if (searchRes?.ok) {
          const searchData = (await searchRes.json().catch(() => ({}))) as YTSearchResponse;
          const peerIds = (searchData.items ?? [])
            .map((i) => i?.id?.channelId)
            .filter((id): id is string => !!id && id !== channel.youtubeChannelId)
            .slice(0, 4);

          if (peerIds.length) {
            const statsRes = await fetch(
              `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${peerIds.join(',')}&key=${apiKey}`,
            ).catch(() => null);
            if (statsRes?.ok) {
              const statsData = (await statsRes.json().catch(() => ({}))) as YTChannelStatsResponse;
              for (const item of statsData.items ?? []) {
                peers.push({
                  title: item.snippet?.title ?? 'Unknown',
                  subscribers: parseInt(item.statistics?.subscriberCount ?? '0', 10),
                  videoCount: parseInt(item.statistics?.videoCount ?? '0', 10),
                });
              }
            }
          }
        }
      } catch (err) {
        this.logger.warn(`YouTube benchmark fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const allSubs = [subs, ...peers.map((p) => p.subscribers)].sort((a, b) => a - b);
    const rank = allSubs.indexOf(subs);
    const subscriberPercentile = allSubs.length > 1 ? Math.round((rank / (allSubs.length - 1)) * 100) : 50;

    const insights: string[] = [];
    if (peers.length) {
      const peerAvgSubs = Math.round(peers.reduce((s, p) => s + p.subscribers, 0) / peers.length);
      if (subs < peerAvgSubs * 0.5) {
        insights.push(`Your channel has ${Math.round((subs / peerAvgSubs) * 100)}% of similar channels' average subscribers — strong growth opportunity.`);
      } else if (subs > peerAvgSubs * 1.5) {
        insights.push('You are outperforming similar channels in subscribers — focus on monetisation and retention.');
      } else {
        insights.push('Your subscriber count is on par with similar channels in your niche.');
      }
    }
    if (avgViews > 0) {
      if (avgViews > 10000) {
        insights.push(`Strong average views (${avgViews.toLocaleString()}) — your content resonates well.`);
      } else if (avgViews < 500) {
        insights.push('Low average views suggest improving thumbnails, titles, or posting frequency.');
      }
    }
    if (!insights.length) insights.push('Connect more of your videos to build a richer benchmark.');

    return {
      channel: { id: channel.id, title: channel.title, subscribers: subs, videoCount: channel.videoCount, avgViews },
      peers,
      insights,
      subscriberPercentile,
    };
  }
}
