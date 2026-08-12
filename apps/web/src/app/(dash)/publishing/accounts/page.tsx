'use client';
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, RefreshCw, Loader2, ExternalLink, AlertCircle, X } from 'lucide-react';
import { apiClient } from '@/lib/api';

const OAUTH_ERRORS: Record<string, string> = {
  no_facebook_pages: 'No Facebook Page was found. Make sure you log in with the Facebook account that manages the Page linked to your Instagram Business account.',
  pages_permission_denied: 'The "Manage your Pages" permission was not granted. Please try connecting again and approve all permissions when prompted.',
  wrong_facebook_account: 'You logged in with a Facebook account that has no Pages. Please try again using the Facebook account that manages the Page linked to your Instagram Business account.',
  no_instagram_business_account: 'Your Instagram account must be a Business or Creator account linked to a Facebook Page. Go to Instagram → Settings → Account → Switch to Professional Account, then retry.',
  instagram_auth_failed: 'Instagram connection failed. Please try again.',
  facebook_auth_failed: 'Facebook connection failed. Please try again.',
  invalid_state: 'Session expired. Please try connecting again.',
  access_denied: 'Connection cancelled.',
};

interface ConnectionStatus {
  connected: boolean;
  accountName?: string;
  accountId?: string;
  expiresAt?: string;
}

interface Channel {
  id: string;
  title: string;
  channelId: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  active: boolean;
}

const PLATFORM_META: Record<string, { name: string; color: string; bg: string; initials: string; available: boolean }> = {
  youtube:   { name: 'YouTube',     color: '#FF0000', bg: '#fff5f5', initials: 'YT', available: true  },
  instagram: { name: 'Instagram',   color: '#E1306C', bg: '#fdf2f8', initials: 'IG', available: true  },
  tiktok:    { name: 'TikTok',      color: '#010101', bg: '#f9fafb', initials: 'TK', available: false },
  facebook:  { name: 'Facebook',    color: '#1877F2', bg: '#eff6ff', initials: 'FB', available: true  },
  linkedin:  { name: 'LinkedIn',    color: '#0A66C2', bg: '#eff6ff', initials: 'LI', available: false },
  x:         { name: 'X (Twitter)', color: '#000000', bg: '#f9fafb', initials: 'X',  available: false },
};

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';

async function startYouTubeOAuth() {
  try {
    const redirectUri = `${API_URL}/channels/oauth/callback`;
    const r = await apiClient.get<{ url: string }>('/channels/auth-url', {
      params: { redirectUri, accessLevel: 'PUBLISH', returnTo: '/publishing/accounts?connected=1' },
    });
    window.location.href = r.data.url;
  } catch { /* ignore */ }
}

function getUserIdFromToken(): string {
  try {
    const token = localStorage.getItem('cf_token');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { sub?: string };
    return payload.sub ?? '';
  } catch { return ''; }
}

async function startInstagramOAuth() {
  const userId = getUserIdFromToken();
  if (!userId) return;
  window.location.href = `${API_URL}/platforms/instagram/auth?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent('/publishing/accounts')}`;
}

async function disconnectInstagram() {
  try {
    await apiClient.delete('/platforms/instagram/disconnect');
  } catch { /* ignore */ }
}

async function startFacebookOAuth() {
  const userId = getUserIdFromToken();
  if (!userId) return;
  window.location.href = `${API_URL}/platforms/facebook/auth?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent('/publishing/accounts')}`;
}

async function disconnectFacebook() {
  try {
    await apiClient.delete('/platforms/facebook/disconnect');
  } catch { /* ignore */ }
}

