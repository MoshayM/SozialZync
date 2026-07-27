'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FolderOpen, Settings, LogOut, Palette, Clapperboard, Wallet,
  Bell, ShieldCheck, Building2, ChevronDown, Film, Menu, X, Home, Bot,
  Upload, BookOpen, BarChart2, Search, Zap, HelpCircle,
} from 'lucide-react';
import { CopilotPanel } from '@/components/copilot-panel';
import { LogoMark } from '@/components/logo-mark';
import { api, clearTokens, getRefreshToken, type AppNotification } from '@/lib/api';
import { usePlan } from '@/lib/plan';

interface NavItem {
  href: string;
  icon: typeof FolderOpen;
  label: string;
  badge?: string;
  action?: () => void;
}

interface NavSection {
  category?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/home',          icon: Home,         label: 'Home' },
      { href: '/content',       icon: BookOpen,     label: 'Content' },
      { href: '/projects',      icon: FolderOpen,   label: 'Projects' },
      { href: '/shorts-studio', icon: Clapperboard, label: 'Shorts Studio' },
    ],
  },
  {
    items: [
      { href: '/editor', icon: Film, label: 'Video Editor' },
    ],
  },
  {
    items: [
      { href: '/publish',  icon: Upload,      label: 'Publish' },
      { href: '/insights', icon: BarChart2,   label: 'Insights' },
    ],
  },
  {
    items: [
      { href: '/guide', icon: HelpCircle, label: 'Guide' },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: '/settings',  icon: Settings,  label: 'Settings' },
  { href: '/brand-kit', icon: Palette,   label: 'Brand Kit' },
  { href: '/wallet',    icon: Wallet,    label: 'Billing' },
  { href: '/orgs',      icon: Building2, label: 'Organization' },
];

/* Mobile bottom nav — 4 primary items + "More" button */
const MOBILE_NAV_ITEMS = [
  { href: '/home',     icon: Home,       label: 'Home' },
  { href: '/projects', icon: FolderOpen, label: 'Projects' },
  { href: '/content',  icon: BookOpen,   label: 'Content' },
  { href: '/publish',  icon: Upload,     label: 'Publish' },
];

function nameFromToken(): string {
  try {
    const token = localStorage.getItem('cf_token');
    if (!token) return 'Creator';
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { name?: string; email?: string };
    return payload.name || payload.email?.split('@')[0] || 'Creator';
  } catch {
    return 'Creator';
  }
}

