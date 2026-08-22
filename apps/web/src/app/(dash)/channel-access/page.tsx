'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Circle,
  Users,
  BarChart2,
  Upload,
  RefreshCw,
  Unlink,
  Plus,
  Info,
  Lock,
  Zap,
  Globe,
  ChevronRight,
  Check,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlatformScope {
  label: string;
}

interface ConnectedChannel {
  handle: string;
  name: string;
  subscriberCount: string;
  avatarInitials: string;
  avatarGradient: string;
  lastSynced: string;
}

interface Platform {
  id: string;
  name: string;
  description: string;
  audienceSize: string;
  connected: boolean;
  scopes: PlatformScope[];
  channel: ConnectedChannel | null;
  iconBg: string;
  iconLetter: string;
  iconEmoji: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const PLATFORMS: Platform[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Upload videos, manage playlists, and track analytics.',
    audienceSize: 'Reach 2.7B users',
    connected: true,
    scopes: [
      { label: 'Read channel data' },
      { label: 'Upload videos' },
      { label: 'Manage playlists' },
      { label: 'Read analytics' },
    ],
    channel: {
      handle: '@CreatorForce',
      name: 'CreatorForce',
      subscriberCount: '12.4K subscribers',
      avatarInitials: 'CF',
      avatarGradient: 'linear-gradient(135deg,#ef4444,#f97316)',
      lastSynced: '3 minutes ago',
    },
    iconBg: '#FF0000',
    iconLetter: 'Y',
    iconEmoji: '▶',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Schedule Reels, Stories, and carousel posts.',
    audienceSize: 'Reach 2.5B users',
    connected: false,
    scopes: [
      { label: 'Read profile' },
      { label: 'Publish media' },
      { label: 'Read insights' },
    ],
    channel: null,
    iconBg: 'linear-gradient(135deg,#e1306c,#fd1d1d,#fcb045)',
    iconLetter: 'I',
    iconEmoji: '📷',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Post short-form videos and monitor performance.',
    audienceSize: 'Reach 1.5B users',
    connected: false,
    scopes: [
      { label: 'Read profile' },
      { label: 'Upload videos' },
      { label: 'Read analytics' },
    ],
    channel: null,
    iconBg: '#010101',
    iconLetter: 'T',
    iconEmoji: '♪',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Publish to Pages and Groups, boost with ads data.',
    audienceSize: 'Reach 3.0B users',
    connected: false,
    scopes: [
      { label: 'Manage Pages' },
      { label: 'Publish content' },
      { label: 'Read Page insights' },
    ],
    channel: null,
    iconBg: '#1877F2',
    iconLetter: 'f',
    iconEmoji: 'f',
  },
];

const BENEFITS = [
  {
    icon: Zap,
    title: 'One-click publishing',
    description: 'Push content to every connected platform simultaneously from the Publish Hub.',
  },
  {
    icon: BarChart2,
    title: 'Unified analytics',
    description: 'See cross-platform views, engagement, and growth in a single dashboard.',
  },
  {
    icon: Globe,
    title: 'AI-optimised per channel',
    description: 'Titles, descriptions, and hashtags auto-tuned for each platform\'s algorithm.',
  },
];

// ─── Platform icon component ──────────────────────────────────────────────────

function PlatformIcon({ platform }: { platform: Platform }) {
  const isGradient = platform.iconBg.startsWith('linear-gradient');
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0"
      style={{ background: platform.iconBg }}
    >
      {platform.iconLetter}
    </div>
  );
}

// ─── Connected card content ───────────────────────────────────────────────────

