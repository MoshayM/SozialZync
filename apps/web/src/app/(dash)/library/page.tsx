'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  RefreshCw, Search, ChevronDown, Play, Eye, ThumbsUp,
  MessageCircle, MoreVertical, Users, PlusCircle, Layers,
  ListVideo, Youtube, Loader2, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { LibraryVideo, LibraryPlaylist } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  subscriberCount?: number | null;
  lastSyncedAt?: string | null;
  active?: boolean | null;
  tokenExpired?: boolean | null;
}

type TabId = 'videos' | 'playlists';

const SORT_OPTIONS = ['Newest', 'Oldest', 'Most Viewed', 'A–Z'];
const SORT_MAP: Record<string, string> = {
  Newest: 'recent', Oldest: 'oldest', 'Most Viewed': 'views', 'A–Z': 'az',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(ms: number | null): string {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtCount(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(s: string | null): string {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

function fmtSynced(s: string | null): string {
  if (!s) return 'Never synced';
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Synced just now';
  if (m < 60) return `Synced ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Synced ${h}h ago`;
  return `Synced ${Math.floor(h / 24)}d ago`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VideoCard({ video, onMenuClick, menuOpen }: {
  video: LibraryVideo;
  onMenuClick: (id: string) => void;
  menuOpen: boolean;
}) {
  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer">
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden bg-gray-900">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <Youtube className="w-10 h-10 text-white/20" />
          </div>
        )}
        {video.durationMs > 0 && (
          <span className="absolute bottom-2 right-2 z-10 bg-black/70 text-white text-[11px] font-medium px-2 py-0.5 rounded">
            {fmtDuration(video.durationMs)}
          </span>
        )}
        {video.kind === 'short' && (
          <span className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            SHORT
          </span>
        )}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 text-gray-900 ml-0.5" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <p className="font-semibold text-sm text-gray-900 line-clamp-2 leading-snug mb-1.5">{video.title}</p>

        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmtCount(video.viewCount)}</span>
          <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{fmtCount(video.likeCount)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{fmtCount(video.commentCount)}</span>
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-gray-400">{fmtDate(video.publishedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-50">
          <a
            href={`https://youtube.com/watch?v=${video.youtubeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold px-2.5 py-1 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </a>
          <button className="text-[11px] font-semibold px-2.5 py-1 border border-gray-200 text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
            Repurpose
          </button>
          <div className="relative ml-auto">
            <button
              onClick={(e) => { e.stopPropagation(); onMenuClick(video.id); }}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-8 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[140px]">
                {['View on YouTube', 'Repurpose with AI', 'Copy link'].map((action) => (
                  <button
                    key={action}
                    onClick={() => onMenuClick('')}
                    className="w-full text-left px-4 py-2 text-xs text-gray-700 transition hover:bg-gray-50"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaylistCard({ playlist }: { playlist: LibraryPlaylist }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer group">
      <div className="relative w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {playlist.thumbnailUrl ? (
          <img src={playlist.thumbnailUrl} alt={playlist.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
            <ListVideo className="w-6 h-6 text-white/40" />
          </div>
        )}
        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {playlist.itemCount}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 truncate">{playlist.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{playlist.itemCount} videos</p>
        <div className="flex items-center gap-2 mt-2.5">
          <button className="text-[11px] font-semibold px-2.5 py-1 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-1">
            <Layers className="w-3 h-3" /> View
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc, action }: {
  icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl flex flex-col items-center justify-center py-20 px-6 text-center bg-white border border-gray-100">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gray-50 mb-5 text-gray-400">
        {icon}
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">{desc}</p>
      {action}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('videos');
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // ── Channels ────────────────────────────────────────────────────────────────
  const { data: channelsRaw, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data } = await api.channels.list() as { data: Channel[] };
      return data;
    },
  });
  const channels = (channelsRaw ?? []).filter((c) => c.active !== false);
  const channelId = activeChannelId ?? channels[0]?.id ?? null;
  const channel = channels.find((c) => c.id === channelId) ?? null;

  // ── Videos ──────────────────────────────────────────────────────────────────
  const { data: videosPage, isLoading: videosLoading, isError: videosError } = useQuery({
    queryKey: ['library-videos', channelId, search, sort],
    queryFn: async () => {
      if (!channelId) return null;
      const { data } = await api.library.listVideos(channelId, { q: search || undefined, sort: SORT_MAP[sort] });
      return data;
    },
    enabled: !!channelId && activeTab === 'videos',
  });

  // ── Playlists ────────────────────────────────────────────────────────────────
  const { data: playlistsPage, isLoading: playlistsLoading } = useQuery({
    queryKey: ['library-playlists', channelId],
    queryFn: async () => {
      if (!channelId) return null;
      const { data } = await api.library.listPlaylists(channelId);
      return data;
    },
    enabled: !!channelId && activeTab === 'playlists',
  });

  // ── Sync ────────────────────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!channelId) return;
      await api.library.syncStart(channelId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['library-videos'] });
      void qc.invalidateQueries({ queryKey: ['library-playlists'] });
    },
  });

  const handleMenuClick = useCallback((id: string) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  }, []);

  const videos = videosPage?.data ?? [];
  const playlists = playlistsPage?.data ?? [];

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'videos', label: 'Videos', count: videos.length > 0 ? videos.length : undefined },
    { id: 'playlists', label: 'Playlists', count: playlists.length > 0 ? playlists.length : undefined },
  ];

  // ── No channels ─────────────────────────────────────────────────────────────
  if (!channelsLoading && channels.length === 0) {
    return (
      <div className="min-h-screen bg-[#F4F3FB] flex items-center justify-center p-6">
        <EmptyState
          icon={<Youtube className="w-8 h-8" />}
          title="No channels connected"
          desc="Connect your YouTube channel to view and manage your video library, playlists, and content."
          action={
            <Link
              href="/settings/channels"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}
            >
              <PlusCircle className="w-4 h-4" /> Connect a channel
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F3FB]">
      <div className="p-4 sm:p-6 pb-24 lg:pb-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">My Library</h1>
            <p className="text-sm text-gray-500 mt-0.5">Your channel videos and playlists.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 h-9 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400 w-full sm:w-40 transition"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setSortOpen((o) => !o)}
                className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                {sort}
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-10 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[130px]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setSort(opt); setSortOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition hover:bg-gray-50 ${sort === opt ? 'font-semibold text-gray-700' : 'text-gray-700'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { if (!syncMutation.isPending) syncMutation.mutate(); }}
              disabled={syncMutation.isPending || !channelId}
              className="flex items-center gap-1.5 h-9 px-4 text-sm font-semibold text-white bg-gray-600 rounded-xl hover:bg-gray-700 transition shadow-sm disabled:opacity-50"
            >
              {syncMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              {syncMutation.isPending ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>

        {/* ── Channel selector ── */}
        {channelsLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm animate-pulse h-16" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannelId(ch.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition ${
                      ch.id === channelId
                        ? 'bg-gray-600 text-white border-gray-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {ch.thumbnailUrl ? (
                      <img src={ch.thumbnailUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                    ) : (
                      <Youtube className="w-4 h-4 shrink-0" />
                    )}
                    {ch.title ?? 'Channel'}
                  </button>
                ))}
              </div>
              {channel && (
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                  {channel.subscriberCount != null && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {fmtCount(channel.subscriberCount)} subscribers
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full inline-block ${channel.lastSyncedAt ? 'bg-emerald-500 shadow shadow-emerald-300' : 'bg-gray-300'}`} />
                    {fmtSynced(channel.lastSyncedAt ?? null)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="border-b border-gray-200 mb-5 flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 px-1 mr-5 text-sm font-medium transition ${
                activeTab === tab.id ? 'text-gray-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count != null && (
                <span className={`ml-1.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-600 rounded-t-sm" />
              )}
            </button>
          ))}
        </div>

        {/* ════════ VIDEOS TAB ════════ */}
        {activeTab === 'videos' && (
          <>
            {videosLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                    <div className="aspect-video bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : videosError ? (
              <EmptyState
                icon={<AlertCircle className="w-8 h-8 text-red-400" />}
                title="Could not load videos"
                desc="There was a problem fetching your video library. Try syncing again."
                action={
                  <button
                    onClick={() => syncMutation.mutate()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 transition"
                  >
                    <RefreshCw className="w-4 h-4" /> Sync now
                  </button>
                }
              />
            ) : videos.length === 0 ? (
              <EmptyState
                icon={<Youtube className="w-8 h-8" />}
                title="No videos yet"
                desc="Sync your channel to import your YouTube videos, or start creating a new project."
                action={
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                    <button
                      onClick={() => syncMutation.mutate()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 transition"
                    >
                      <RefreshCw className="w-4 h-4" /> Sync channel
                    </button>
                    <Link
                      href="/projects"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}
                    >
                      <PlusCircle className="w-4 h-4" /> New project
                    </Link>
                  </div>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {videos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onMenuClick={handleMenuClick}
                      menuOpen={openMenu === video.id}
                    />
                  ))}
                </div>
                {videosPage?.nextCursor && (
                  <div className="flex justify-center mt-6">
                    <button className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-gray-600 border-2 border-gray-200 rounded-xl hover:border-gray-400 hover:text-gray-700 bg-white transition">
                      <RefreshCw className="w-4 h-4" /> Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════════ PLAYLISTS TAB ════════ */}
        {activeTab === 'playlists' && (
          <>
            {playlistsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 animate-pulse h-24">
                    <div className="w-20 h-14 bg-gray-100 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : playlists.length === 0 ? (
              <EmptyState
                icon={<ListVideo className="w-8 h-8" />}
                title="No playlists found"
                desc="Sync your channel to import your YouTube playlists."
                action={
                  <button
                    onClick={() => syncMutation.mutate()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 transition"
                  >
                    <RefreshCw className="w-4 h-4" /> Sync channel
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {playlists.map((pl) => (
                  <PlaylistCard key={pl.id} playlist={pl} />
                ))}
              </div>
            )}
          </>
        )}

      </div>

      {/* Click-away for dropdowns */}
      {(sortOpen || openMenu !== null) && (
        <div className="fixed inset-0 z-10" onClick={() => { setSortOpen(false); setOpenMenu(null); }} />
      )}
    </div>
  );
}