function roleFromToken(): string {
  try {
    const token = localStorage.getItem('cf_token');
    if (!token) return 'MEMBER';
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { role?: string };
    return payload.role ?? 'MEMBER';
  } catch {
    return 'MEMBER';
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const BELL_POLL_MS = 60_000;

// ── Global search bar ─────────────────────────────────────────────────────────

const SEARCH_DESTINATIONS: Array<{ pattern: RegExp; label: string; path: (q: string) => string }> = [
  { pattern: /video|short|clip|reel/i,   label: 'videos',   path: q => `/projects?tab=media&q=${encodeURIComponent(q)}` },
  { pattern: /channel|youtube|account/i, label: 'channels', path: q => `/projects?tab=channels&q=${encodeURIComponent(q)}` },
];

function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const dest = SEARCH_DESTINATIONS.find(d => d.pattern.test(trimmed));
    router.push(dest ? dest.path(trimmed) : `/projects?q=${encodeURIComponent(trimmed)}`);
    setQuery('');
    inputRef.current?.blur();
  };

  return (
    <form
      role="search"
      onSubmit={e => { e.preventDefault(); submit(query); }}
      className="hidden md:flex flex-1 max-w-[400px] ml-3 items-center gap-2 rounded-[12px] px-3 py-2 transition-all"
      style={{
        background: focused ? '#fff' : '#F7F6FB',
        border: focused ? '1.5px solid #6D4AE0' : '1px solid #ECECF3',
        boxShadow: focused ? '0 0 0 3px rgba(109,74,224,.1)' : 'none',
      }}
    >
      <Search className="w-[16px] h-[16px] shrink-0" style={{ color: focused ? '#6D4AE0' : '#9a97ab' }} />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search projects, videos, channels…"
        className="border-none outline-none bg-transparent text-sm flex-1 min-w-0 text-[#1E1B2E] placeholder:text-[#9a97ab]"
        style={{ fontFamily: 'inherit' }}
        aria-label="Search"
      />
      {query ? (
        <button
          type="submit"
          aria-label="Search"
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-lg transition-all hover:opacity-80"
          style={{ background: 'linear-gradient(135deg,#a78bfa,#7C3AED)', color: 'white' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      ) : (
        <kbd
          className="shrink-0 text-[11px] font-medium select-none"
          style={{ color: '#c4b0f5' }}
          title="Press Enter to search"
        >
          ⏎
        </kbd>
      )}
    </form>
  );
}

function CreditsBanner() {
  const { creditsExhausted, lowCredits, credits, clearCreditProFlag } = usePlan();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (!creditsExhausted && !lowCredits)) return null;

  if (creditsExhausted) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium" style={{ background: '#fffbeb', borderBottom: '1px solid #fbbf24', color: '#92400e' }}>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 shrink-0 text-amber-500" />
          <span>Your AI credits ran out — <strong>top up to restore Pro access</strong></span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href="/wallet" className="px-3 py-1 rounded-xl text-xs font-bold text-white" style={{ background: '#d97706' }}>
            Top Up →
          </a>
          <button onClick={() => { clearCreditProFlag(); setDismissed(true); }} className="p-1 rounded-lg hover:bg-amber-100 transition-colors" aria-label="Dismiss">
            <X className="w-3.5 h-3.5 text-amber-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium" style={{ background: '#fefce8', borderBottom: '1px solid #fde68a', color: '#854d0e' }}>
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 shrink-0 text-yellow-500" />
        <span>Running low — <strong>{credits?.toLocaleString()} credits</strong> remaining. Top up to keep Pro access.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a href="/wallet" className="px-2.5 py-1 rounded-xl font-bold text-white" style={{ background: '#ca8a04' }}>Top Up</a>
        <button onClick={() => setDismissed(true)} className="p-1 rounded-lg hover:bg-yellow-100 transition-colors" aria-label="Dismiss">
          <X className="w-3 h-3 text-yellow-600" />
        </button>
      </div>
    </div>
  );
}

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('Creator');
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me().then((r) => r.data),
    staleTime: 60_000,
    enabled: !!token,
  });

  /* Desktop sidebar collapsed to icon-only rail */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  /* Mobile drawer overlay open */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set<string>([]));
  function toggleSection(cat: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  /* Close mobile drawer on route change */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  /* Prevent body scroll when mobile drawer is open */
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  function handleHamburger() {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileMenuOpen(c => !c);
    } else {
      setSidebarCollapsed(c => !c);
    }
  }

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    try {
      const res = await api.notifications.list({ take: 20 });
      setNotifications(res.data.items);
      setUnreadCount(res.data.unreadCount);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    const tok = localStorage.getItem('cf_token');
    if (!tok) {
      router.push('/login');
      return;
    }
    setToken(tok);
    setUserName(nameFromToken());
    setIsAdmin(['OWNER', 'SUPER_ADMIN'].includes(roleFromToken()));
    void fetchNotifications();
    pollRef.current = setInterval(() => { void fetchNotifications(); }, BELL_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router, fetchNotifications]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  async function handleMarkRead(id: string) {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Non-fatal
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.notifications.markAllRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      setUnreadCount(0);
    } catch {
      // Non-fatal
    }
  }

  async function handleLogout() {
    const refreshToken = getRefreshToken() ?? undefined;
    try {
      await api.auth.logout(refreshToken);
    } catch {
      // Non-fatal
    }
    clearTokens();
    router.push('/login');
  }

  /* Sidebar nav link renderer (shared by desktop sidebar + mobile drawer) */
  function renderNavSections(opts: { collapsed: boolean; onNavClick?: () => void }) {
    return NAV_SECTIONS.map(({ category, items }, si) => {
      const isCollapsible = !!category && category !== 'Studio';
      const isOpen = !isCollapsible || opts.collapsed || openSections.has(category!);
      return (
        <div key={si} style={{ marginBottom: '4px' }}>
          {category && !opts.collapsed && (
            isCollapsible ? (
              <button
                type="button"
                onClick={() => toggleSection(category)}
                className="flex items-center w-full border-none cursor-pointer"
                style={{
                  gap: '6px', padding: '10px 12px 6px', background: 'transparent',
                  fontSize: '11.5px', fontWeight: 600, letterSpacing: '-.1px',
                  color: 'rgba(255,255,255,.55)', fontFamily: 'inherit', transition: 'color 150ms ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.90)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.55)'; }}
              >
                <span style={{ flex: '1 1 auto', textAlign: 'left' }}>{category}</span>
                <ChevronDown style={{
                  width: '14px', height: '14px', flexShrink: 0,
                  transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 220ms ease',
                }} />
              </button>
            ) : (
              <div style={{
                fontSize: '11.5px', fontWeight: 600, letterSpacing: '-.1px',
                color: 'rgba(255,255,255,.40)', padding: '10px 12px 6px',
              }}>
                {category}
              </div>
            )
          )}
          {isOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {items.map(({ href, icon: Icon, label, badge, action }) => {
                const isActive = !action && (pathname === href || pathname.startsWith(href + '/'));
                const itemStyle: React.CSSProperties = {
                  gap: '11px',
                  padding: opts.collapsed ? '11px 0' : '10px 12px',
                  borderRadius: '11px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: isActive ? '-.15px' : '-.05px',
                  textDecoration: 'none',
                  justifyContent: opts.collapsed ? 'center' : 'flex-start',
                  background: isActive ? 'rgba(255,255,255,.92)' : 'transparent',
                  color: isActive ? '#6D28D9' : 'rgba(255,255,255,.78)',
                  transition: 'background 180ms ease, color 180ms ease',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,.15)' : 'none',
                };
                const inner = (
                  <>
                    <Icon style={{ width: '18px', height: '18px', flexShrink: 0, opacity: isActive ? 1 : 0.78, color: isActive ? '#7C3AED' : 'inherit' }} />
                    {!opts.collapsed && (
                      <>
                        <span style={{ flex: '1 1 auto', whiteSpace: 'nowrap', overflow: 'hidden' }}>{label}</span>
                        {badge && (
                          <span style={{
                            fontSize: '10px', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase',
                            padding: '2px 7px', borderRadius: '99px', flexShrink: 0, color: '#fff',
                            background:
                              badge === 'NEW'  ? 'linear-gradient(135deg,#10B981,#059669)' :
                              badge === 'BETA' ? 'linear-gradient(135deg,#F59E0B,#D97706)' :
                              badge === 'AI'   ? 'rgba(255,255,255,.22)' :
                                                'linear-gradient(135deg,#6366F1,#4F46E5)',
                          }}>
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </>
                );
                const hoverOn  = (e: React.MouseEvent) => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,.13)'; el.style.color = '#fff'; } };
                const hoverOff = (e: React.MouseEvent) => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,.78)'; } };
                return action ? (
                  <button
                    key={href}
                    type="button"
                    title={opts.collapsed ? label : undefined}
                    onClick={() => { action(); opts.onNavClick?.(); }}
                    className="flex items-center w-full border-none cursor-pointer"
                    style={{ ...itemStyle, fontFamily: 'inherit' }}
                    onMouseEnter={hoverOn}
                    onMouseLeave={hoverOff}
                  >
                    {inner}
                  </button>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    title={opts.collapsed ? label : undefined}
                    className="flex items-center"
                    style={itemStyle}
                    onMouseEnter={hoverOn}
                    onMouseLeave={hoverOff}
                    onClick={opts.onNavClick}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className="cf-shell overflow-hidden flex flex-col bg-[#F4F3FB] text-[#1E1B2E]">

      {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 sm:gap-3.5 px-3 sm:px-[22px] py-[11px] bg-white border-b border-[#ECECF3] shrink-0 z-[30]">

        {/* Hamburger */}
        <button
          type="button"
          onClick={handleHamburger}
          className="w-10 h-10 shrink-0 border border-[#ECECF3] rounded-[11px] bg-white text-[#5b5772] flex items-center justify-center hover:bg-[#F6F5FC] active:bg-[#EDE9FD] transition-colors touch-manipulation"
          aria-label="Toggle menu"
        >
          <Menu className="w-[18px] h-[18px]" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <LogoMark className="w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] shrink-0" style={{ borderRadius: '11px', boxShadow: '0 6px 14px -6px rgba(124,58,237,.5)' }} />
          <div className="leading-[1.15] hidden sm:block">
            <div className="font-bold text-[15px] tracking-[-0.3px]">Sozialzync</div>
            <div className="text-[11px] font-medium" style={{ color: '#8b88a0' }}>AI Content Platform</div>
          </div>
          <span className="font-bold text-[15px] tracking-[-0.3px] sm:hidden">Sozialzync</span>
        </div>

        {/* Search bar — hidden on small screens */}
        <GlobalSearch />

        <div className="flex-1" />

        {/* Admin button — hidden on xs to prevent header overflow on narrow phones */}
        {isAdmin && (
          <Link
            href="/admin"
            title="Admin panel"
            className="hidden sm:flex w-[42px] h-[42px] rounded-[12px] items-center justify-center transition-colors shrink-0 touch-manipulation"
            style={{ border: '1px solid #E4DEFB', background: '#F6F2FF', color: '#7C3AED' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EDE9FD'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F6F2FF'; }}
          >
            <ShieldCheck className="w-[18px] h-[18px] sm:w-[19px] sm:h-[19px]" />
          </Link>
        )}

        {/* Copilot button */}
        <button
          type="button"
          title="Ask Copilot"
          onClick={() => window.dispatchEvent(new CustomEvent('cf:open-copilot'))}
          className="w-[40px] h-[40px] sm:w-[42px] sm:h-[42px] rounded-[12px] flex items-center justify-center hover:opacity-90 active:opacity-75 transition-opacity shrink-0 touch-manipulation"
          style={{ border: '1px solid #E4DEFB', background: '#F6F2FF', color: '#7C3AED' }}
        >
          <Bot className="w-[18px] h-[18px] sm:w-[19px] sm:h-[19px]" />
        </button>

        {/* Notification bell */}
        <div className="relative shrink-0" ref={bellRef}>
          <button
            type="button"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            aria-haspopup="true"
            aria-expanded={bellOpen}
            onClick={() => { setBellOpen(o => !o); if (!bellOpen) void fetchNotifications(); }}
            className="w-[40px] h-[40px] sm:w-[42px] sm:h-[42px] rounded-[12px] flex items-center justify-center hover:bg-[#F6F5FC] active:bg-[#EDE9FD] transition-colors relative touch-manipulation"
            style={{ border: '1px solid #ECECF3', background: '#fff', color: '#5b5772' }}
          >
            <Bell className="w-[18px] h-[18px] sm:w-[19px] sm:h-[19px]" />
            {unreadCount > 0 && (
              <span
                className="absolute flex items-center justify-center text-white font-bold leading-none"
                style={{ top: '-6px', right: '-6px', minWidth: '19px', height: '19px', padding: '0 5px', borderRadius: '20px', background: '#EF4444', fontSize: '11px', border: '2px solid #fff' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div
              role="dialog"
              aria-label="Notifications"
              className="notif-panel absolute right-0 z-50 bg-white overflow-hidden animate-drop-down"
              style={{ top: 'calc(100% + 10px)', width: 'min(360px, calc(100vw - 24px))', border: '1px solid #ECECF3', borderRadius: '18px', boxShadow: '0 30px 70px -24px rgba(30,27,46,.4)' }}
            >
              <div className="flex items-center justify-between" style={{ padding: '15px 18px', borderBottom: '1px solid #F1EFF7' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-.3px' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button type="button" onClick={() => void handleMarkAllRead()} className="border-none bg-transparent cursor-pointer" style={{ fontSize: '12.5px', fontWeight: 700, color: '#7C3AED', fontFamily: 'inherit' }}>
                    Mark all read
                  </button>
                )}
              </div>
              <ul style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <li style={{ padding: '36px 20px', textAlign: 'center' }}>
                    <div style={{ width: '46px', height: '46px', margin: '0 auto 12px', borderRadius: '14px', background: '#F3F2F9', color: '#c3c0d2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bell className="w-[22px] h-[22px]" />
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#6b6880' }}>You&apos;re all caught up</div>
                    <div style={{ fontSize: '12.5px', color: '#a8a5b8', fontWeight: 500, marginTop: '2px' }}>No new notifications</div>
                  </li>
                ) : (
                  notifications.map((n) => (
                    <li key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '13px 16px', borderBottom: '1px solid #F6F5FB' }}>
                      <div
                        role="button"
                        tabIndex={0}
                        style={{ flex: '1 1 auto', minWidth: 0, cursor: n.readAt ? 'default' : 'pointer' }}
                        onClick={() => { if (!n.readAt) void handleMarkRead(n.id); }}
                        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !n.readAt) void handleMarkRead(n.id); }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, flex: '1 1 auto' }}>{n.title}</div>
                          <div style={{ fontSize: '11px', color: '#a8a5b8', fontWeight: 600, flexShrink: 0 }}>{relativeTime(n.createdAt)}</div>
                        </div>
                        {n.body && <div style={{ fontSize: '12.5px', color: '#8b88a0', fontWeight: 500, lineHeight: 1.45, marginTop: '2px' }}>{n.body}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => { if (!n.readAt) void handleMarkRead(n.id); setBellOpen(false); }}
                        className="flex items-center justify-center border-none cursor-pointer hover:bg-[#FDECEC] hover:text-[#EF4444] transition-all touch-manipulation"
                        style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '8px', background: 'transparent', color: '#c3c0d2' }}
                        title="Dismiss"
                      >
                        <X className="w-[15px] h-[15px]" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <Link
                href="/notifications"
                onClick={() => setBellOpen(false)}
                className="block w-full text-center text-xs font-semibold hover:bg-[#F6F5FC] active:bg-[#EDE9FD]"
                style={{ padding: '12px', color: '#7C3AED', borderTop: '1px solid #ECECF3' }}
              >
                View all notifications →
              </Link>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative shrink-0" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(o => !o)}
            className="flex items-center gap-2 hover:bg-[#F6F5FC] active:bg-[#EDE9FD] transition-colors cursor-pointer touch-manipulation"
            style={{ background: '#fff', border: '1px solid #ECECF3', borderRadius: '12px', padding: '5px 5px 5px 5px' }}
          >
            {meData?.avatarUrl ? (
              <img src={meData.avatarUrl} alt={meData.name ?? 'Avatar'} style={{ width: '32px', height: '32px', borderRadius: '9px', objectFit: 'cover' }} />
            ) : (
              <div className="flex items-center justify-center text-white font-bold text-sm uppercase" style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'linear-gradient(135deg,#9C88DD,#7E62C9)' }}>
                {(meData?.name ?? userName).charAt(0)}
              </div>
            )}
            {/* Name — shown on sm+ screens */}
            <div className="hidden sm:block max-w-[120px]" style={{ lineHeight: 1.2, textAlign: 'left', paddingRight: '6px' }}>
              <div className="truncate" style={{ fontWeight: 700, fontSize: '13.5px' }}>{meData?.name ?? userName}</div>
              <div style={{ fontSize: '11.5px', color: '#8b88a0', fontWeight: 500 }}>Creator</div>
            </div>
            <ChevronDown className="hidden sm:block w-3.5 h-3.5 shrink-0 mr-2" style={{ color: '#9a97ab', transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
          </button>

          {userMenuOpen && (
            <div
              className="absolute right-0 z-50 bg-white overflow-hidden"
              style={{ top: 'calc(100% + 8px)', width: '220px', border: '1px solid #ECECF3', borderRadius: '16px', boxShadow: '0 20px 50px -12px rgba(30,27,46,.25)' }}
            >
              <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #F1EFF7' }}>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#1E1B2E' }}>{meData?.name ?? userName}</div>
                <div style={{ fontSize: '11.5px', color: '#8b88a0', fontWeight: 500, marginTop: '1px' }}>{meData?.email ?? 'Creator'}</div>
                {(meData?.role === 'SUPER_ADMIN' || meData?.role === 'OWNER') && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', background: meData.role === 'SUPER_ADMIN' ? '#f5f2fd' : '#eff6ff', color: meData.role === 'SUPER_ADMIN' ? '#6D4AE0' : '#1d4ed8', border: `1px solid ${meData.role === 'SUPER_ADMIN' ? '#c4b5fd' : '#bfdbfe'}`, borderRadius: '6px', padding: '2px 7px' }}>
                    <ShieldCheck style={{ width: '10px', height: '10px' }} />
                    {meData.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Owner'}
                  </span>
                )}
              </div>
              <div style={{ padding: '6px' }}>
                {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 transition-colors"
                    style={{ padding: '10px 10px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', color: '#3d3a52' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F6F5FC'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <Icon style={{ width: '16px', height: '16px', flexShrink: 0, color: '#7C3AED', opacity: .85 }} />
                    {label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/admin?tab=users"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 transition-colors"
                    style={{ padding: '10px 10px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', color: '#6D4AE0' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f2fd'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <ShieldCheck style={{ width: '16px', height: '16px', flexShrink: 0, color: '#6D4AE0' }} />
                    Switch / View Account
                  </Link>
                )}
              </div>
              <div style={{ padding: '0 6px 6px', borderTop: '1px solid #F1EFF7', marginTop: '2px', paddingTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); void handleLogout(); }}
                  className="flex items-center gap-2.5 w-full border-none cursor-pointer transition-colors touch-manipulation"
                  style={{ padding: '10px 10px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, background: 'transparent', color: '#ef4444', fontFamily: 'inherit' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <LogOut style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── BODY: sidebar + main ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Mobile backdrop ───────────────────────────────────────────────── */}
        {mobileMenuOpen && (
          <div
            role="button"
            tabIndex={-1}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            style={{ backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
            onClick={() => setMobileMenuOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setMobileMenuOpen(false); }}
            aria-label="Close navigation"
          />
        )}

        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        {/*
          Mobile:  fixed overlay drawer (slides in from left, z-50)
          Desktop: in-flow sidebar (shrink-0, width toggles between 62px/244px)
        */}
        <aside
          className={[
            'flex flex-col overflow-hidden',
            /* Mobile: fixed overlay */
            'fixed inset-y-0 left-0 z-50 w-[280px]',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
            'transition-transform duration-300 ease-in-out',
            /* Desktop: in-flow, width-animated */
            'lg:relative lg:inset-auto lg:z-auto lg:translate-x-0',
            'lg:shrink-0',
            'lg:transition-[width] lg:duration-[320ms] lg:ease-[cubic-bezier(.4,0,.2,1)]',
            sidebarCollapsed ? 'lg:w-[62px]' : 'lg:w-[244px]',
          ].join(' ')}
          style={{
            background: 'linear-gradient(185deg,#7C3AED 0%,#5B21B6 100%)',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          } as React.CSSProperties}
        >
          {/* ── Logo header ── */}
          <div
            className="flex items-center shrink-0"
            style={{
              height: '62px',
              padding: sidebarCollapsed ? '0' : '0 16px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: '11px',
              borderBottom: '1px solid rgba(255,255,255,.10)',
            }}
          >
            <LogoMark className="shrink-0" style={{ width: '34px', height: '34px', borderRadius: '9px', border: '1.5px solid rgba(255,255,255,.28)', boxShadow: '0 3px 10px rgba(0,0,0,.28)' }} />
            {!sidebarCollapsed && (
              <>
                <div style={{ overflow: 'hidden', lineHeight: 1.35, flex: '1 1 auto' }}>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: '#fff', letterSpacing: '-.4px', whiteSpace: 'nowrap' }}>Sozialzync</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.48)', fontWeight: 500, letterSpacing: '.15px', whiteSpace: 'nowrap' }}>AI Content Platform</div>
                </div>
                {/* Close button — only visible on mobile */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl shrink-0 touch-manipulation"
                  style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none' }}
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* ── Nav ── */}
          <nav
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ padding: '10px 10px' }}
          >
            {renderNavSections({
              collapsed: sidebarCollapsed,
              onNavClick: () => setMobileMenuOpen(false),
            })}
          </nav>

          {/* ── Mobile-only bottom links inside drawer ── */}
          <div className="lg:hidden shrink-0 border-t border-white/10 p-3 space-y-1">
            {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                style={{ color: 'rgba(255,255,255,.75)', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.13)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Icon style={{ width: '17px', height: '17px', flexShrink: 0 }} />
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); void handleLogout(); }}
              className="flex items-center gap-3 w-full border-none cursor-pointer px-3 py-2.5 rounded-xl transition-colors touch-manipulation"
              style={{ color: '#fca5a5', fontSize: '14px', fontWeight: 500, background: 'transparent', fontFamily: 'inherit' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(252,165,165,.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <LogOut style={{ width: '17px', height: '17px', flexShrink: 0 }} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN ─────────────────────────────────────────────────────────── */}
        <main className="cf-main-mobile-pad flex-1 overflow-y-auto overflow-x-hidden">
          <CreditsBanner />
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ────────────────────────────────────────────── */}
      <nav
        className="cf-mobile-nav fixed bottom-0 inset-x-0 lg:hidden z-30 bg-white border-t border-[#ECECF3]"
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch h-14">
          {MOBILE_NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors active:bg-[#F6F5FC] touch-manipulation"
                style={{ color: isActive ? '#7C3AED' : '#9a97ab', minHeight: '44px' }}
              >
                <Icon className="w-[21px] h-[21px]" style={{ color: isActive ? '#7C3AED' : '#9a97ab' }} />
                <span className="text-[10px] font-semibold leading-none" style={{ color: isActive ? '#7C3AED' : '#9a97ab' }}>{label}</span>
                {isActive && (
                  <span className="absolute bottom-0 h-0.5 w-8 rounded-full" style={{ background: '#7C3AED' }} />
                )}
              </Link>
            );
          })}
          {/* More — opens drawer */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors active:bg-[#F6F5FC] touch-manipulation border-none"
            style={{ background: 'transparent', minHeight: '44px' }}
            aria-label="Open navigation menu"
          >
            <Menu className="w-[21px] h-[21px]" style={{ color: '#9a97ab' }} />
            <span className="text-[10px] font-semibold leading-none" style={{ color: '#9a97ab' }}>More</span>
          </button>
        </div>
      </nav>

      <CopilotPanel />
    </div>
  );
}
