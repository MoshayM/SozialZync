'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  RefreshCw, Search, Play, Eye, ThumbsUp,
  MessageCircle, Users, PlusCircle, Layers,
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

function VideoCard({ video }: {
  video: LibraryVideo;
}) {
  const ytUrl = `https://youtube.com/watch?v=${video.youtubeVideoId}`;
  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all">
      {/* Thumbnail — links to YouTube */}
      <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="block aspect-video relative overflow-hidden bg-gray-900">
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
      </a>

      {/* Body */}
      <div className="p-4">
        <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="block font-semibold text-sm text-gray-900 line-clamp-2 leading-snug mb-2 hover:text-gray-700 transition-colors">
          {video.title}
        </a>

        <div className="flex items-center gap-3 text-xs text-gray-400 mb-1">
          <span className="flex items-center gap-1 shrink-0"><Eye className="w-3.5 h-3.5" />{fmtCount(video.viewCount)}</span>
          <span className="flex items-center gap-1 shrink-0"><ThumbsUp className="w-3.5 h-3.5" />{fmtCount(video.likeCount)}</span>
          <span className="flex items-center gap-1 shrink-0"><MessageCircle className="w-3.5 h-3.5" />{fmtCount(video.commentCount)}</span>
        </div>

        <span className="block text-[11px] text-gray-400 mb-3">{fmtDate(video.publishedAt)}</span>

        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <a
            href={ytUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            View
          </a>
          <Link
            href="/repurpose"
            className="text-xs font-semibold px-3 py-1.5 border border-gray-200 text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
          >
            Repurpose
          </Link>
        </div>
      </div>
    </div>
  );
}

function PlaylistCard({ playlist }: { playlist: LibraryPlaylist }) {
  const ytUrl = `https://youtube.com/playlist?list=${playlist.youtubePlaylistId}`;
  return (
    <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="group block bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
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
        <p className="font-semibold text-sm text-gray-900 truncate group-hover:text-gray-700 transition-colors">{playlist.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{playlist.itemCount} videos</p>
        <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-gray-500 group-hover:text-gray-700 transition-colors">
          <Layers className="w-3.5 h-3.5" /> View on YouTube
        </div>
      </div>
    </a>
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">My Library</h1>
            <p className="text-sm text-gray-500 mt-1">Your channel videos and playlists.</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 h-9 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400 w-40 sm:w-48 transition"
              />
            </div>
            <button
              onClick={() => { if (!syncMutation.isPending) syncMutation.mutate(); }}
              disabled={syncMutation.isPending || !channelId}
              className="flex items-center gap-1.5 h-9 px-4 text-sm font-semibold text-white bg-gray-700 rounded-xl hover:bg-gray-800 transition shadow-sm disabled:opacity-50 whitespace-nowrap"
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
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 shadow-sm animate-pulse h-16" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannelId(ch.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition ${
                      ch.id === channelId
                        ? 'bg-gray-700 text-white border-gray-700 shadow-sm'
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
                <div className="flex items-center gap-4 text-xs text-gray-500 sm:shrink-0">
                  {channel.subscriberCount != null && (
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-medium">{fmtCount(channel.subscriberCount)}</span> subscribers
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${channel.lastSyncedAt ? 'bg-emerald-500 shadow shadow-emerald-300' : 'bg-gray-300'}`} />
                    {fmtSynced(channel.lastSyncedAt ?? null)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Stats + Sort ── */}
        {!channelsLoading && channelId && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            {/* Quick stats */}
            <div className="flex flex-wrap items-center gap-2">
              {videos.length > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-700">
                  <Play className="w-3.5 h-3.5 text-gray-400" /> {videos.length} videos
                </span>
              )}
              {playlists.length > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-700">
                  <ListVideo className="w-3.5 h-3.5 text-gray-400" /> {playlists.length} playlists
                </span>
              )}
              {videos.some(v => v.kind === 'short') && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-full text-xs font-semibold text-red-600">
                  {videos.filter(v => v.kind === 'short').length} Shorts
                </span>
              )}
            </div>
            {/* Sort pills — visible, no dropdown */}
            {activeTab === 'videos' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mr-1">Sort</span>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSort(opt)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      sort === opt
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="border-b border-gray-200 mb-6 flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 px-1 mr-6 text-sm font-semibold transition ${
                activeTab === tab.id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count != null && (
                <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-t-sm" />
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
                    <VideoCard key={video.id} video={video} />
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

    </div>
  );
}
