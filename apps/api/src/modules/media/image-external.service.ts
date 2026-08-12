import { Injectable, Logger } from '@nestjs/common';

export interface ExternalImage {
  id: string;
  source: 'pexels' | 'unsplash' | 'pixabay' | 'openverse';
  title: string;
  photographer: string;
  photographerUrl?: string;
  url: string;
  thumbnailUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  tags: string[];
  license: string;
  licenseUrl: string;
  attribution: string;
  externalUrl: string;
}

interface PexelsPhoto {
  id: number;
  photographer: string;
  photographer_url: string;
  alt?: string;
  width: number;
  height: number;
  url: string;
  src: { original: string; large: string; medium: string; tiny: string };
}
interface PexelsResponse { photos: PexelsPhoto[]; }

interface UnsplashPhoto {
  id: string;
  description?: string;
  alt_description?: string;
  width: number;
  height: number;
  urls: { raw: string; full: string; regular: string; thumb: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
  tags?: Array<{ title: string }>;
}
interface UnsplashResponse { results: UnsplashPhoto[]; }

interface PixabayImageHit {
  id: number;
  tags: string;
  webformatURL: string;
  largeImageURL: string;
  previewURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
  pageURL: string;
}
interface PixabayImageResponse { hits: PixabayImageHit[]; }

interface OpenverseResult {
  id: string;
  title: string;
  creator?: string;
  creator_url?: string;
  url: string;
  thumbnail: string | null;
  width?: number;
  height?: number;
  tags?: Array<{ name: string }>;
  license: string;
  license_url?: string;
  foreign_landing_url: string;
}
interface OpenverseResponse { results: OpenverseResult[]; }

@Injectable()
export class ImageExternalService {
  private readonly logger = new Logger(ImageExternalService.name);
  private readonly pexelsBase = 'https://api.pexels.com/v1';
  private readonly unsplashBase = 'https://api.unsplash.com';
  private readonly pixabayBase = 'https://pixabay.com/api';
  private readonly openverseBase = 'https://api.openverse.org/v1';

  private get pexelsKey(): string { return process.env['PEXELS_API_KEY'] ?? ''; }
  private get unsplashKey(): string { return process.env['UNSPLASH_ACCESS_KEY'] ?? ''; }
  private get pixabayKey(): string { return process.env['PIXABAY_API_KEY'] ?? ''; }

  getProviders() {
    return {
      pexels:    { available: !!this.pexelsKey,   envVar: 'PEXELS_API_KEY',      signupUrl: 'https://www.pexels.com/api/' },
      unsplash:  { available: !!this.unsplashKey,  envVar: 'UNSPLASH_ACCESS_KEY', signupUrl: 'https://unsplash.com/developers' },
      pixabay:   { available: !!this.pixabayKey,   envVar: 'PIXABAY_API_KEY',     signupUrl: 'https://pixabay.com/api/docs/' },
      openverse: { available: true,                envVar: null,                  signupUrl: null },
    };
  }

  async search(params: {
    q: string;
    source?: 'pexels' | 'unsplash' | 'pixabay' | 'openverse' | 'all';
    orientation?: 'landscape' | 'portrait' | 'square';
    perPage?: number;
  }): Promise<ExternalImage[]> {
    const { q, source = 'all', perPage = 20 } = params;
    const results: ExternalImage[] = [];

    const tasks: Array<Promise<ExternalImage[]>> = [];

    if ((source === 'all' || source === 'pexels') && this.pexelsKey) {
      tasks.push(this.searchPexels(q, perPage).catch(e => { this.logger.warn('Pexels failed', e); return []; }));
    }
    if ((source === 'all' || source === 'unsplash') && this.unsplashKey) {
      tasks.push(this.searchUnsplash(q, perPage).catch(e => { this.logger.warn('Unsplash failed', e); return []; }));
    }
    if ((source === 'all' || source === 'pixabay') && this.pixabayKey) {
      tasks.push(this.searchPixabay(q, perPage).catch(e => { this.logger.warn('Pixabay failed', e); return []; }));
    }
    if (source === 'all' || source === 'openverse') {
      tasks.push(this.searchOpenverse(q, Math.min(perPage, 20)).catch(e => { this.logger.warn('Openverse failed', e); return []; }));
    }

    const settled = await Promise.all(tasks);
    settled.forEach(batch => results.push(...batch));
    return results;
  }

  async getTrending(topic: string = 'technology'): Promise<ExternalImage[]> {
    return this.search({ q: topic, perPage: 20 });
  }

