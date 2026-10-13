import { Injectable, Logger } from '@nestjs/common';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  provider: 'serper' | 'brave' | 'none';
}

/**
 * Thin wrapper around Serper (primary) and Brave Search (fallback).
 * Activates automatically when either API key is set — no key = returns
 * empty results, ResearchAgent falls back to training-data sources.
 *
 * Env vars: SERPER_API_KEY, BRAVE_SEARCH_API_KEY
 */
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  isAvailable(): boolean {
    return !!(process.env['SERPER_API_KEY'] ?? process.env['BRAVE_SEARCH_API_KEY']);
  }

  async search(query: string, numResults = 8): Promise<WebSearchResponse> {
    if (process.env['SERPER_API_KEY']) {
      try {
        return await this.searchSerper(query, numResults);
      } catch (err) {
        this.logger.warn(`Serper failed (${err instanceof Error ? err.message : String(err)}) — trying Brave`);
      }
    }
    if (process.env['BRAVE_SEARCH_API_KEY']) {
      try {
        return await this.searchBrave(query, numResults);
      } catch (err) {
        this.logger.warn(`Brave Search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { results: [], provider: 'none' };
  }

  private async searchSerper(query: string, num: number): Promise<WebSearchResponse> {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env['SERPER_API_KEY']!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num, gl: 'us', hl: 'en' }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Serper HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json() as {
      organic?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
    };
    const results = (data.organic ?? []).slice(0, num).map((r) => ({
      title: r.title ?? '',
      url: r.link ?? '',
      snippet: r.snippet ?? '',
      publishedAt: r.date,
    })).filter((r) => r.url);
    return { results, provider: 'serper' };
  }

  private async searchBrave(query: string, num: number): Promise<WebSearchResponse> {
    const params = new URLSearchParams({ q: query, count: String(Math.min(num, 20)) });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': process.env['BRAVE_SEARCH_API_KEY']!,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Brave Search HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json() as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
    };
    const results = (data.web?.results ?? []).slice(0, num).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.description ?? '',
      publishedAt: r.age,
    })).filter((r) => r.url);
    return { results, provider: 'brave' };
  }
}