function ConnectedCardContent({
  platform,
  onDisconnect,
}: {
  platform: Platform;
  onDisconnect: (id: string) => void;
}) {
  const ch = platform.channel!;
  return (
    <>
      {/* Channel info row */}
      <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-xl">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ background: ch.avatarGradient }}
        >
          {ch.avatarInitials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{ch.name}</p>
          <p className="text-xs text-gray-500">{ch.handle}</p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-xs font-semibold text-gray-800">{ch.subscriberCount}</p>
          <p className="text-[10px] text-gray-400 flex items-center gap-1 justify-end mt-0.5">
            <RefreshCw className="w-2.5 h-2.5" />
            {ch.lastSynced}
          </p>
        </div>
      </div>

      {/* Scopes */}
      <div className="mt-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Scopes granted
        </p>
        <div className="space-y-1.5">
          {platform.scopes.map((scope) => (
            <div key={scope.label} className="flex items-center gap-2">
              <Check className="w-3 h-3 text-green-500 shrink-0" />
              <span className="text-xs text-gray-600">{scope.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-5">
        <button className="flex-1 inline-flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-2.5 rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 transition-all">
          <RefreshCw className="w-3 h-3" />
          Manage
        </button>
        <button
          onClick={() => onDisconnect(platform.id)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 border border-red-100 text-red-500 text-xs font-semibold px-3 py-2.5 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all"
        >
          <Unlink className="w-3 h-3" />
          Disconnect
        </button>
      </div>
    </>
  );
}

// ─── Disconnected card content ────────────────────────────────────────────────

function DisconnectedCardContent({ platform }: { platform: Platform }) {
  return (
    <>
      {/* Scopes preview */}
      <div className="mt-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Permissions requested
        </p>
        <div className="space-y-1.5">
          {platform.scopes.map((scope) => (
            <div key={scope.label} className="flex items-center gap-2">
              <Circle className="w-3 h-3 text-gray-300 shrink-0" />
              <span className="text-xs text-gray-500">{scope.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Connect button */}
      <button
        className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-gray-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition-all shadow-sm shadow-purple-200"
      >
        <Plus className="w-4 h-4" />
        Connect {platform.name}
      </button>
    </>
  );
}

// ─── Platform card ────────────────────────────────────────────────────────────

function PlatformCard({
  platform,
  onDisconnect,
}: {
  platform: Platform;
  onDisconnect: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:border-gray-100 transition-all p-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <PlatformIcon platform={platform} />
          <div>
            <h3 className="font-bold text-gray-900 text-base">{platform.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{platform.description}</p>
          </div>
        </div>
        {platform.connected ? (
          <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-100 shrink-0 ml-2">
            <CheckCircle2 className="w-3 h-3" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-gray-50 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-100 shrink-0 ml-2">
            <Circle className="w-3 h-3" />
            Not connected
          </span>
        )}
      </div>

      {/* Audience tag */}
      <div className="mt-3 flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-600 font-medium">{platform.audienceSize}</span>
      </div>

      {/* Body: connected vs disconnected */}
      {platform.connected ? (
        <ConnectedCardContent platform={platform} onDisconnect={onDisconnect} />
      ) : (
        <DisconnectedCardContent platform={platform} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelAccessPage() {
  const [platforms, setPlatforms] = useState<Platform[]>(PLATFORMS);

  const connectedCount = platforms.filter((p) => p.connected).length;
  const totalCount = platforms.length;
  const progressPct = Math.round((connectedCount / totalCount) * 100);

  function handleDisconnect(id: string) {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, connected: false, channel: null } : p
      )
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F3FB]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24 lg:pb-10">

        {/* ── Hero header ── */}
        <div
          className="rounded-2xl p-6 sm:p-8 mb-6 text-white"
          style={{ background: 'linear-gradient(135deg,#1a0845,#4c1d95,#7c3aed)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Connect Your Channels</h1>
                <p className="text-gray-200 text-sm mt-0.5">
                  Link your social accounts to publish to multiple platforms from one place.
                </p>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all self-start sm:self-auto shrink-0">
              <Plus className="w-4 h-4" />
              Add Platform
            </button>
          </div>
        </div>

        {/* ── Status summary bar ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {connectedCount} of {totalCount} platforms connected
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {totalCount - connectedCount} more platform{totalCount - connectedCount !== 1 ? 's' : ''} available to connect
                </p>
              </div>
            </div>
            <div className="sm:w-48 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 font-medium">{progressPct}% complete</span>
                {connectedCount === totalCount && (
                  <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    All connected
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg,#7c3aed,#9333ea)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Info banner ── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 leading-relaxed">
            <strong className="font-semibold">Sozialzync</strong> only requests the minimum
            permissions needed to publish and read analytics. We never access your private messages
            or post without your approval.
          </p>
        </div>

        {/* ── Platform cards grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {platforms.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              onDisconnect={handleDisconnect}
            />
          ))}
        </div>

        {/* ── Why connect? ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Why connect your channels?</h2>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.title}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{benefit.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Privacy note ── */}
        <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <Lock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="font-semibold text-gray-600">Your privacy is protected.</strong>{' '}
            OAuth tokens are encrypted at rest and never shared with third parties. You can revoke
            access at any time from this page or directly through each platform's security settings.
            Sozialzync complies with YouTube API Services Terms of Service, Meta Platform Terms, and
            TikTok Developer Terms.
          </p>
        </div>

      </div>
    </div>
  );
}