export default function PublishingAccountsPage() {
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, channelRes] = await Promise.all([
        apiClient.get<Record<string, ConnectionStatus>>('/platforms/connection-status'),
        apiClient.get<Channel[]>('/channels'),
      ]);
      setStatuses(statusRes.data);
      setChannels(Array.isArray(channelRes.data) ? channelRes.data : []);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const errorCode = params.get('error');
    if (connected) {
      const name = connected.charAt(0).toUpperCase() + connected.slice(1);
      setSuccessMsg(`${name} connected successfully!`);
    }
    if (errorCode) {
      setErrorMsg(OAUTH_ERRORS[errorCode] ?? 'Connection failed. Please try again.');
    }
    if (connected || errorCode) {
      // Strip query params without reloading
      window.history.replaceState({}, '', '/publishing/accounts');
    }
  }, [load]);

  const ytChannels = channels.filter(c => c.active);

  const handleDisconnect = async (platformId: string) => {
    setDisconnecting(platformId);
    try {
      if (platformId === 'instagram') await disconnectInstagram();
      else if (platformId === 'facebook') await disconnectFacebook();
      await load();
    } finally { setDisconnecting(null); }
  };

  return (
    <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Connected Accounts</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your publishing connections across platforms</p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl border bg-green-50 border-green-200 text-green-800 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4 opacity-60 hover:opacity-100" /></button>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}><X className="w-4 h-4 opacity-60 hover:opacity-100" /></button>
        </div>
      )}

      {loading && Object.keys(statuses).length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#6D4AE0]" /></div>
      ) : (
        <div className="space-y-3">
          {Object.entries(PLATFORM_META).map(([platformId, meta]) => {
            const status = statuses[platformId] ?? { connected: false };
            const isYT = platformId === 'youtube';
            const isIG = platformId === 'instagram';
            const isFB = platformId === 'facebook';

            return (
              <div key={platformId} className="rounded-2xl p-5" style={{ background: meta.bg, border: `1.5px solid ${meta.color}20` }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: meta.color }}>
                      {meta.initials}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{meta.name}</p>
                      {status.connected ? (
                        <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Connected{status.accountName ? ` · @${status.accountName}` : ''}
                        </p>
                      ) : meta.available ? (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Not connected
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">Coming soon</p>
                      )}
                    </div>
                  </div>

                  {isYT ? (
                    status.connected ? (
                      <a
                        href="/publish?tab=accounts"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" /> Manage
                      </a>
                    ) : (
                      <button
                        onClick={() => void startYouTubeOAuth()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shrink-0"
                        style={{ background: '#FF0000' }}
                      >
                        Connect
                      </button>
                    )
                  ) : isIG ? (
                    status.connected ? (
                      <button
                        onClick={() => void handleDisconnect('instagram')}
                        disabled={disconnecting === 'instagram'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-pink-200 text-pink-600 hover:bg-pink-50 transition-colors shrink-0 disabled:opacity-50"
                      >
                        {disconnecting === 'instagram' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Disconnect
                      </button>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <button
                          onClick={() => void startInstagramOAuth()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shrink-0"
                          style={{ background: '#E1306C' }}
                        >
                          Connect
                        </button>
                      </div>
                    )
                  ) : isFB ? (
                    status.connected ? (
                      <button
                        onClick={() => void handleDisconnect('facebook')}
                        disabled={disconnecting === 'facebook'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors shrink-0 disabled:opacity-50"
                      >
                        {disconnecting === 'facebook' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => void startFacebookOAuth()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shrink-0"
                        style={{ background: '#1877F2' }}
                      >
                        Connect
                      </button>
                    )
                  ) : (
                    <span className="text-[11px] bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full font-semibold shrink-0">Soon</span>
                  )}
                </div>

                {/* YouTube channel list */}
                {isYT && ytChannels.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-red-100 space-y-2">
                    {ytChannels.map(ch => (
                      <div key={ch.id} className="flex items-center gap-3">
                        {ch.thumbnailUrl ? (
                          <img src={ch.thumbnailUrl} alt={ch.title} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-xs font-bold text-red-600">
                            {ch.title[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{ch.title}</p>
                          {ch.subscriberCount !== undefined && (
                            <p className="text-xs text-gray-400">{ch.subscriberCount.toLocaleString()} subscribers</p>
                          )}
                        </div>
                        <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl px-5 py-3 text-xs text-gray-400" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
        Instagram requires a <strong>Business or Creator account</strong> linked to a Facebook Page. Facebook connects your <strong>Facebook Page</strong> for post publishing. TikTok, LinkedIn, and X publishing coming soon.
      </div>
    </div>
  );
}
