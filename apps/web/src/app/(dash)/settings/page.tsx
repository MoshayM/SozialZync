'use client';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  Loader2, CheckCircle,
  LogOut, XCircle, Eye,
  Key, Save, EyeOff, Shield, Monitor, Unlink, Link2, User,
  Webhook, Trash2, Play, Plus, Cpu,
  Fingerprint, Camera, X as XIcon, Bell, BellOff,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { startRegistration } from '@simplewebauthn/browser';
import { api, apiClient, type OAuthProvider, type AuthSession, type LinkedAccount, type OAuthProviders, type AuthLinksResponse, type PasskeyCredentialView } from '@/lib/api';

interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  createdAt: string;
  lastDeliveryAt?: string | null;
  lastStatus?: 'success' | 'failed' | null;
}
import { Banner, type BannerState } from '@/components/banner';

interface ApiKeyEntry {
  key: string;
  label: string;
  masked: string;
  set: boolean;
}


function SettingsContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();

  const justLinkedProvider = searchParams.get('linked') ?? '';

  const [banner, setBanner] = useState<BannerState | null>(null);
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Push notifications ──────────────────────────────────────────────────────
  const {
    supported: pushSupported,
    permission: pushPermission,
    subscribing: pushSubscribing,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
  } = usePushNotifications();
  const [pushBanner, setPushBanner] = useState<string | null>(null);

  async function handlePushSubscribe() {
    try {
      await pushSubscribe();
      setPushBanner('Browser notifications enabled.');
    } catch {
      setPushBanner('Could not enable notifications. Check your browser settings.');
    }
  }

  async function handlePushUnsubscribe() {
    try {
      await pushUnsubscribe();
      setPushBanner('Browser notifications disabled.');
    } catch {
      setPushBanner('Failed to disable notifications. Please try again.');
    }
  }

  // ── Webhook state ───────────────────────────────────────────────────────────
  const [showAddWebhookForm, setShowAddWebhookForm] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [newWebhookSecret, setNewWebhookSecret] = useState('');
  const [webhookTestResults, setWebhookTestResults] = useState<Record<string, { delivered: boolean; statusCode?: number; error?: string } | null>>({});

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me().then((r) => r.data),
  });

  const isOwner = me?.role === 'OWNER' || me?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (me?.name != null) setProfileName(me.name ?? '');
    if (me?.avatarUrl != null) setProfileAvatar(me.avatarUrl ?? '');
  }, [me?.name, me?.avatarUrl]);

  // ── Sign-in & security queries ──────────────────────────────────────────────

  const { data: authLinks, refetch: refetchLinks } = useQuery<AuthLinksResponse>({
    queryKey: ['auth-links'],
    queryFn: () => api.auth.links().then((r) => r.data),
  });

  const { data: oauthProviders } = useQuery<OAuthProviders>({
    queryKey: ['oauth-providers'],
    queryFn: () => api.auth.providers().then((r) => r.data),
  });

  const { data: sessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useQuery<AuthSession[]>({
    queryKey: ['auth-sessions'],
    queryFn: () => api.auth.sessions().then((r) => r.data),
  });

  const [confirmRevokeSession, setConfirmRevokeSession] = useState<string | null>(null);

  // ── Passkeys state ──────────────────────────────────────────────────────────
  const passkeySupported = typeof window !== 'undefined' && typeof PublicKeyCredential !== 'undefined';
  const [passkeyName, setPasskeyName] = useState('');
  const [addingPasskey, setAddingPasskey] = useState(false);

  const { data: passkeys = [], refetch: refetchPasskeys } = useQuery<PasskeyCredentialView[]>({
    queryKey: ['passkeys'],
    queryFn: () => api.auth.listPasskeys().then((r) => r.data),
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: (id: string) => api.auth.deletePasskey(id),
    onSuccess: () => {
      void refetchPasskeys();
      setBanner({ type: 'success', message: 'Passkey removed.' });
    },
    onError: () => {
      setBanner({ type: 'error', message: 'Failed to remove passkey.' });
    },
  });

  async function handleAddPasskey() {
    if (!passkeySupported) return;
    setAddingPasskey(true);
    try {
      const { data: options } = await api.auth.webauthnRegisterOptions();
      const credential = await startRegistration({ optionsJSON: options });
      await api.auth.webauthnRegisterVerify(credential, passkeyName.trim() || undefined);
      setPasskeyName('');
      void refetchPasskeys();
      setBanner({ type: 'success', message: 'Passkey added successfully.' });
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'InvalidStateError') {
        setBanner({ type: 'error', message: 'This device is already registered as a passkey.' });
      } else if (name === 'NotAllowedError') {
        setBanner({ type: 'error', message: 'Passkey registration was cancelled.' });
      } else {
        setBanner({ type: 'error', message: 'Failed to add passkey. Please try again.' });
      }
    } finally {
      setAddingPasskey(false);
    }
  }

  const revokeSessionMutation = useMutation({
    mutationFn: (id: string) => api.auth.revokeSession(id),
    onSuccess: (_data, id) => {
      setConfirmRevokeSession(null);
      // If the revoked session was current, clear tokens and redirect
      const wasCurrentSession = sessions.find((s) => s.id === id && s.current);
      if (wasCurrentSession) {
        localStorage.removeItem('cf_token');
        localStorage.removeItem('cf.refreshToken');
        window.location.href = '/login';
        return;
      }
      void refetchSessions();
      setBanner({ type: 'info', message: 'Session revoked.' });
    },
    onError: () => {
      setBanner({ type: 'error', message: 'Failed to revoke session. Please try again.' });
    },
  });

  const revokeAllOtherSessionsMutation = useMutation({
    mutationFn: async () => {
      const others = sessions.filter((s) => !s.current);
      await Promise.all(others.map((s) => api.auth.revokeSession(s.id)));
    },
    onSuccess: () => {
      void refetchSessions();
      setBanner({ type: 'success', message: 'All other sessions signed out.' });
    },
    onError: () => {
      setBanner({ type: 'error', message: 'Failed to revoke some sessions. Please try again.' });
    },
  });

  const unlinkProviderMutation = useMutation({
    mutationFn: (provider: OAuthProvider) => api.auth.unlinkProvider(provider),
    onSuccess: () => {
      void refetchLinks();
      setBanner({ type: 'success', message: 'Account disconnected.' });
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setBanner({ type: 'error', message: 'Add a password or another sign-in method before removing this one.' });
      } else {
        setBanner({ type: 'error', message: 'Failed to disconnect account.' });
      }
    },
  });

  const linkProviderMutation = useMutation({
    mutationFn: async (provider: OAuthProvider) => {
      const redirectUri = `${window.location.origin}/oauth/callback/${provider}`;
      const { data } = await api.auth.oauthStart(provider, redirectUri, 'link');
      sessionStorage.setItem('cf.oauth.state', data.state);
      window.location.href = data.authUrl;
    },
    onError: () => {
      setBanner({ type: 'error', message: 'Could not start account linking. Please try again.' });
    },
  });

  const { data: apiKeys = [] } = useQuery<ApiKeyEntry[]>({
    queryKey: ['settings-api-keys'],
    queryFn: () => api.settings.getApiKeys().then((r) => r.data),
    enabled: isOwner,
  });

  // Handle ?linked=<provider> from OAuth link callback
  useEffect(() => {
    if (justLinkedProvider) {
      const label = justLinkedProvider.charAt(0).toUpperCase() + justLinkedProvider.slice(1);
      setBanner({ type: 'success', message: `${label} account linked successfully.` });
      window.history.replaceState({}, '', '/settings');
      void refetchLinks();
    }
  }, [justLinkedProvider]);

  // Compresses a selected image to 256×256 JPEG (~8-15 KB) for storage as data URI
  function handleAvatarFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const SIZE = 256;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d')!;
        const min = Math.min(img.width, img.height);
        const ox = (img.width - min) / 2;
        const oy = (img.height - min) / 2;
        ctx.drawImage(img, ox, oy, min, min, 0, 0, SIZE, SIZE);
        setProfileAvatar(canvas.toDataURL('image/jpeg', 0.88));
        setAvatarUploading(false);
      };
      img.onerror = () => setAvatarUploading(false);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => setAvatarUploading(false);
    reader.readAsDataURL(file);
  }

  const updateProfileMutation = useMutation({
    mutationFn: () => api.auth.updateProfile({ name: profileName, avatarUrl: profileAvatar }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      setProfileSaved(true);
      setBanner({ type: 'success', message: 'Profile updated.' });
      setTimeout(() => setProfileSaved(false), 3000);
    },
    onError: () => {
      setBanner({ type: 'error', message: 'Failed to update profile.' });
    },
  });

  const saveApiKeysMutation = useMutation({
    mutationFn: () => api.settings.updateApiKeys(apiKeyDrafts),
    onSuccess: () => {
      setApiKeyDrafts({});
      void qc.invalidateQueries({ queryKey: ['settings-api-keys'] });
      setBanner({ type: 'success', message: 'API keys saved successfully.' });
    },
    onError: () => {
      setBanner({ type: 'error', message: 'Failed to save API keys.' });
    },
  });

  // ── Webhook queries & mutations ─────────────────────────────────────────────
  const { data: webhooks = [] } = useQuery<WebhookEntry[]>({
    queryKey: ['dev-webhooks'],
    queryFn: () =>
      apiClient.get<{ webhooks: WebhookEntry[] }>('/dev/webhooks').then((r) => r.data.webhooks ?? []),
    enabled: isOwner,
  });


  const createWebhookMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/dev/webhooks', {
        url: newWebhookUrl,
        events: newWebhookEvents,
        ...(newWebhookSecret ? { secret: newWebhookSecret } : {}),
      }),
    onSuccess: () => {
      setShowAddWebhookForm(false);
      setNewWebhookUrl('');
      setNewWebhookEvents([]);
      setNewWebhookSecret('');
      void qc.invalidateQueries({ queryKey: ['dev-webhooks'] });
      setBanner({ type: 'success', message: 'Webhook created.' });
    },
    onError: () => setBanner({ type: 'error', message: 'Failed to create webhook.' }),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/dev/webhooks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dev-webhooks'] }),
    onError: () => setBanner({ type: 'error', message: 'Failed to delete webhook.' }),
  });

  async function testWebhook(id: string) {
    try {
      const res = await apiClient.post<{ delivered: boolean; statusCode?: number; error?: string }>(
        `/dev/webhooks/${id}/test`,
      );
      setWebhookTestResults((prev) => ({ ...prev, [id]: res.data }));
    } catch {
      setWebhookTestResults((prev) => ({ ...prev, [id]: { delivered: false, error: 'Request failed' } }));
    }
  }

  const WEBHOOK_EVENTS = [
    { value: 'video.completed', label: 'Video completed' },
    { value: 'video.published', label: 'Video published' },
    { value: 'job.failed', label: 'Job failed' },
    { value: 'calendar.proposed', label: 'Calendar proposed' },
    { value: 'calendar.approved', label: 'Calendar approved' },
  ];

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Settings</h1>
          <p className="text-sm text-gray-600 mt-0.5">Manage your profile, security, and developer integrations</p>
        </div>

        {/* ── Admin-only: AI infrastructure ───────────────────────────── */}
        {isOwner && (
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">AI &amp; Infrastructure</p>
            <a
              href="/settings/ai-infrastructure"
              className="flex items-center gap-3 px-4 py-4 bg-white rounded-2xl mb-3 transition-colors hover:bg-[#f3f4f6]"
              style={{ border: '1.5px solid #e5e7eb', textDecoration: 'none' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f3f4f6' }}>
                <Cpu className="w-5 h-5" style={{ color: '#6b7280' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">AI Cost Control</p>
                <p className="text-xs text-gray-600">Providers, routing, cost limits, local LLM &amp; usage analytics</p>
              </div>
            </a>
          </section>
        )}

        {/* Global notification banner */}
        {banner && (
          <Banner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
        )}

        {/* ── Profile ──────────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">Profile</p>
          <div className="bg-white rounded-2xl p-5 space-y-5" style={{ border: '1.5px solid #e5e7eb' }}>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" style={{ color: '#6b7280' }} />
              <span className="text-sm font-semibold text-gray-800">Your Profile</span>
            </div>

            {/* Avatar upload */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0 group">
                {/* Base layer: gradient + initial */}
                <div suppressHydrationWarning
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-3xl font-bold select-none"
                  style={{ border: '2px solid #e5e7eb' }}>
                  {(profileName[0] ?? me?.name?.[0] ?? '?').toUpperCase()}
                </div>
                {/* Image layer */}
                {profileAvatar && (
                  <img src={profileAvatar} alt="Avatar"
                    className="absolute inset-0 w-full h-full rounded-2xl object-cover"
                    style={{ border: '2px solid #e5e7eb' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                {/* Upload overlay */}
                <button type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  style={{ background: 'rgba(0,0,0,0.45)' }}
                  title="Upload photo">
                  {avatarUploading
                    ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                    : <Camera className="w-5 h-5 text-white" />}
                  <span className="text-[10px] text-white font-semibold">{avatarUploading ? 'Processing…' : 'Upload'}</span>
                </button>
                {/* Clear button */}
                {profileAvatar && (
                  <button type="button"
                    onClick={() => setProfileAvatar('')}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                    title="Remove photo">
                    <XIcon className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <p suppressHydrationWarning className="text-sm font-semibold text-gray-800">{profileName || me?.name || 'Your Name'}</p>
                <p suppressHydrationWarning className="text-xs text-gray-500">{me?.email ?? ''}</p>
                <p suppressHydrationWarning className="text-xs capitalize" style={{ color: '#6b7280', fontWeight: 600 }}>{me?.role?.toLowerCase() ?? 'creator'}</p>
                <button type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="mt-1 text-xs font-semibold underline underline-offset-2 disabled:opacity-50"
                  style={{ color: '#6b7280' }}>
                  {profileAvatar ? 'Change photo' : 'Upload photo'}
                </button>
              </div>

              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = ''; }} />
            </div>

            {/* Display name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display name</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20 focus:border-[#374151] transition-all"
                style={{ border: '1.5px solid #e3e0f0' }} />
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-400">Changes apply across the whole app</p>
              <button
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending || avatarUploading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl font-bold text-white text-sm hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(55,65,81,0.35)' }}>
                {updateProfileMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : profileSaved
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : <Save className="w-3.5 h-3.5" />}
                {profileSaved ? 'Saved!' : 'Save changes'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Sign-in & security ───────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">Sign-in &amp; Security</p>

          {/* Linked accounts */}
          <div className="bg-white rounded-2xl mb-4 overflow-hidden" style={{ border: '1.5px solid #e5e7eb' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <Shield className="w-4 h-4" style={{ color: '#6b7280' }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Linked accounts</p>
                <p className="text-xs text-gray-600 mt-0.5">Connect social accounts to sign in without a password.</p>
              </div>
            </div>
            {(['google'] as OAuthProvider[]).map((provider) => {
              const label = provider.charAt(0).toUpperCase() + provider.slice(1);
              const linkedAccount: LinkedAccount | undefined = authLinks?.links.find((l) => l.provider === provider);
              const providerEnabled = oauthProviders?.[provider] ?? false;
              const isPending = unlinkProviderMutation.isPending || linkProviderMutation.isPending;

              return (
                <div key={provider} className="flex items-center gap-4 px-4 py-3 hover:bg-[#faf9ff]" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
                      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
                      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5H1.3v3C3.3 21.3 7.3 24 12 24z" />
                      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4v-3H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
                      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C16.9 1 14.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c1-2.9 3.7-4.9 6.8-4.9z" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    {linkedAccount ? (
                      <p className="text-xs text-gray-600 truncate">{linkedAccount.email}</p>
                    ) : (
                      <p className="text-xs text-gray-600">
                        {providerEnabled ? 'Not connected' : 'Not configured'}
                      </p>
                    )}
                  </div>

                  {linkedAccount ? (
                    <button
                      onClick={() => unlinkProviderMutation.mutate(provider)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 text-xs rounded-2xl hover:bg-red-50 transition-colors disabled:opacity-40"
                      style={{ border: '1.5px solid #fecaca' }}
                    >
                      {unlinkProviderMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                      Disconnect
                    </button>
                  ) : providerEnabled ? (
                    <button
                      onClick={() => linkProviderMutation.mutate(provider)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl hover:bg-[#f3f4f6] transition-colors disabled:opacity-40 font-semibold text-gray-600"
                      style={{ border: '1.5px solid #e5e7eb', color: '#6b7280' }}
                    >
                      {linkProviderMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                      Connect
                    </button>
                  ) : (
                    <span className="text-xs text-gray-600 italic">Not configured</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Passkeys */}
          {passkeySupported && (
            <div className="bg-white rounded-2xl mb-4 overflow-hidden" style={{ border: '1.5px solid #e5e7eb' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <Fingerprint className="w-4 h-4" style={{ color: '#6b7280' }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Passkeys</p>
                  <p className="text-xs text-gray-600 mt-0.5">Sign in with Face ID, Touch ID, or a hardware key — no password needed.</p>
                </div>
              </div>

              {/* Existing passkeys */}
              {passkeys.length === 0 && (
                <div className="px-4 py-4 text-sm text-gray-600">No passkeys registered yet.</div>
              )}
              {passkeys.map((pk) => (
                <div key={pk.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf9ff]" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <Key className="w-4 h-4 text-gray-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{pk.name ?? 'Unnamed passkey'}</p>
                    <p className="text-xs text-gray-600">
                      {pk.deviceType === 'multiDevice' ? 'Synced' : 'Device-bound'}
                      {pk.backedUp && ' · Backed up'}
                      {' · Added '}
                      {new Date(pk.createdAt).toLocaleDateString()}
                      {pk.lastUsedAt && ` · Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Remove this passkey? You will no longer be able to sign in with it.')) {
                        deletePasskeyMutation.mutate(pk.id);
                      }
                    }}
                    disabled={deletePasskeyMutation.isPending}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-red-600 text-xs rounded-2xl hover:bg-red-50 transition-colors disabled:opacity-40"
                    style={{ border: '1.5px solid #fecaca' }}
                  >
                    {deletePasskeyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Remove
                  </button>
                </div>
              ))}

              {/* Add passkey row */}
              <div className="px-4 py-3 flex items-center gap-2">
                <input
                  type="text"
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  placeholder="Name this passkey (optional)"
                  className="flex-1 text-sm px-3 py-2 rounded-xl bg-[#faf9ff] outline-none focus:ring-2 ring-[#374151]"
                  style={{ border: '1.5px solid #e5e7eb' }}
                />
                <button
                  type="button"
                  onClick={() => { void handleAddPasskey(); }}
                  disabled={addingPasskey}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl font-semibold text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)' }}
                >
                  {addingPasskey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add Passkey
                </button>
              </div>
            </div>
          )}

          {/* Content channels — link to Media Control */}
          <div className="bg-white rounded-2xl mb-4 overflow-hidden" style={{ border: '1.5px solid #e5e7eb' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
                <rect x="2" y="7" width="20" height="15" rx="2" stroke="#374151" strokeWidth="1.8" />
                <path d="M16 2 8 2 2 7h20z" fill="#e5e7eb" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800">Content Channels</p>
                <p className="text-xs text-gray-600 mt-0.5">Connect and manage all your publishing accounts in one place.</p>
              </div>
            </div>
            <div className="px-4 py-5 flex items-center justify-between gap-4">
              <p className="text-sm text-gray-600">YouTube, Instagram, TikTok, Facebook, X, LinkedIn, Threads — all managed in one place.</p>
              <a
                href="/settings/channels"
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(55,65,81,0.35)', textDecoration: 'none' }}
              >
                <Plus className="w-3.5 h-3.5" /> Manage Channels
              </a>
            </div>
          </div>

          {/* Active sessions — OWNER / SUPER_ADMIN only */}
          {isOwner && <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e5e7eb' }}>
            <div className="px-4 py-3 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-gray-500" />
                  Active sessions
                </p>
                <p className="text-xs text-gray-600 mt-0.5">Devices currently signed in to your account.</p>
              </div>
              {sessions.filter((s) => !s.current).length > 0 && (
                <button
                  onClick={() => revokeAllOtherSessionsMutation.mutate()}
                  disabled={revokeAllOtherSessionsMutation.isPending}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-red-600 text-xs rounded-2xl hover:bg-red-50 transition-colors disabled:opacity-40"
                  style={{ border: '1.5px solid #fecaca' }}
                >
                  {revokeAllOtherSessionsMutation.isPending
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <LogOut className="w-3 h-3" />}
                  Sign out all other sessions
                </button>
              )}
            </div>

            {sessions.length === 0 && !sessionsLoading && (
              <div className="px-4 py-6 text-center text-sm text-gray-600">No active sessions found.</div>
            )}

            {sessions.map((session) => {
              const deviceLabel = session.device.length > 60
                ? session.device.slice(0, 57) + '…'
                : session.device;
              const isConfirming = confirmRevokeSession === session.id;

              return (
                <div key={session.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#faf9ff]" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <Monitor className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-gray-700 truncate">{deviceLabel}</p>
                      {session.current && (
                        <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 whitespace-nowrap" style={{ background: '#ecfdf5', color: '#065f46' }}>
                          This device
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {session.ip} &middot; Last active {new Date(session.lastUsedAt).toLocaleString()}
                    </p>
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-600">
                        {session.current ? 'You will be signed out.' : 'Revoke?'}
                      </span>
                      <button
                        onClick={() => revokeSessionMutation.mutate(session.id)}
                        disabled={revokeSessionMutation.isPending}
                        className="px-3 py-1 bg-red-600 text-white text-xs rounded-2xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {revokeSessionMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                        Yes, revoke
                      </button>
                      <button
                        onClick={() => setConfirmRevokeSession(null)}
                        className="px-3 py-1 text-xs rounded-2xl hover:bg-gray-50 font-semibold text-gray-600"
                        style={{ border: '1.5px solid #e5e7eb' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRevokeSession(session.id)}
                      disabled={revokeSessionMutation.isPending}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-gray-600 text-xs rounded-2xl hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 font-semibold"
                      style={{ border: '1.5px solid #e5e7eb' }}
                    >
                      <XCircle className="w-3 h-3" />
                      Revoke
                    </button>
                  )}
                </div>
              );
            })}
          </div>}
        </section>

        {/* ── Developer Webhooks — OWNER / SUPER_ADMIN only ───────────── */}
        {isOwner && <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">Developer Webhooks</p>
          <div className="bg-white rounded-2xl mb-3" style={{ border: '1.5px solid #e5e7eb' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <Webhook className="w-4 h-4" style={{ color: '#6b7280' }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Webhooks</p>
                <p className="text-xs text-gray-600 mt-0.5">Receive HTTP POST notifications when events happen in your account.</p>
              </div>
            </div>

            {webhooks.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-600">No webhooks yet.</div>
            )}
            {webhooks.map((wh) => {
              const testResult = webhookTestResults[wh.id];
              return (
                <div key={wh.id} className="px-4 py-3 space-y-2 hover:bg-[#faf9ff]" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-gray-800 truncate">{wh.url}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {wh.events.map((ev) => (
                          <span key={ev} className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: '#f3f4f6', color: '#6b7280' }}>{ev}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        title={wh.lastStatus ?? 'Never delivered'}
                        className={`w-2 h-2 rounded-full ${wh.lastStatus === 'success' ? 'bg-green-500' : wh.lastStatus === 'failed' ? 'bg-red-500' : 'bg-gray-300'}`}
                      />
                      <button
                        onClick={() => void testWebhook(wh.id)}
                        title="Send test event"
                        className="p-1.5 text-gray-500 hover:bg-[#f3f4f6] rounded-2xl transition-colors"
                        style={{ color: '#6b7280' }}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Delete this webhook?')) deleteWebhookMutation.mutate(wh.id); }}
                        disabled={deleteWebhookMutation.isPending}
                        title="Delete webhook"
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {testResult !== undefined && testResult !== null && (
                    <p className={`text-xs px-2 py-1 rounded-2xl ${testResult.delivered ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {testResult.delivered
                        ? `Delivered (HTTP ${testResult.statusCode ?? '?'})`
                        : `Failed${testResult.error ? `: ${testResult.error}` : ''}`}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Add webhook form */}
            {showAddWebhookForm ? (
              <div className="px-4 py-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">New webhook</p>
                <input
                  type="url"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="w-full bg-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20 focus:border-[#374151] transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                  required
                />
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Events</p>
                  <div className="grid grid-cols-2 gap-2">
                    {WEBHOOK_EVENTS.map((ev) => (
                      <label key={ev.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newWebhookEvents.includes(ev.value)}
                          onChange={(e) =>
                            setNewWebhookEvents((prev) =>
                              e.target.checked ? [...prev, ev.value] : prev.filter((x) => x !== ev.value),
                            )
                          }
                          className="w-4 h-4 rounded"
                          style={{ accentColor: '#374151' }}
                        />
                        {ev.label}
                      </label>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={newWebhookSecret}
                  onChange={(e) => setNewWebhookSecret(e.target.value)}
                  placeholder="Optional signing secret"
                  className="w-full bg-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20 focus:border-[#374151] transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowAddWebhookForm(false); setNewWebhookUrl(''); setNewWebhookEvents([]); setNewWebhookSecret(''); }}
                    className="px-3 py-1.5 text-sm rounded-2xl hover:bg-gray-50 font-semibold text-gray-600"
                    style={{ border: '1.5px solid #e5e7eb' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createWebhookMutation.mutate()}
                    disabled={createWebhookMutation.isPending || !newWebhookUrl.trim() || newWebhookEvents.length === 0}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl font-bold text-white text-sm hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
                    style={{ background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(55,65,81,0.35)' }}
                  >
                    {createWebhookMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3">
                <button
                  onClick={() => setShowAddWebhookForm(true)}
                  className="flex items-center gap-1.5 text-sm font-bold hover:opacity-80 transition-opacity"
                  style={{ color: '#6b7280' }}
                >
                  <span className="text-lg leading-none">+</span> Add Webhook
                </button>
              </div>
            )}
          </div>
        </section>}

        {/* ── API Keys (Owner only) ─────────────────────────── */}
        {isOwner && (
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">API Keys</p>
            <div className="bg-white rounded-2xl mb-3" style={{ border: '1.5px solid #e5e7eb' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <Key className="w-4 h-4" style={{ color: '#6b7280' }} />
                <div>
                  <p className="text-sm font-semibold text-gray-800">API Keys</p>
                  <p className="text-xs text-gray-600 mt-0.5">Configure provider API keys used by the AI agents. Visible to owner only.</p>
                </div>
              </div>

              {apiKeys.map((entry) => {
                const draft = apiKeyDrafts[entry.key];
                const displayValue = draft !== undefined ? draft : '';
                const isVisible = showKeys[entry.key] ?? false;

                return (
                  <div key={entry.key} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-[#faf9ff]" style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{entry.label}</p>
                      <p className="text-xs text-gray-600 font-mono mt-0.5">
                        {entry.key}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-80">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type={isVisible ? 'text' : 'password'}
                          value={displayValue}
                          placeholder={entry.set ? entry.masked : 'Not set — paste key here'}
                          onChange={(e) =>
                            setApiKeyDrafts((prev) => ({ ...prev, [entry.key]: e.target.value }))
                          }
                          className="w-full bg-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20 focus:border-[#374151] transition-all font-mono placeholder:text-gray-600 placeholder:font-sans"
                          style={{ border: '1.5px solid #e3e0f0', paddingRight: entry.set && draft === undefined ? '5rem' : '2.5rem' }}
                        />
                        {entry.set && draft === undefined && (
                          <span className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5 whitespace-nowrap pointer-events-none" style={{ background: '#ecfdf5', color: '#065f46' }}>
                            <CheckCircle className="w-3 h-3" /> Set
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowKeys((p) => ({ ...p, [entry.key]: !isVisible }))}
                          aria-label={isVisible ? 'Hide key' : 'Show key'}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-600 touch-manipulation"
                          style={{ minWidth: '32px', minHeight: '32px' }}
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {Object.keys(apiKeyDrafts).length > 0 && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => saveApiKeysMutation.mutate()}
                  disabled={saveApiKeysMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-2xl font-bold text-white text-sm hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(55,65,81,0.35)' }}
                >
                  {saveApiKeysMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4" /> Save API Keys</>}
                </button>
              </div>
            )}
          </section>
        )}
        {/* ── Notifications ─────────────────────────────────────────── */}
        {pushSupported && (
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">Notifications</p>
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e5e7eb' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <Bell className="w-4 h-4" style={{ color: '#6b7280' }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Browser Notifications</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Get alerts in your browser when jobs complete, compliance fails, or a video publishes — even when the tab is in the background.
                  </p>
                </div>
                <span
                  className="text-[11px] font-bold rounded-full px-2.5 py-0.5 whitespace-nowrap"
                  style={{
                    background: pushPermission === 'granted' ? '#ecfdf5' : pushPermission === 'denied' ? '#fef2f2' : '#f3f4f6',
                    color: pushPermission === 'granted' ? '#065f46' : pushPermission === 'denied' ? '#991b1b' : '#374151',
                  }}
                >
                  {pushPermission === 'granted' ? 'Enabled' : pushPermission === 'denied' ? 'Blocked' : 'Off'}
                </span>
              </div>

              <div className="px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-600">
                  {pushPermission === 'granted'
                    ? 'You are receiving browser push notifications on this device.'
                    : pushPermission === 'denied'
                    ? 'Notifications are blocked. Allow them in your browser site settings, then try again.'
                    : 'Enable browser notifications to stay informed without keeping the app open.'}
                </p>

                {pushPermission === 'granted' ? (
                  <button
                    type="button"
                    onClick={() => { void handlePushUnsubscribe(); }}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl font-semibold text-sm hover:bg-red-50 transition-colors"
                    style={{ border: '1.5px solid #fecaca', color: '#dc2626' }}
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    Disable
                  </button>
                ) : pushPermission !== 'denied' ? (
                  <button
                    type="button"
                    onClick={() => { void handlePushSubscribe(); }}
                    disabled={pushSubscribing}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl font-bold text-white text-sm hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
                    style={{ background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(55,65,81,0.35)' }}
                  >
                    {pushSubscribing
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Bell className="w-3.5 h-3.5" />}
                    Enable browser notifications
                  </button>
                ) : null}
              </div>

              {pushBanner && (
                <div className="px-4 pb-3">
                  <p className="text-xs px-3 py-2 rounded-xl bg-[#f3f4f6] text-gray-700">{pushBanner}</p>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#6b7280' }} /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
