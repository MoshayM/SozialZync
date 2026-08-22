'use client';
import { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Link2, Loader2, ListVideo, ChevronDown,
  Music, Image, Mic, FileText, RefreshCw, CheckCircle, AlertCircle,
  Youtube, Instagram, Facebook, Video, Layers, Clock,
} from 'lucide-react';
import { api, apiClient } from '@/lib/api';
import { ChannelAccessPanel } from '@/components/channel-access-panel';
import { SocialMediaFeed } from '@/components/social-media-feed';
import { SyncBadge } from '@/components/library/SyncBadge';
import { VirtualVideoGrid } from '@/components/library/VirtualVideoGrid';
import { PlaylistsTab } from '@/components/library/PlaylistsTab';

// ── Library types ─────────────────────────────────────────────────────────────

interface AssetProject { id: string; title: string; }

interface Asset {
  id: string;
  projectId: string;
  kind: string;
  status: string;
  label: string | null;
  createdAt: string;
  versions: Array<{ id: string; version: number; provider?: string; durationMs?: number; sizeBytes?: string }>;
}

type LibTabId = 'videos' | 'playlists' | 'assets';

const LIB_TABS: Array<{ id: LibTabId; label: string; description: string }> = [
  { id: 'videos',    label: 'Videos',      description: 'Browse and search synced channel videos' },
  { id: 'playlists', label: 'Playlists',   description: 'View and manage your video playlists' },
  { id: 'assets',    label: 'Media Assets', description: 'AI-generated media assets for your projects' },
];

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MUSIC: Music, VIDEO: Video, THUMBNAIL: Image, VOICE: Mic,
  IMAGE: Image, SUBTITLE: FileText, UPLOAD: Layers, RENDER_SOURCE: Layers,
};

const STATUS_BADGE: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; style: React.CSSProperties }> = {
  BRIEFED:    { label: 'Brief ready', icon: Clock,        style: { background: '#f3f4f6', color: '#4b5563' } },
  GENERATING: { label: 'Generating',  icon: RefreshCw,    style: { background: '#eff6ff', color: '#1d4ed8' } },
  READY:      { label: 'Ready',       icon: CheckCircle,  style: { background: '#ecfdf5', color: '#065f46' } },
  ACCEPTED:   { label: 'Accepted',    icon: CheckCircle,  style: { background: '#f3f4f6', color: '#374151' } },
  FAILED:     { label: 'Failed',      icon: AlertCircle,  style: { background: '#fef2f2', color: '#dc2626' } },
};

const CHANNEL_LS_KEY = 'cf.library.channelId';

// ── Media platform icons ──────────────────────────────────────────────────────

const TikTokIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
  </svg>
);

const LinkedInSvg = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.35-1.85 3.58 0 4.24 2.36 4.24 5.43v6.31zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/>
  </svg>
);

const XSvg = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// ── Media platform config ─────────────────────────────────────────────────────

type MediaPlatformId = 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'LINKEDIN' | 'X';

interface MediaPlatform {
  id: MediaPlatformId;
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  mediaTypes: string[];
  hasSync: boolean;
}

