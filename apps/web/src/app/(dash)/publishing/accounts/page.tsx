'use client';
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api';

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
  instagram: { name: 'Instagram',   color: '#E1306C', bg: '#fdf2f8', initials: 'IG', available: false },
  tiktok:    { name: 'TikTok',      color: '#010101', bg: '#f9fafb', initials: 'TK', available: false },
  facebook:  { name: 'Facebook',    color: '#1877F2', bg: '#eff6ff', initials: 'FB', available: false },
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

export default function PublishingAccountsPage() {
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { void load(); }, [load]);

  const ytChannels = channels.filter(c => c.active);

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

      {loading && Object.keys(statuses).length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#6D4AE0]" /></div>
      ) : (
        <div className="space-y-3">
          {Object.entries(PLATFORM_META).map(([platformId, meta]) => {
            const status = statuses[platformId] ?? { connected: false };
            const isYT = platformId === 'youtube';

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
                          <CheckCircle className="w-3 h-3" /> Connected{status.accountName ? ` · ${status.accountName}` : ''}
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
        Instagram, TikTok, Facebook, LinkedIn, and X publishing is coming soon. You can create content for any platform now and connect accounts when they become available.
      </div>
    </div>
  );
}
