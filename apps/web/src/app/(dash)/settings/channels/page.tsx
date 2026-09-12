'use client';
import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Youtube, Loader2, CheckCircle, AlertCircle, LogOut, RefreshCw,
  PlusCircle, Link2, Trash2, Clock, Share2, ListVideo, Video,
  Instagram, Facebook,
} from 'lucide-react';
import { api, apiClient } from '@/lib/api';
import { SyncBadge } from '@/components/library/SyncBadge';
import { VirtualVideoGrid } from '@/components/library/VirtualVideoGrid';
import { PlaylistsTab } from '@/components/library/PlaylistsTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  customUrl?: string | null;
  subscriberCount?: number | null;
  videoCount?: number | null;
  active?: boolean | null;
  readOnly?: boolean | null;
  tokenExpired?: boolean | null;
  lastSyncedAt?: string | null;
  scopes?: string[] | null;
  accessLevel?: string | null;
}

interface ConnectionStatus { connected: boolean; accountName?: string | null; }

type AccessLevel = 'READ_ONLY' | 'PUBLISH' | 'FULL';
type PageTab    = 'connections' | 'library';
type LibTab     = 'videos' | 'playlists';
type VideoType  = 'all' | 'video' | 'short';
type VideoSort  = 'recent' | 'title';

// ─── Constants ─────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const ACCESS_BADGE: Record<AccessLevel, string> = {
  READ_ONLY: 'bg-blue-50 text-blue-700 border-blue-200',
  PUBLISH:   'bg-green-50 text-green-700 border-green-200',
  FULL:      'bg-purple-50 text-purple-700 border-purple-200',
};
const ACCESS_LABEL: Record<AccessLevel, string> = {
  READ_ONLY: 'Read-only',
  PUBLISH:   'Publish',
  FULL:      'Full Access',
};

const OAUTH_ERRORS: Record<string, string> = {
  access_denied:                   'Connection cancelled.',
  no_channel:                      'No YouTube channel found on that Google account.',
  invalid_grant:                   'Auth code expired — please try connecting again.',
  redirect_mismatch:               'Redirect URI mismatch. Check OAuth app settings.',
  invalid_client:                  'Invalid OAuth credentials.',
  missing_params:                  'OAuth callback missing required parameters.',
  oauth_failed:                    'Authentication failed. Please try again.',
  invalid_state:                   'OAuth session expired — please try again.',
  instagram_auth_failed:           'Instagram connection failed. Please try again.',
  facebook_auth_failed:            'Facebook connection failed. Please try again.',
  tiktok_auth_failed:              'TikTok connection failed. Please try again.',
  linkedin_auth_failed:            'LinkedIn connection failed. Please try again.',
  pages_permission_denied:         'Instagram requires access to your Facebook Pages. Please re-authorise and allow Pages access.',
  no_instagram_business_account:   'No Instagram Business account linked to your Facebook Page. Switch your Instagram to a Professional account first.',
  wrong_facebook_account:          'No Facebook Pages found. Make sure you logged in with the Facebook account that manages your Page.',
  no_facebook_pages:               'No Facebook Pages found on this account.',
};

// ─── Inline SVG icons (TikTok / X / LinkedIn not in lucide) ──────────────────

const TikTokSvg = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
  </svg>
);
const XSvg = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const LinkedInSvg = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.35-1.85 3.58 0 4.24 2.36 4.24 5.43v6.31zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
  </svg>
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n?: number | null): string {
  return (n ?? 0).toLocaleString();
}
function fmtDate(s?: string | null): string {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString(); } catch { return ''; }
}
function toAccessLevel(s?: string | null): AccessLevel {
  if (s === 'READ_ONLY' || s === 'PUBLISH' || s === 'FULL') return s;
  return 'PUBLISH';
}
function useDebounced<T>(val: T, delay: number): T {
  const [d, setD] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setD(val), delay);
    return () => clearTimeout(t);
  }, [val, delay]);
  return d;
}

// ─── Channel card ──────────────────────────────────────────────────────────────

interface CardProps {
  ch: Channel;
  onDisconnect(id: string): void;
  onRemove(id: string): void;
  onRefresh(id: string): void;
  onReconnect(access: AccessLevel): void;
  busy: boolean;
}