const MEDIA_PLATFORMS: MediaPlatform[] = [
  { id: 'YOUTUBE',   label: 'YouTube',   color: '#FF0000', bg: '#fff5f5', border: '#fecaca', Icon: Youtube,      mediaTypes: ['videos', 'playlists', 'assets'], hasSync: true  },
  { id: 'INSTAGRAM', label: 'Instagram', color: '#E1306C', bg: '#fff0f6', border: '#fbcfe8', Icon: Instagram,    mediaTypes: ['reels', 'posts'],                hasSync: false },
  { id: 'FACEBOOK',  label: 'Facebook',  color: '#1877F2', bg: '#eff6ff', border: '#bfdbfe', Icon: Facebook,     mediaTypes: ['videos', 'posts'],               hasSync: false },
  { id: 'TIKTOK',    label: 'TikTok',    color: '#010101', bg: '#f8f8f8', border: '#d1d5db', Icon: TikTokIcon,   mediaTypes: ['videos'],                        hasSync: false },
  { id: 'LINKEDIN',  label: 'LinkedIn',  color: '#0A66C2', bg: '#eff6ff', border: '#bfdbfe', Icon: LinkedInSvg,  mediaTypes: ['posts', 'articles'],             hasSync: false },
  { id: 'X',         label: 'X',         color: '#000000', bg: '#f9fafb', border: '#e5e7eb', Icon: XSvg,         mediaTypes: ['posts', 'videos'],               hasSync: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Channel { id: string; title: string; platform?: string; thumbnailUrl?: string; }

const API_BASE_LIB = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api';

async function fetchLibApi<T>(path: string): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cf_token') : null;
  const res = await fetch(`${API_BASE_LIB}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

type VideoType = 'all' | 'video' | 'short';
type VideoSort = 'recent' | 'title';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(value); }, delay);
    return () => { clearTimeout(t); };
  }, [value, delay]);
  return debounced;
}

// ── Media Library tab ─────────────────────────────────────────────────────────

function MediaLibraryTab() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Accordion open state — YouTube open by default
  const [openPlatforms, setOpenPlatforms] = useState<Set<MediaPlatformId>>(
    () => new Set<MediaPlatformId>(['YOUTUBE'])
  );
  function togglePlatform(id: MediaPlatformId) {
    setOpenPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Per-platform channel selection
  const [platformChannelIds, setPlatformChannelIds] = useState<Partial<Record<MediaPlatformId, string>>>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(CHANNEL_LS_KEY) : null;
    return stored ? { YOUTUBE: stored } : {};
  });
  function getChannelForPlatform(platId: MediaPlatformId): string {
    return platformChannelIds[platId] ?? '';
  }
  function setChannelForPlatform(platId: MediaPlatformId, id: string) {
    setPlatformChannelIds(prev => ({ ...prev, [platId]: id }));
    if (platId === 'YOUTUBE') localStorage.setItem(CHANNEL_LS_KEY, id);
  }

  // YouTube media sub-tab
  const ytMediaTab = (searchParams.get('media') ?? 'videos') as LibTabId;
  function setYtMediaTab(t: LibTabId) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('media', t);
    router.replace(`/settings/channels?${p.toString()}`, { scroll: false });
  }

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => r.data as Channel[]),
  });

  // Social platform connection status (Facebook, Instagram, etc.)
  const { data: platformStatuses = {} } = useQuery<Record<string, { connected: boolean; accountName?: string }>>({
    queryKey: ['platform-connection-status'],
    queryFn: () => apiClient.get<Record<string, { connected: boolean; accountName?: string }>>('/platforms/connection-status').then((r) => r.data),
    retry: false,
  });

  // Auto-select first channel per platform once channels load
  useEffect(() => {
    if (!channels.length) return;
    setPlatformChannelIds(prev => {
      const next = { ...prev };
      for (const plat of MEDIA_PLATFORMS) {
        if (!next[plat.id]) {
          const first = channels.find(c => (c.platform ?? 'YOUTUBE').toUpperCase() === plat.id);
          if (first) next[plat.id] = first.id;
        }
      }
      return next;
    });
  }, [channels]);

  const ytChannelId = getChannelForPlatform('YOUTUBE');

  // Assets
  const [assetProjects, setAssetProjects] = useState<AssetProject[]>([]);
  const [selectedAssetProject, setSelectedAssetProject] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState('');

  useEffect(() => {
    fetchLibApi<{ data: AssetProject[] }>('/projects')
      .then((p) => setAssetProjects(p.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAssetProject) return;
    setAssetsLoading(true);
    setAssetsError('');
    fetchLibApi<{ data: Asset[] }>(`/assets/project/${selectedAssetProject}`)
      .then((p) => setAssets(p.data))
      .catch((e: unknown) => setAssetsError(e instanceof Error ? e.message : 'Failed to load assets'))
      .finally(() => setAssetsLoading(false));
  }, [selectedAssetProject]);

  const groupedAssets = assets.reduce<Record<string, Asset[]>>((acc, a) => {
    acc[a.kind] = [...(acc[a.kind] ?? []), a];
    return acc;
  }, {});

  // Videos
  const [searchInput, setSearchInput] = useState('');
  const [videoType, setVideoType] = useState<VideoType>('all');
  const [videoSort, setVideoSort] = useState<VideoSort>('recent');
  const q = useDebounced(searchInput, 300);

  const {
    data: videosData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: videosLoading,
  } = useInfiniteQuery({
    queryKey: ['library-videos', ytChannelId, q, videoType, videoSort],
    queryFn: ({ pageParam }) =>
      api.library.listVideos(ytChannelId, {
        cursor: pageParam as string | undefined,
        q: q || undefined,
        type: videoType === 'all' ? undefined : videoType,
        sort: videoSort,
      }).then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!ytChannelId && ytMediaTab === 'videos',
  });

  const allVideos = videosData?.pages.flatMap((p) => p.data) ?? [];

  const handleFetchNextPage = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="space-y-3">
      {MEDIA_PLATFORMS.map((plat) => {
        const isOpen = openPlatforms.has(plat.id);
        const platChannels = channels.filter(c => (c.platform ?? 'YOUTUBE').toUpperCase() === plat.id);
        // For social platforms (non-YouTube), connected state comes from platformStatuses
        const socialConnected = plat.id !== 'YOUTUBE' && (platformStatuses[plat.id.toLowerCase()]?.connected === true);
        const connected = platChannels.length > 0 || socialConnected;
        const activeChId = getChannelForPlatform(plat.id);

        return (
          <div
            key={plat.id}
            className="rounded-2xl overflow-hidden transition-all"
            style={{ border: `1.5px solid ${isOpen ? plat.border : '#e3ddf8'}` }}
          >
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => togglePlatform(plat.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
              style={{ background: isOpen ? plat.bg : '#fff' }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: plat.color + '18' }}>
                <plat.Icon className="w-4 h-4" style={{ color: plat.color }} />
              </div>
              <span className="font-bold text-sm text-gray-900 flex-1">{plat.label}</span>

              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
                style={connected
                  ? { background: '#ecfdf5', color: '#15803d' }
                  : { background: '#f3f4f6', color: '#374151' }}
              >
                {connected
                  ? (plat.id === 'YOUTUBE'
                      ? `${platChannels.length} channel${platChannels.length > 1 ? 's' : ''}`
                      : (platformStatuses[plat.id.toLowerCase()]?.accountName ?? 'Connected'))
                  : 'Not connected'}
              </span>

              {plat.id === 'YOUTUBE' && connected && isOpen && activeChId && (
                <span onClick={e => e.stopPropagation()}>
                  <SyncBadge channelId={activeChId} />
                </span>
              )}

              <ChevronDown
                className="w-4 h-4 shrink-0 transition-transform duration-200"
                style={{ color: '#374151', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
            </button>

            {/* Accordion body */}
            {isOpen && (
              <div style={{ borderTop: `1.5px solid ${plat.border}` }}>

                {/* Not connected */}
                {!connected && (
                  <div className="p-10 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                         style={{ background: plat.color + '12' }}>
                      <plat.Icon className="w-7 h-7" style={{ color: plat.color }} />
                    </div>
                    <p className="text-sm font-extrabold text-gray-900 mb-1">{plat.label} not connected</p>
                    <p className="text-xs text-gray-600 mb-4">Connect your {plat.label} account to browse your media here.</p>
                    <Link
                      href="/settings/channels"
                      className="px-5 py-2.5 rounded-2xl text-sm font-bold text-white hover:opacity-90 transition-all"
                      style={{ background: plat.color }}
                    >
                      Connect {plat.label} →
                    </Link>
                  </div>
                )}

                {/* Facebook / Instagram — live media feed via Graph API */}
                {connected && (plat.id === 'FACEBOOK' || plat.id === 'INSTAGRAM') && (
                  <div className="p-5">
                    <SocialMediaFeed platformId={plat.id.toLowerCase()} />
                  </div>
                )}

                {/* Connected — no sync yet (TikTok, LinkedIn, X) */}
                {connected && !plat.hasSync && plat.id !== 'FACEBOOK' && plat.id !== 'INSTAGRAM' && (
                  <div className="p-10 flex flex-col items-center text-center">
                    <div className="px-3 py-1 rounded-full text-xs font-bold mb-3 inline-flex"
                         style={{ background: '#f3f4f6', color: '#374151' }}>
                      Coming Soon
                    </div>
                    <p className="text-sm font-extrabold text-gray-900 mb-1">{plat.label} Media Library</p>
                    <p className="text-xs text-gray-600">
                      Your channel is connected. Media sync for {plat.label} is coming soon —<br />
                      you&apos;ll be able to browse all your {plat.label} content here.
                    </p>
                  </div>
                )}

                {/* YouTube — full browser */}
                {connected && plat.hasSync && plat.id === 'YOUTUBE' && (
                  <div>
                    {/* Channel selector row */}
                    <div className="flex items-center gap-4 px-5 py-3 flex-wrap"
                         style={{ borderBottom: `1px solid ${plat.border}`, background: plat.bg }}>
                      {platChannels.length > 1 ? (
                        <select
                          value={activeChId}
                          onChange={e => setChannelForPlatform('YOUTUBE', e.target.value)}
                          className="bg-white rounded-xl px-3 py-2 text-xs font-medium outline-none"
                          style={{ border: `1.5px solid ${plat.border}` }}
                          aria-label="Select channel"
                        >
                          {platChannels.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-gray-700">{platChannels[0]?.title}</span>
                      )}
                    </div>

                    {/* Media type sub-tabs */}
                    <div className="flex border-b overflow-x-auto no-scrollbar" style={{ borderColor: plat.border }}>
                      {LIB_TABS.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setYtMediaTab(t.id)}
                          className="px-5 py-3.5 text-sm shrink-0 border-b-2 transition-all whitespace-nowrap"
                          style={ytMediaTab === t.id
                            ? { borderColor: plat.color, color: plat.color, fontWeight: 700 }
                            : { borderColor: 'transparent', color: '#4b5563', fontWeight: 500 }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Assets */}
                      {ytMediaTab === 'assets' && (
                        <div className="space-y-5">
                          <div>
                            <label htmlFor="assets-project" className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-2">Select Project</label>
                            <div className="relative">
                              <select
                                id="assets-project"
                                value={selectedAssetProject}
                                onChange={e => setSelectedAssetProject(e.target.value)}
                                className="w-full bg-white rounded-2xl px-4 py-3 pr-10 text-sm text-gray-700 outline-none appearance-none"
                                style={{ border: '1.5px solid #e3e0f0' }}
                              >
                                <option value="">Choose a project…</option>
                                {assetProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            </div>
                          </div>
                          {assetsLoading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#374151' }} /></div>}
                          {assetsError && <p className="text-sm text-red-500">{assetsError}</p>}
                          {selectedAssetProject && !assetsLoading && assets.length === 0 && !assetsError && (
                            <div className="rounded-3xl p-12 flex flex-col items-center text-center" style={{ border: '1.5px solid #e3ddf8' }}>
                              <Layers className="w-10 h-10 mb-3" style={{ color: '#374151' }} />
                              <p className="text-sm font-semibold text-gray-700">No assets yet for this project</p>
                              <p className="text-xs text-gray-600 mt-1">Run Voice Spec, Image Brief, or Music Brief from the project pipeline.</p>
                            </div>
                          )}
                          {Object.entries(groupedAssets).map(([kind, kindAssets]) => {
                            const KindIcon = KIND_ICONS[kind] ?? Layers;
                            return (
                              <div key={kind}>
                                <h3 className="flex items-center gap-2 mb-3">
                                  <KindIcon className="w-4 h-4 text-[#374151]" />
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600">{kind.replace('_', ' ')}</span>
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: '#f3f4f6', color: '#374151' }}>{kindAssets.length}</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {kindAssets.map(asset => {
                                    const status = STATUS_BADGE[asset.status] ?? STATUS_BADGE['BRIEFED']!;
                                    const StatusIcon = status.icon;
                                    const latest = asset.versions[0];
                                    return (
                                      <div key={asset.id} className="bg-white rounded-2xl p-4" style={{ border: '1.5px solid #e3ddf8' }}>
                                        <div className="flex items-start justify-between mb-2">
                                          <p className="text-sm font-medium text-gray-900 truncate flex-1">{asset.label ?? `${kind} — ${asset.id.slice(0, 8)}`}</p>
                                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ml-2" style={status.style}>
                                            <StatusIcon className={`w-3 h-3 ${asset.status === 'GENERATING' ? 'animate-spin' : ''}`} />
                                            {status.label}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-600">
                                          {asset.versions.length} version{asset.versions.length !== 1 ? 's' : ''}
                                          {latest?.provider ? ` · ${latest.provider}` : ''}
                                          {latest?.durationMs ? ` · ${Math.round(latest.durationMs / 1000)}s` : ''}
                                        </p>
                                        <p className="text-xs text-gray-300 mt-1">Created {new Date(asset.createdAt).toLocaleDateString()}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Videos */}
                      {ytMediaTab === 'videos' && (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                              </svg>
                              <input type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                                placeholder="Search videos…" aria-label="Search videos"
                                className="w-full pl-10 pr-4 bg-white rounded-2xl py-3 text-sm outline-none"
                                style={{ border: '1.5px solid #e3e0f0' }} />
                            </div>
                            <div className="flex gap-1.5">
                              {(['all', 'video', 'short'] as VideoType[]).map(t => (
                                <button key={t} type="button" onClick={() => setVideoType(t)}
                                  className="px-3 py-2 text-sm font-semibold rounded-2xl transition-all"
                                  style={videoType === t
                                    ? { background: plat.color, color: '#fff', border: `1.5px solid ${plat.color}` }
                                    : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }}>
                                  {t === 'all' ? 'All' : t === 'video' ? 'Videos' : 'Shorts'}
                                </button>
                              ))}
                            </div>
                            <select value={videoSort} onChange={e => setVideoSort(e.target.value as VideoSort)}
                              aria-label="Sort videos"
                              className="bg-white rounded-2xl px-4 py-3 text-sm outline-none"
                              style={{ border: '1.5px solid #e3e0f0' }}>
                              <option value="recent">Recent</option>
                              <option value="title">Title</option>
                            </select>
                          </div>
                          {videosLoading && (
                            <div className="flex items-center gap-2 py-16 justify-center text-gray-700">
                              <Loader2 className="w-5 h-5 animate-spin" style={{ color: plat.color }} /> Loading library…
                            </div>
                          )}
                          {!videosLoading && allVideos.length === 0 && (
                            <div className="rounded-3xl p-14 flex flex-col items-center justify-center text-center" style={{ border: '1.5px solid #e3ddf8' }}>
                              <ListVideo className="w-10 h-10 mb-3" style={{ color: '#374151' }} />
                              <p className="text-base font-extrabold text-gray-900 mb-1">No videos synced yet</p>
                              <p className="text-sm text-gray-600 mb-4">Sync your channel to see videos here.</p>
                              <SyncBadge channelId={ytChannelId} />
                            </div>
                          )}
                          {!videosLoading && allVideos.length > 0 && (
                            <VirtualVideoGrid videos={allVideos} hasNextPage={!!hasNextPage} isFetchingNextPage={isFetchingNextPage} fetchNextPage={handleFetchNextPage} />
                          )}
                        </div>
                      )}

                      {/* Playlists */}
                      {ytMediaTab === 'playlists' && (
                        <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
                          <PlaylistsTab channelId={ytChannelId} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  return (
    <Suspense fallback={null}>
      <ChannelsPageInner />
    </Suspense>
  );
}

function ChannelsPageInner() {
  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="max-w-5xl mx-auto px-5 lg:px-7 py-7 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-5 h-5" style={{ color: '#374151' }} />
            <h1 className="text-2xl font-extrabold text-gray-900">Channel Access</h1>
          </div>
          <p className="text-sm text-gray-500">Connect and manage your social channels. Browse your synced media library.</p>
        </div>

        {/* Channel connections */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <ChannelAccessPanel />
        </div>

        {/* Media library */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1" style={{ background: '#e3ddf8' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a78bdb' }}>Channel Media</span>
            <div className="h-px flex-1" style={{ background: '#e3ddf8' }} />
          </div>
          <MediaLibraryTab />
        </div>
      </div>
    </div>
  );
}
