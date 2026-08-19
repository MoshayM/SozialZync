import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { TrendOutputSchema, GapsOutputSchema, type TrendOutput, type GapsOutput } from '@cf/shared';

const TREND_SYSTEM = `You are a YouTube trend analyst. Identify trending topics and content opportunities based on current search data and platform patterns. Today's date: ${new Date().toISOString().split('T')[0]}.
When LIVE YOUTUBE DATA is provided, base your analysis on it — do not invent topics not supported by the live data. When no live data is available, reason from known platform patterns.`;

const GAPS_SYSTEM = `You are a YouTube content-gap analyst. Your job is to identify underserved topics — niches with clear audience demand but low-quality or low-quantity supply on YouTube. Today's date: ${new Date().toISOString().split('T')[0]}.
When LIVE YOUTUBE DATA is provided, use it to reason about what is already covered and what is missing. Return only gaps with genuine opportunity, not topics already saturated.`;

// @reason: YouTube Data API v3 response shape, not in @types
interface YTSearchItem {
  snippet?: { title?: string };
}
interface YTSearchResponse {
  items?: YTSearchItem[];
}
interface YTVideoItem {
  snippet?: { title?: string };
  statistics?: { viewCount?: string };
}
interface YTVideosResponse {
  items?: YTVideoItem[];
}

@Injectable()
export class TrendService {
  private readonly logger = new Logger(TrendService.name);

  private async fetchYouTubeTrendingContext(niche: string): Promise<string> {
    const apiKey = process.env['YOUTUBE_API_KEY'];
    if (!apiKey) return '';

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().split('T')[0];

    try {
      const [nicheRes, globalRes] = await Promise.all([
        fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(niche)}&type=video&order=viewCount&publishedAfter=${sevenDaysAgo}&maxResults=15&key=${apiKey}`,
        ).catch(() => null),
        fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=15&key=${apiKey}`,
        ).catch(() => null),
      ]);

      const nicheTitles: string[] = [];
      if (nicheRes?.ok) {
        const data = (await nicheRes.json().catch(() => ({}))) as YTSearchResponse;
        for (const item of data.items ?? []) {
          const title = item.snippet?.title;
          if (title) nicheTitles.push(`"${title}"`);
        }
      }

      const globalEntries: string[] = [];
      if (globalRes?.ok) {
        const data = (await globalRes.json().catch(() => ({}))) as YTVideosResponse;
        for (const item of data.items ?? []) {
          const title = item.snippet?.title;
          const views = item.statistics?.viewCount;
          if (title) {
            const viewLabel = views ? ` (${(Number(views) / 1000).toFixed(0)}k views)` : '';
            globalEntries.push(`"${title}"${viewLabel}`);
          }
        }
      }

      if (!nicheTitles.length && !globalEntries.length) return '';

      const lines: string[] = [`LIVE YOUTUBE DATA (fetched ${today}):`];
      if (nicheTitles.length) {
        lines.push(`Niche trending past 7d for "${niche}" (sorted by views): ${nicheTitles.join(', ')}`);
      }
      if (globalEntries.length) {
        lines.push(`Global trending: ${globalEntries.join(', ')}`);
      }
      return lines.join('\n');
    } catch {
      return '';
    }
  }

  private rethrowAiError(msg: string, context: string): never {
    this.logger.error(`${context} error="${msg}"`);
    if (msg.includes('ANTHROPIC_API_KEY') || msg.includes('OPENAI_API_KEY')) {
      throw new InternalServerErrorException('AI service not configured. Check ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.');
    }
    if (msg.includes('credit balance is too low') || msg.includes('insufficient_quota') || msg.includes('exceeded your current quota')) {
      throw new InternalServerErrorException('AI provider has insufficient credits. Please top up your Anthropic or OpenAI account.');
    }
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('Too Many Requests')) {
      throw new InternalServerErrorException('AI provider rate limit reached. Please wait a few seconds and try again.');
    }
    if (msg.includes('schema mismatch')) {
      throw new InternalServerErrorException(`AI returned unexpected format — ${msg}`);
    }
    if (msg.includes('JSON parse failed')) {
      throw new InternalServerErrorException('AI returned invalid JSON. Please try again.');
    }
    throw new InternalServerErrorException(`${context}: ${msg}`);
  }

  async analyze(niche: string, channelSize?: number): Promise<TrendOutput> {
    this.logger.log(`Analyzing trends — niche="${niche}" channelSize=${channelSize ?? 'unknown'}`);
    try {
      const liveContext = await this.fetchYouTubeTrendingContext(niche);
      const liveDataUsed = liveContext.length > 0;

      const contextBlock = liveDataUsed ? `${liveContext}\n\n` : '';
      const prompt = `${contextBlock}Analyze current YouTube trends for this niche:\n\nNiche: ${niche}\nChannel subscriber range: ${channelSize ? `~${channelSize}` : 'unknown'}\n\nIdentify top 10 trending topics. For each topic provide an opportunity score (integer 0–100), related keywords, and optional peak engagement time.\n\nRespond with EXACTLY this JSON structure (no extra text):\n{"trending":[{"topic":"Topic Name","score":75,"relatedKeywords":["keyword1","keyword2","keyword3"],"peakTime":"weekday evenings"}],"recommendations":["recommendation 1","recommendation 2"],"analysisDate":"${new Date().toISOString().split('T')[0]}","liveDataUsed":${liveDataUsed}}`;

      const result = await callAIStructured(
        [{ role: 'user', content: prompt }],
        TrendOutputSchema,
        { systemPrompt: TREND_SYSTEM, maxTokens: 3000 },
      );
      this.logger.log(`Trend analysis complete — niche="${niche}" topics=${result.trending.length} liveData=${liveDataUsed}`);
      return { ...result, liveDataUsed };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.rethrowAiError(msg, `Trend analysis failed — niche="${niche}"`);
    }
  }

  async gapsAnalysis(niche: string): Promise<GapsOutput> {
    this.logger.log(`Gaps analysis — niche="${niche}"`);
    try {
      const liveContext = await this.fetchYouTubeTrendingContext(niche);
      const liveDataUsed = liveContext.length > 0;

      const contextBlock = liveDataUsed ? `${liveContext}\n\n` : '';
      const prompt = `${contextBlock}Niche: "${niche}"\n\nIdentify 8 underserved content topics for this niche — ones with clear audience demand but low supply or poor-quality existing coverage on YouTube. For each gap provide:\n- topic: specific topic name\n- opportunityScore: integer 0–100 (100 = massive gap, almost no coverage)\n- whyUnderserved: 1–2 sentences on why this is underserved\n- suggestedAngle: the specific angle a creator should take to win this gap\n\nRespond with EXACTLY this JSON structure:\n{"gaps":[{"topic":"...","opportunityScore":80,"whyUnderserved":"...","suggestedAngle":"..."}],"niche":"${niche}","analysisDate":"${new Date().toISOString().split('T')[0]}","liveDataUsed":${liveDataUsed}}`;

      const result = await callAIStructured(
        [{ role: 'user', content: prompt }],
        GapsOutputSchema,
        { systemPrompt: GAPS_SYSTEM, maxTokens: 3000 },
      );
      this.logger.log(`Gaps analysis complete — niche="${niche}" gaps=${result.gaps.length} liveData=${liveDataUsed}`);
      return { ...result, liveDataUsed };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.rethrowAiError(msg, `Gaps analysis failed — niche="${niche}"`);
    }
  }
}