function ChannelCard({ ch, onDisconnect, onRemove, onRefresh, onReconnect, busy }: CardProps) {
  const [confirm, setConfirm] = useState<'disconnect' | 'remove' | null>(null);
  const isActive = ch.active === true;
  const access = toAccessLevel(ch.accessLevel);

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${
      isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-dashed border-gray-300'
    }`}>
      {/* Info row */}
      <div className="flex items-start gap-4">
        {ch.thumbnailUrl ? (
          <img
            src={ch.thumbnailUrl}
            alt={ch.title ?? ''}
            className={`w-12 h-12 rounded-full object-cover shrink-0 ${!isActive ? 'grayscale opacity-50' : ''}`}
          />
        ) : (
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-red-100' : 'bg-gray-200'}`}>
            <Youtube className={`w-6 h-6 ${isActive ? 'text-red-600' : 'text-gray-400'}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{ch.title ?? 'Unknown Channel'}</p>
            {ch.readOnly ? (
              <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">Read-only</span>
            ) : isActive ? (
              <span className={`text-xs border rounded-full px-2 py-0.5 ${ACCESS_BADGE[access]}`}>{ACCESS_LABEL[access]}</span>
            ) : (
              <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">Signed out</span>
            )}
          </div>

          {ch.customUrl && (
            <p className="text-sm text-gray-500 mt-0.5">
              {ch.customUrl.startsWith('@') ? ch.customUrl : `@${ch.customUrl}`}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-gray-400">{fmtNum(ch.subscriberCount)} subscribers</span>
            {(ch.videoCount ?? 0) > 0 && (
              <span className="text-xs text-gray-400">{fmtNum(ch.videoCount)} videos</span>
            )}
            {ch.lastSyncedAt && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Synced {fmtDate(ch.lastSyncedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Token-expired warning */}
      {ch.tokenExpired && !ch.readOnly && (
        <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 flex-1">Token expired — re-authorise to restore publishing.</p>
          <button
            onClick={() => onReconnect(access)}
            disabled={busy}
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 shrink-0"
          >
            Re-connect
          </button>
        </div>
      )}

      {/* Action row */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        {confirm === 'disconnect' ? (
          <>
            <span className="text-xs text-gray-500">Sign out of this channel?</span>
            <button onClick={() => { onDisconnect(ch.id); setConfirm(null); }} disabled={busy}
              className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50">
              Yes, sign out
            </button>
            <button onClick={() => setConfirm(null)}
              className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </>
        ) : confirm === 'remove' ? (
          <>
            <span className="text-xs text-gray-500">Remove permanently?</span>
            <button onClick={() => { onRemove(ch.id); setConfirm(null); }} disabled={busy}
              className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50">
              Yes, remove
            </button>
            <button onClick={() => setConfirm(null)}
              className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </>
        ) : (
          <>
            {isActive && !ch.readOnly && (
              <button onClick={() => onRefresh(ch.id)} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-40 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Token
              </button>
            )}
            {isActive ? (
              <button onClick={() => setConfirm('disconnect')} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:border-red-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            ) : (
              <>
                <button onClick={() => onReconnect(access)} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-300 text-brand-700 text-sm rounded-xl hover:bg-brand-50 disabled:opacity-40 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                </button>
                <button onClick={() => setConfirm('remove')} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:border-red-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Social platform row ───────────────────────────────────────────────────────

interface SocialRowProps {
  name: string;
  platformKey: string;
  icon: React.ReactNode;
  status?: ConnectionStatus;
  onDisconnect(): void;
}

function SocialRow({ name, platformKey, icon, status, onDisconnect }: SocialRowProps) {
  const isConnected = status?.connected === true;

  function handleConnect() {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('cf_token');
    if (!token) return;
    let userId: string | null = null;
    try { userId = (JSON.parse(atob(token.split('.')[1] ?? '')) as { sub?: string }).sub ?? null; } catch { /* ignore */ }
    if (!userId) return;
    window.location.href = `${API_URL}/platforms/${platformKey}/auth?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent('/settings/channels?tab=connections')}`;
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-600">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{name}</p>
        {isConnected ? (
          <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
            <CheckCircle className="w-3 h-3" />
            Connected{status?.accountName ? ` · ${status.accountName}` : ''}
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">Not connected</p>
        )}
      </div>
      {isConnected ? (
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" /> Disconnect
        </button>
      ) : (
        <button
          onClick={handleConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-colors shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Connect
        </button>
      )}
    </div>
  );
}

// ─── Main content (needs useSearchParams) ─────────────────────────────────────

function ChannelsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const tab       = (searchParams.get('tab') ?? 'connections') as PageTab;
  const libTab    = (searchParams.get('lib') ?? 'videos') as LibTab;
  const oauthErr  = searchParams.get('error') ?? '';
  const connected = searchParams.get('connected');

  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [connectAccess, setConnectAccess] = useState<AccessLevel>('PUBLISH');
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [libChannelId, setLibChannelId] = useState('');
  const [videoSearch, setVideoSearch] = useState('');
  const [videoType, setVideoType] = useState<VideoType>('all');
  const [videoSort, setVideoSort] = useState<VideoSort>('recent');
  const pendingVerify = useRef(false);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: rawChannels, isLoading: chLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then(r => r.data),
  });

  const channels: Channel[] = Array.isArray(rawChannels) ? (rawChannels as Channel[]) : [];
  const activeChannels   = channels.filter(c => c.active === true);
  const inactiveChannels = channels.filter(c => c.active !== true);

  const { data: platformStatuses = {} } = useQuery<Record<string, ConnectionStatus>>({
    queryKey: ['platform-connection-status'],
    queryFn: () => apiClient.get<Record<string, ConnectionStatus>>('/platforms/connection-status').then(r => r.data),
    retry: false,
  });

  // Auto-select first active channel for library
  useEffect(() => {
    if (!libChannelId && activeChannels.length > 0) {
      setLibChannelId(activeChannels[0]?.id ?? '');
    }
  }, [activeChannels.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── OAuth callback handlers ───────────────────────────────────────────────

  const SOCIAL_PLATFORM_NAMES: Record<string, string> = {
    instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X / Twitter',
  };

  useEffect(() => {
    if (connected === 'true') {
      // YouTube callback
      pendingVerify.current = true;
      window.history.replaceState({}, '', '/settings/channels?tab=connections');
      void qc.invalidateQueries({ queryKey: ['channels'] });
    } else if (connected && SOCIAL_PLATFORM_NAMES[connected]) {
      // Social platform callback (instagram / facebook / tiktok / linkedin)
      const name = SOCIAL_PLATFORM_NAMES[connected]!;
      window.history.replaceState({}, '', '/settings/channels?tab=connections');
      void qc.invalidateQueries({ queryKey: ['platform-connection-status'] });
      setBanner({ type: 'success', msg: `${name} connected successfully!` });
    }
  }, [connected, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingVerify.current || chLoading) return;
    pendingVerify.current = false;
    if (activeChannels.length > 0) {
      setBanner({ type: 'success', msg: 'YouTube channel connected successfully!' });
    } else {
      setBanner({ type: 'error', msg: 'Connection could not be verified. Please try again.' });
    }
  }, [channels, chLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (oauthErr) {
      setBanner({ type: 'error', msg: OAUTH_ERRORS[oauthErr] ?? OAUTH_ERRORS['oauth_failed']! });
      window.history.replaceState({}, '', '/settings/channels?tab=connections');
    }
  }, [oauthErr]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const connectMutation = useMutation({
    mutationFn: async (access: AccessLevel) => {
      const redirectUri = `${API_URL}/channels/oauth/callback`;
      const res = await api.channels.getAuthUrl(redirectUri, access) as { data: { url: string } };
      window.location.href = res.data.url;
    },
    onError: () => setBanner({ type: 'error', msg: 'Could not start YouTube connection. Please try again.' }),
  });

  const connectByUrlMutation = useMutation({
    mutationFn: (url: string) => api.channels.connectByUrl(url),
    onSuccess: () => {
      setUrlInput(''); setShowUrlForm(false);
      void qc.invalidateQueries({ queryKey: ['channels'] });
      setBanner({ type: 'success', msg: 'Channel added (read-only).' });
    },
    onError: (e: unknown) => setBanner({
      type: 'error',
      msg: e instanceof Error ? e.message : 'Failed to add channel by URL.',
    }),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.channels.disconnect(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['channels'] }); setBanner({ type: 'info', msg: 'Channel signed out.' }); },
    onError:   () => setBanner({ type: 'error', msg: 'Failed to sign out. Please try again.' }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.channels.remove(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['channels'] }); setBanner({ type: 'info', msg: 'Channel removed.' }); },
    onError:   () => setBanner({ type: 'error', msg: 'Failed to remove. Please try again.' }),
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) => api.channels.refresh(id),
    onSuccess: (data: unknown) => {
      void qc.invalidateQueries({ queryKey: ['channels'] });
      const exp = (data as { data?: { expiresAt?: string } } | undefined)?.data?.expiresAt;
      setBanner({ type: 'success', msg: `Token refreshed${exp ? ` — expires ${fmtDate(exp)}` : ''}.` });
    },
    onError: () => setBanner({ type: 'error', msg: 'Failed to refresh token. Please try again.' }),
  });

  const busy = connectMutation.isPending || connectByUrlMutation.isPending ||
               disconnectMutation.isPending || removeMutation.isPending || refreshMutation.isPending;

  // ── Nav helpers ───────────────────────────────────────────────────────────

  function setTab(t: PageTab) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', t); p.delete('lib');
    router.replace(`/settings/channels?${p.toString()}`, { scroll: false });
  }
  function setLibTab(t: LibTab) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('lib', t);
    router.replace(`/settings/channels?${p.toString()}`, { scroll: false });
  }

  // ── Library data ──────────────────────────────────────────────────────────

  const debouncedSearch = useDebounced(videoSearch, 300);

  const {
    data: videosData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: videosLoading,
  } = useInfiniteQuery({
    queryKey: ['lib-videos', libChannelId, debouncedSearch, videoType, videoSort],
    queryFn: ({ pageParam }) =>
      api.library.listVideos(libChannelId, {
        cursor: pageParam as string | undefined,
        q: debouncedSearch || undefined,
        type: videoType === 'all' ? undefined : videoType,
        sort: videoSort,
      }).then(r => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last as { nextCursor?: string }).nextCursor ?? undefined,
    enabled: !!libChannelId && tab === 'library' && libTab === 'videos',
  });

  const allVideos = videosData?.pages.flatMap(p => (p as { data: unknown[] }).data ?? []) ?? [];
  const handleNextPage = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Render ────────────────────────────────────────────────────────────────

  const SOCIAL_PLATFORMS = [
    { key: 'instagram', name: 'Instagram', icon: <Instagram className="w-5 h-5 text-pink-600" /> },
    { key: 'facebook',  name: 'Facebook',  icon: <Facebook  className="w-5 h-5 text-blue-600" /> },
    { key: 'tiktok',    name: 'TikTok',    icon: <TikTokSvg  className="w-5 h-5 text-gray-800" /> },
    { key: 'linkedin',  name: 'LinkedIn',  icon: <LinkedInSvg className="w-5 h-5 text-blue-700" /> },
    { key: 'x',         name: 'X / Twitter', icon: <XSvg     className="w-5 h-5 text-gray-900" /> },
  ];

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="max-w-4xl mx-auto px-5 lg:px-7 py-7">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Channels &amp; Connections</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Connect your YouTube channel and social platforms, then browse your synced media library.
          </p>
        </div>

        {/* Banner */}
        {banner && (
          <div className={`mb-5 flex items-center gap-3 px-4 py-3 rounded-xl text-sm border ${
            banner.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            banner.type === 'error'   ? 'bg-red-50 border-red-200 text-red-800' :
                                        'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {banner.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{banner.msg}</span>
            <button onClick={() => setBanner(null)} className="text-current opacity-50 hover:opacity-100 text-xl leading-none">&times;</button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mb-7 bg-white rounded-2xl p-1 border border-gray-200 w-fit">
          {([
            { id: 'connections' as PageTab, label: 'Connections',  Icon: Share2    },
            { id: 'library'     as PageTab, label: 'Media Library', Icon: ListVideo },
          ]).map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-[#374151] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <t.Icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* ──────────────────── CONNECTIONS TAB ──────────────────────────── */}
        {tab === 'connections' && (
          <div className="space-y-10">

            {/* YouTube */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                    <Youtube className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">YouTube</p>
                    <p className="text-xs text-gray-400">
                      {activeChannels.length} connected
                      {inactiveChannels.length > 0 ? ` · ${inactiveChannels.length} signed out` : ''}
                    </p>
                  </div>
                </div>
                {activeChannels.length > 0 && activeChannels[0]?.id && (
                  <SyncBadge channelId={activeChannels[0].id} />
                )}
              </div>

              {chLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                </div>
              ) : channels.length === 0 ? (
                /* ── Empty state ── */
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                    <Youtube className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="font-semibold text-gray-800 mb-1">No YouTube channel connected</p>
                  <p className="text-sm text-gray-500 mb-6 max-w-xs">
                    Connect your channel to start creating, publishing, and analysing content.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <select
                      value={connectAccess}
                      onChange={e => setConnectAccess(e.target.value as AccessLevel)}
                      className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white"
                    >
                      <option value="READ_ONLY">Read-only</option>
                      <option value="PUBLISH">Publish</option>
                      <option value="FULL">Full Access</option>
                    </select>
                    <button
                      onClick={() => connectMutation.mutate(connectAccess)}
                      disabled={busy}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {connectMutation.isPending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Youtube className="w-4 h-4" />}
                      Connect with Google
                    </button>
                  </div>
                  <button
                    onClick={() => setShowUrlForm(v => !v)}
                    className="mt-3 text-sm text-brand-600 hover:underline"
                  >
                    Or add by YouTube URL / @handle
                  </button>
                </div>
              ) : (
                /* ── Channel list ── */
                <div className="space-y-3">
                  {[...activeChannels, ...inactiveChannels].map(ch => (
                    <ChannelCard key={ch.id} ch={ch}
                      onDisconnect={id => disconnectMutation.mutate(id)}
                      onRemove={id => removeMutation.mutate(id)}
                      onRefresh={id => refreshMutation.mutate(id)}
                      onReconnect={access => connectMutation.mutate(access)}
                      busy={busy}
                    />
                  ))}

                  {/* Add another */}
                  <div className="pt-2 flex gap-2 flex-wrap">
                    <select
                      value={connectAccess}
                      onChange={e => setConnectAccess(e.target.value as AccessLevel)}
                      className="border border-dashed border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-600 bg-white"
                    >
                      <option value="READ_ONLY">Read-only</option>
                      <option value="PUBLISH">Publish</option>
                      <option value="FULL">Full Access</option>
                    </select>
                    <button
                      onClick={() => connectMutation.mutate(connectAccess)}
                      disabled={busy}
                      className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {connectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                      Add via Google
                    </button>
                    <button
                      onClick={() => setShowUrlForm(v => !v)}
                      className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      <Link2 className="w-4 h-4" /> Add by URL
                    </button>
                  </div>
                </div>
              )}

              {/* URL form */}
              {showUrlForm && (
                <div className="mt-3 bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Add channel by URL or @handle</p>
                  <p className="text-xs text-gray-500">
                    Added as read-only — you can view analytics but not publish.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) connectByUrlMutation.mutate(urlInput.trim()); }}
                      placeholder="https://youtube.com/@channelname or @handle"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-brand-300"
                    />
                    <button
                      onClick={() => { if (urlInput.trim()) connectByUrlMutation.mutate(urlInput.trim()); }}
                      disabled={!urlInput.trim() || busy}
                      className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                    >
                      {connectByUrlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Social platforms */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-purple-600" />
                </div>
                <p className="font-bold text-gray-900">Social Platforms</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                {SOCIAL_PLATFORMS.map(p => (
                  <SocialRow
                    key={p.key}
                    name={p.name}
                    platformKey={p.key}
                    icon={p.icon}
                    status={platformStatuses[p.key]}
                    onDisconnect={() => {
                      void apiClient.delete(`/platforms/${p.key}/disconnect`)
                        .then(() => qc.invalidateQueries({ queryKey: ['platform-connection-status'] }))
                        .catch(() => setBanner({ type: 'error', msg: `Failed to disconnect ${p.name}.` }));
                    }}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ──────────────────── LIBRARY TAB ──────────────────────────────── */}
        {tab === 'library' && (
          <div>
            {activeChannels.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-14 flex flex-col items-center text-center">
                <Youtube className="w-10 h-10 text-gray-300 mb-3" />
                <p className="font-semibold text-gray-700">No connected channel</p>
                <p className="text-sm text-gray-500 mt-1 max-w-xs">
                  Connect a YouTube channel in the Connections tab to browse your media library.
                </p>
                <button
                  onClick={() => setTab('connections')}
                  className="mt-5 px-5 py-2.5 bg-[#374151] text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  Go to Connections
                </button>
              </div>
            ) : (
              <div>
                {/* Channel selector */}
                <div className="flex items-center gap-4 mb-6 flex-wrap">
                  {activeChannels.length > 1 ? (
                    <select
                      value={libChannelId}
                      onChange={e => setLibChannelId(e.target.value)}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700"
                    >
                      {activeChannels.map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.title ?? ch.id}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      {activeChannels[0]?.thumbnailUrl && (
                        <img src={activeChannels[0].thumbnailUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      )}
                      <span className="font-medium text-gray-800 text-sm">
                        {activeChannels[0]?.title ?? 'Channel'}
                      </span>
                    </div>
                  )}
                  {libChannelId && <SyncBadge channelId={libChannelId} />}
                </div>

                {/* Sub-tab bar */}
                <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
                  {([
                    { id: 'videos'    as LibTab, label: 'Videos',    Icon: Video    },
                    { id: 'playlists' as LibTab, label: 'Playlists', Icon: ListVideo },
                  ]).map(t => (
                    <button key={t.id} type="button" onClick={() => setLibTab(t.id)}
                      className={`flex items-center gap-1.5 px-5 py-3 text-sm border-b-2 -mb-px transition-all whitespace-nowrap ${
                        libTab === t.id
                          ? 'border-gray-800 text-gray-800 font-semibold'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}>
                      <t.Icon className="w-4 h-4" /> {t.label}
                    </button>
                  ))}
                </div>

                {/* Videos */}
                {libTab === 'videos' && (
                  <div>
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                        </svg>
                        <input
                          type="search"
                          value={videoSearch}
                          onChange={e => setVideoSearch(e.target.value)}
                          placeholder="Search videos…"
                          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-2xl text-sm bg-white outline-none focus:ring-2 focus:ring-brand-300"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        {(['all', 'video', 'short'] as VideoType[]).map(t => (
                          <button key={t} type="button" onClick={() => setVideoType(t)}
                            className={`px-3 py-2 text-sm font-medium rounded-xl transition-all ${
                              videoType === t
                                ? 'bg-[#374151] text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}>
                            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}s
                          </button>
                        ))}
                      </div>
                      <select
                        value={videoSort}
                        onChange={e => setVideoSort(e.target.value as VideoSort)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white"
                      >
                        <option value="recent">Recent first</option>
                        <option value="title">Title A–Z</option>
                      </select>
                    </div>
                    {videosLoading ? (
                      <div className="flex justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                      </div>
                    ) : (
                      <VirtualVideoGrid
                        videos={allVideos as Parameters<typeof VirtualVideoGrid>[0]['videos']}
                        fetchNextPage={handleNextPage}
                        hasNextPage={hasNextPage ?? false}
                        isFetchingNextPage={isFetchingNextPage}
                      />
                    )}
                  </div>
                )}

                {/* Playlists */}
                {libTab === 'playlists' && libChannelId && (
                  <PlaylistsTab channelId={libChannelId} />
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Page export (Suspense wrapper for useSearchParams) ────────────────────────

export default function ChannelsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    }>
      <ChannelsInner />
    </Suspense>
  );
}
