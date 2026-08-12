'use client';
import React, { useState, useCallback } from 'react';
import { Search, Loader2, Image as ImageIcon, Download, ExternalLink, X } from 'lucide-react';

interface ExternalImage {
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
  attribution: string;
  externalUrl: string;
}

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pexels: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  unsplash: { bg: '#f5f5f4', text: '#292524', border: '#d6d3d1' },
  pixabay: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  openverse: { bg: '#fdf4ff', text: '#9333ea', border: '#e9d5ff' },
};

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'pexels', label: 'Pexels' },
  { value: 'unsplash', label: 'Unsplash' },
  { value: 'pixabay', label: 'Pixabay' },
  { value: 'openverse', label: 'Openverse (CC)' },
];

const TOPIC_SUGGESTIONS = ['technology', 'business', 'nature', 'people', 'office', 'travel', 'food', 'fitness', 'education', 'gaming'];

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cf_token') ?? '';
}

interface ImageAssetBrowserProps {
  onSelect?: (image: ExternalImage) => void;
  compact?: boolean;
}

export function ImageAssetBrowser({ onSelect, compact = false }: ImageAssetBrowserProps) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<string>('all');
  const [images, setImages] = useState<ExternalImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExternalImage | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setSearched(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), perPage: '24' });
      if (source !== 'all') params.set('source', source);
      const res = await fetch(`/api/proxy/media-library/images/search?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setImages(await res.json() as ExternalImage[]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Search failed'); }
    finally { setLoading(false); }
  }, [source]);

  const trending = useCallback(async (topic: string) => {
    setQuery(topic);
    await search(topic);
  }, [search]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void search(query); }}
              placeholder="Search royalty-free images…"
              className="w-full bg-[#faf9ff] rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20"
              style={{ border: '1.5px solid #e3ddf8' }}
            />
          </div>
          <select value={source} onChange={e => setSource(e.target.value)}
            className="bg-[#faf9ff] rounded-xl px-3 py-2.5 text-sm font-semibold outline-none" style={{ border: '1.5px solid #e3ddf8', color: '#6D4AE0' }}>
            {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => void search(query)} disabled={loading || !query.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>
        {/* Topic chips */}
        {!searched && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-gray-400 self-center">Trending:</span>
            {TOPIC_SUGGESTIONS.map(t => (
              <button key={t} onClick={() => void trending(t)}
                className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all hover:bg-purple-100"
                style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1px solid #e3ddf8' }}>
                {t}
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400">
          Sources: Pexels · Unsplash · Pixabay · Openverse — all royalty-free for commercial use
        </p>
      </div>

      {/* Results */}
      {loading && <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Searching…</span></div>}
      {error && <div className="py-8 text-center"><p className="text-sm text-red-500">{error}</p></div>}
      {!loading && searched && images.length === 0 && <div className="py-16 text-center"><ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-200" /><p className="text-sm text-gray-500">No images found. Try different keywords.</p></div>}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map(img => {
            const sc = SOURCE_COLORS[img.source] ?? SOURCE_COLORS.pexels;
            return (
              <div key={img.id} className="group relative bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                style={{ border: '1.5px solid #e3ddf8' }}
                onClick={() => onSelect ? onSelect(img) : setPreview(img)}>
                <div className="aspect-video overflow-hidden bg-gray-100">
                  <img
                    src={`/api/img-proxy?url=${encodeURIComponent(img.previewUrl || img.thumbnailUrl)}`}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder-image.svg'; }}
                  />
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-medium text-gray-700 truncate">{img.photographer}</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
                    style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                    {img.source}
                  </span>
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button className="w-8 h-8 rounded-xl bg-white/90 flex items-center justify-center" title="Preview">
                    <ExternalLink className="w-4 h-4 text-gray-700" />
                  </button>
                  {onSelect && (
                    <button className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs"
                      style={{ background: '#6D4AE0' }} title="Use this image">
                      +
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-size preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <img
              src={`/api/img-proxy?url=${encodeURIComponent(preview.previewUrl || preview.thumbnailUrl)}`}
              alt={preview.title}
              className="w-full max-h-[60vh] object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder-image.svg'; }}
            />
            <div className="p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">{preview.title || 'Untitled'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{preview.attribution}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={preview.externalUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
                  <ExternalLink className="w-3.5 h-3.5" /> Source
                </a>
                <a href={preview.url} download target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' }}>
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button onClick={() => setPreview(null)} className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