  private async searchPexels(q: string, perPage: number): Promise<ExternalImage[]> {
    const qs = new URLSearchParams({ query: q, per_page: String(perPage), orientation: 'landscape' });
    const res = await fetch(`${this.pexelsBase}/search?${qs}`, { headers: { Authorization: this.pexelsKey } });
    if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
    const data = await res.json() as PexelsResponse;
    return (data.photos ?? []).map(p => ({
      id: `pexels-${p.id}`,
      source: 'pexels' as const,
      title: p.alt ?? q,
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      url: p.src.original,
      thumbnailUrl: p.src.tiny,
      previewUrl: p.src.medium,
      width: p.width,
      height: p.height,
      tags: [q],
      license: 'pexels-free',
      licenseUrl: 'https://www.pexels.com/license/',
      attribution: `Photo by ${p.photographer} on Pexels`,
      externalUrl: p.url,
    }));
  }

  private async searchUnsplash(q: string, perPage: number): Promise<ExternalImage[]> {
    const qs = new URLSearchParams({ query: q, per_page: String(perPage), orientation: 'landscape' });
    const res = await fetch(`${this.unsplashBase}/search/photos?${qs}`, {
      headers: { Authorization: `Client-ID ${this.unsplashKey}` },
    });
    if (!res.ok) throw new Error(`Unsplash HTTP ${res.status}`);
    const data = await res.json() as UnsplashResponse;
    return (data.results ?? []).map(p => ({
      id: `unsplash-${p.id}`,
      source: 'unsplash' as const,
      title: p.description ?? p.alt_description ?? q,
      photographer: p.user.name,
      photographerUrl: p.user.links.html,
      url: p.urls.full,
      thumbnailUrl: p.urls.thumb,
      previewUrl: p.urls.regular,
      width: p.width,
      height: p.height,
      tags: p.tags?.map(t => t.title) ?? [q],
      license: 'unsplash-free',
      licenseUrl: 'https://unsplash.com/license',
      attribution: `Photo by ${p.user.name} on Unsplash`,
      externalUrl: p.links.html,
    }));
  }

  private async searchPixabay(q: string, perPage: number): Promise<ExternalImage[]> {
    const qs = new URLSearchParams({ key: this.pixabayKey, q, per_page: String(perPage), image_type: 'photo', orientation: 'horizontal' });
    const res = await fetch(`${this.pixabayBase}/?${qs}`);
    if (!res.ok) throw new Error(`Pixabay HTTP ${res.status}`);
    const data = await res.json() as PixabayImageResponse;
    return (data.hits ?? []).map(p => ({
      id: `pixabay-${p.id}`,
      source: 'pixabay' as const,
      title: p.tags,
      photographer: p.user,
      url: p.largeImageURL,
      thumbnailUrl: p.previewURL,
      previewUrl: p.webformatURL,
      width: p.imageWidth,
      height: p.imageHeight,
      tags: p.tags.split(',').map(s => s.trim()),
      license: 'pixabay-free',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      attribution: `Image by ${p.user} on Pixabay`,
      externalUrl: p.pageURL,
    }));
  }

  private async searchOpenverse(q: string, perPage: number): Promise<ExternalImage[]> {
    const qs = new URLSearchParams({ q, page_size: String(perPage), license_type: 'commercial', media_type: 'image' });
    const res = await fetch(`${this.openverseBase}/images/?${qs}`);
    if (!res.ok) throw new Error(`Openverse HTTP ${res.status}`);
    const data = await res.json() as OpenverseResponse;
    return (data.results ?? [])
      .filter(p => p.url)
      .map(p => {
        const toHttps = (u: string) => u.replace(/^http:/, 'https:');
        const thumb = p.thumbnail ? toHttps(p.thumbnail) : toHttps(p.url);
        return {
          id: `openverse-${p.id}`,
          source: 'openverse' as const,
          title: p.title || q,
          photographer: p.creator ?? 'Unknown',
          photographerUrl: p.creator_url,
          url: toHttps(p.url),
          thumbnailUrl: thumb,
          previewUrl: thumb,
          width: p.width ?? 800,
          height: p.height ?? 600,
          tags: p.tags?.map(t => t.name) ?? [],
          license: p.license,
          licenseUrl: p.license_url ?? 'https://creativecommons.org/licenses/',
          attribution: `"${p.title}" by ${p.creator ?? 'Unknown'} (CC ${p.license.toUpperCase()})`,
          externalUrl: p.foreign_landing_url,
        };
      });
  }
}
