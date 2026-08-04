import { Injectable, Logger } from '@nestjs/common';

export interface ExternalTrack {
  externalId: string;
  source: 'jamendo' | 'pixabay';
  title: string;
  artist: string;
  album?: string;
  duration: number;
  bpm?: number;
  mood: string[];
  genre: string[];
  license: string;
  licenseUrl: string;
  audioUrl: string;
  previewUrl: string;
  imageUrl?: string;
  attribution: string;
  externalUrl: string;
}

interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_name: string;
  album_name?: string;
  image?: string;
  audio: string;
  audiodownload?: string;
  license_ccurl?: string;
  musicinfo?: {
    tags?: {
      genres?: string[];
      vartags?: string[];
    };
  };
}

interface JamendoResponse {
  results: JamendoTrack[];
}

interface PixabayMusic {
  id: number;
  title: string;
  tags: string;
  duration: number;
  user: string;
  previewURL: string;
  largeImageURL?: string;
}

interface PixabayResponse {
  hits: PixabayMusic[];
}

@Injectable()
export class MusicExternalService {
  private readonly logger = new Logger(MusicExternalService.name);
  private readonly jamendoBase = 'https://api.jamendo.com/v3.0';
  private readonly pixabayBase = 'https://pixabay.com/api/music';

  private get jamendoClientId(): string {
    return process.env['JAMENDO_CLIENT_ID'] ?? '';
  }

  private get pixabayKey(): string {
    return process.env['PIXABAY_API_KEY'] ?? '';
  }

  async getTrending(): Promise<ExternalTrack[]> {
    const results: ExternalTrack[] = [];
    try {
      const jamendo = await this.fetchJamendo({ order: 'popularity_month', limit: 20 });
      results.push(...jamendo);
    } catch (err) {
      this.logger.warn('Jamendo trending fetch failed', err);
    }
    if (this.pixabayKey) {
      try {
        const pixabay = await this.fetchPixabay({ order: 'popular', per_page: 10 });
        results.push(...pixabay);
      } catch (err) {
        this.logger.warn('Pixabay music fetch failed', err);
      }
    }
    return results;
  }

  async search(params: {
    q?: string;
    genre?: string;
    mood?: string;
    bpm?: number;
    source?: 'jamendo' | 'pixabay' | 'all';
    limit?: number;
  }): Promise<ExternalTrack[]> {
    const { q, genre, mood, source = 'all', limit = 20 } = params;
    const results: ExternalTrack[] = [];

    if (source === 'jamendo' || source === 'all') {
      try {
        const jamendo = await this.fetchJamendo({
          namesearch: q,
          tags: genre ?? mood,
          order: q ? 'relevance' : 'popularity_month',
          limit,
        });
        results.push(...jamendo);
      } catch (err) {
        this.logger.warn('Jamendo search failed', err);
      }
    }

    if (this.pixabayKey && (source === 'pixabay' || source === 'all')) {
      try {
        const pixabay = await this.fetchPixabay({
          q: q ?? genre ?? mood ?? '',
          order: 'popular',
          per_page: Math.min(limit, 20),
        });
        results.push(...pixabay);
      } catch (err) {
        this.logger.warn('Pixabay search failed', err);
      }
    }

    return results;
  }

  private async fetchJamendo(params: Record<string, string | number | undefined>): Promise<ExternalTrack[]> {
    if (!this.jamendoClientId) {
      this.logger.warn('JAMENDO_CLIENT_ID not set — skipping Jamendo');
      return [];
    }
    const qs = new URLSearchParams({
      client_id: this.jamendoClientId,
      format: 'json',
      imagesize: '200',
      audioformat: 'mp31',
      include: 'musicinfo',
    });
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) qs.set(k, String(v));
    });

    const res = await fetch(`${this.jamendoBase}/tracks/?${qs.toString()}`);
    if (!res.ok) throw new Error(`Jamendo HTTP ${res.status}`);
    const data = await res.json() as JamendoResponse;

    return (data.results ?? []).map((t): ExternalTrack => ({
      externalId: `jamendo-${t.id}`,
      source: 'jamendo',
      title: t.name,
      artist: t.artist_name,
      album: t.album_name,
      duration: t.duration,
      mood: t.musicinfo?.tags?.vartags?.slice(0, 5) ?? [],
      genre: t.musicinfo?.tags?.genres?.slice(0, 3) ?? [],
      license: this.jamendoLicenseKey(t.license_ccurl ?? ''),
      licenseUrl: t.license_ccurl ?? 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
      audioUrl: t.audio,
      previewUrl: t.audio,
      imageUrl: t.image,
      attribution: `"${t.name}" by ${t.artist_name} — Jamendo (CC)`,
      externalUrl: `https://www.jamendo.com/track/${t.id}`,
    }));
  }

  private async fetchPixabay(params: Record<string, string | number>): Promise<ExternalTrack[]> {
    const qs = new URLSearchParams({
      key: this.pixabayKey,
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });
    const res = await fetch(`${this.pixabayBase}/?${qs.toString()}`);
    if (!res.ok) throw new Error(`Pixabay HTTP ${res.status}`);
    const data = await res.json() as PixabayResponse;

    return (data.hits ?? []).map((t): ExternalTrack => ({
      externalId: `pixabay-${t.id}`,
      source: 'pixabay',
      title: t.title,
      artist: t.user,
      duration: t.duration,
      mood: t.tags.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4),
      genre: [],
      license: 'royalty-free',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      audioUrl: t.previewURL,
      previewUrl: t.previewURL,
      imageUrl: t.largeImageURL,
      attribution: `"${t.title}" by ${t.user} — Pixabay (Free)`,
      externalUrl: `https://pixabay.com`,
    }));
  }

  private jamendoLicenseKey(url: string): string {
    if (url.includes('cc0') || url.includes('/publicdomain/zero')) return 'cc0';
    if (url.includes('by-nc-sa')) return 'cc-by-nc-sa';
    if (url.includes('by-nc-nd')) return 'cc-by-nc-nd';
    if (url.includes('by-nc')) return 'cc-by-nc';
    if (url.includes('by-sa')) return 'cc-by-sa';
    if (url.includes('by-nd')) return 'cc-by-nd';
    if (url.includes('by')) return 'cc-by';
    return 'royalty-free';
  }
}
