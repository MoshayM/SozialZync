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

const ERROR_FIX_STEPS: Record<string, { platform: string; steps: string[] }> = {
  wrong_facebook_account: {
    platform: 'instagram',
    steps: [
      'Open Facebook in your browser and switch to the account that manages your Instagram-linked Page',
      'Come back here and click Try Again',
    ],
  },
  pages_permission_denied: {
    platform: 'instagram',
    steps: [
      'Click Try Again below',
      'When Facebook shows the permissions list, leave all items checked before clicking Continue',
    ],
  },
  no_instagram_business_account: {
    platform: 'instagram',
    steps: [
      'On Instagram: Settings → Account → Switch to Professional Account',
      'In Meta Business Suite, link your Instagram to your Facebook Page',
      'Then click Try Again',
    ],
  },
  no_facebook_pages: { platform: 'facebook', steps: ["Make sure you're logged into Facebook as the Page admin", 'Click Try Again'] },
  instagram_auth_failed: { platform: 'instagram', steps: ['Click Try Again below'] },
  facebook_auth_failed:  { platform: 'facebook',  steps: ['Click Try Again below'] },
};

const PLATFORM_GUIDE: Record<string, { prereqs: string[]; note: string; ctaColor: string }> = {
  instagram: {
    prereqs: [
      'An Instagram Business or Creator account (not a personal account)',
      'Your Instagram linked to a Facebook Page in Meta Business Suite',
      'You are logged into the Facebook account that manages that Page',
    ],
    note: "You'll be redirected to Facebook to authorize — this is how Instagram's API works. Use your Facebook login.",
    ctaColor: '#E1306C',
  },
  facebook: {
    prereqs: [
      'A Facebook Page (not a personal profile)',
      'Admin access to that Page',
    ],
    note: "You'll authorize Sozialzynk to publish posts and read insights from your Facebook Page.",
    ctaColor: '#1877F2',
  },
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

function startInstagramOAuth() {
  const userId = getUserIdFromToken();
  if (!userId) return;
  window.location.href = `${API_URL}/platforms/instagram/auth?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent('/publishing/accounts')}`;
}

async function disconnectInstagram() {
  try { await apiClient.delete('/platforms/instagram/disconnect'); } catch { /* ignore */ }
}

function startFacebookOAuth() {
  const userId = getUserIdFromToken();
  if (!userId) return;
  window.location.href = `${API_URL}/platforms/facebook/auth?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent('/publishing/accounts')}`;
}

async function disconnectFacebook() {
  try { await apiClient.delete('/platforms/facebook/disconnect'); } catch { /* ignore */ }
}

function ConnectGuideModal({
  platformId,
  meta,
  onConfirm,
  onCancel,
}: {
  platformId: string;
  meta: typeof PLATFORM_META[string];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const guide = PLATFORM_GUIDE[platformId];
  if (!guide) { onConfirm(); return null; }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: meta.color }}
            >
              {meta.initials}
            </div>
            <h2 className="text-lg font-bold text-gray-900">Connect {meta.name}</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Checklist */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Before continuing, make sure:</p>
          <ul className="space-y-2.5">
            {guide.prereqs.map((req, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2.5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">{guide.note}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors"
            style={{ background: guide.ctaColor }}
          >
            Continue to Facebook →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PublishingAccountsPage() {
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedErrorCode, setSavedErrorCode] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [guideForPlatform, setGuideForPlatform] = useState<string | null>(null);

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
      setSavedErrorCode(errorCode);
    }
    if (connected || errorCode) {
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

  const dismissError = () => { setErrorMsg(null); setSavedErrorCode(''); };

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

      {/* Error banner + fix steps */}
      {errorMsg && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-800 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span className="flex-1">{errorMsg}</span>
            <button onClick={dismissError}><X className="w-4 h-4 opacity-60 hover:opacity-100" /></button>
          </div>
          {savedErrorCode && ERROR_FIX_STEPS[savedErrorCode] && (
            <div className="px-4 py-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-amber-900">How to fix this:</p>
              <ol className="space-y-2">
                {ERROR_FIX_STEPS[savedErrorCode]!.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-amber-800">
                    <span className="shrink-0 w-4 h-4 bg-amber-200 text-amber-900 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <button
                onClick={() => {
                  const platform = ERROR_FIX_STEPS[savedErrorCode]!.platform;
                  dismissError();
                  setGuideForPlatform(platform);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {loading && Object.keys(statuses).length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#374151]" /></div>
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
                      <button
                        onClick={() => setGuideForPlatform('instagram')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shrink-0"
                        style={{ background: '#E1306C' }}
                      >
                        Connect
                      </button>
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
                        onClick={() => setGuideForPlatform('facebook')}
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

      {/* Pre-connect guide modal */}
      {guideForPlatform && PLATFORM_META[guideForPlatform] && (
        <ConnectGuideModal
          platformId={guideForPlatform}
          meta={PLATFORM_META[guideForPlatform]!}
          onConfirm={() => {
            const p = guideForPlatform;
            setGuideForPlatform(null);
            if (p === 'instagram') startInstagramOAuth();
            else if (p === 'facebook') startFacebookOAuth();
          }}
          onCancel={() => setGuideForPlatform(null)}
        />
      )}
    </div>
  );
}
