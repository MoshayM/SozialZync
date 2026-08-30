'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye, EyeOff, Loader2, KeyRound, Fingerprint, ChevronRight,
} from 'lucide-react';
import {
  startAuthentication,
  browserSupportsWebAuthnAutofill,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { api, setTokens } from '@/lib/api';
import { LoginShell, SocialRow } from '@/components/auth-shell';

const MOCK_MODE = process.env['NEXT_PUBLIC_USE_MOCK'] === 'true';
const MOCK_TOKEN = 'mock-jwt-token-for-testing';

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function detectPasskeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Passkey';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'Face ID / Touch ID';
  if (/Macintosh/.test(ua) && !/Chrome/.test(ua)) return 'Touch ID';
  if (/Android/.test(ua)) return 'Fingerprint / device unlock';
  if (/Win/.test(ua)) return 'Windows Hello';
  return 'Device passkey';
}

function Input({
  type, placeholder, value, onChange, autoComplete, autoFocus, required, rightElement,
}: {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center rounded-xl transition-all focus-within:ring-2 focus-within:ring-[#374151]/20 focus-within:border-[#374151]"
      style={{ border: '1.5px solid #e5e7eb', background: '#fff' }}
    >
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required={required}
        className="flex-1 min-w-0 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
      />
      {rightElement && <span className="pr-2 shrink-0">{rightElement}</span>}
    </div>
  );
}

function PrimaryBtn({
  loading, disabled, children, type = 'submit', onClick,
}: {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  type?: 'submit' | 'button';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      onClick={onClick}
      className="w-full py-[11px] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
      style={{
        background: 'linear-gradient(135deg, #374151 0%, #4b5563 100%)',
        boxShadow: '0 4px 16px rgba(55,65,81,0.28)',
      }}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {children}
    </button>
  );
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 bg-red-50 border border-red-100">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
      <p className="text-red-600 text-xs font-medium leading-relaxed">{msg}</p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  // Already logged in — skip login page entirely
  useEffect(() => {
    const tok = typeof window !== 'undefined' ? localStorage.getItem('cf_token') : null;
    if (tok) { router.replace('/home'); return; }

    // Cold-open guard: if the user landed here directly (PWA restore, bookmark,
    // typed URL) with no query context and no in-app referrer, send them to the
    // public feed instead of showing an empty login wall.
    const params = new URLSearchParams(window.location.search);
    const hasContext = params.has('from') || params.has('redirect') || params.has('mode');
    if (!hasContext) {
      try {
        const fromSameOrigin = document.referrer && new URL(document.referrer).origin === window.location.origin;
        if (!fromSameOrigin) router.replace('/browse');
      } catch {
        router.replace('/browse');
      }
    }
  }, [router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyLabel, setPasskeyLabel] = useState('Passkey');
  // Passkey shown on mobile/iOS/Android only — not needed on laptops/desktops
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false);
  const passkeyHandledRef = useRef(false);

  const [googleProviders, setGoogleProviders] = useState<Record<string, boolean>>({});
  useEffect(() => {
    api.auth.providers().then(r => setGoogleProviders(r.data as unknown as Record<string, boolean>)).catch(() => {});
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const redirectUri = `${window.location.origin}/oauth/callback/google`;
      const { data } = await api.auth.oauthStart('google', redirectUri, 'login');
      window.location.href = data.authUrl;
    } catch {
      setError('Could not start Google sign-in. Try again.');
    }
  };

  // Detect device passkey capability — mobile/iOS/Android only, skip on desktop
  useEffect(() => {
    if (typeof PublicKeyCredential === 'undefined') return;
    if (!isMobileDevice()) return;
    setPasskeySupported(true);
    setPasskeyLabel(detectPasskeyLabel());
    platformAuthenticatorIsAvailable().then(setHasPlatformAuth).catch(() => {});
  }, []);

  // Arm browser autofill passkey — mobile only (passkeySupported already guards desktop)
  useEffect(() => {
    if (!passkeySupported) return;
    let cancelled = false;
    async function arm() {
      try {
        const supported = await browserSupportsWebAuthnAutofill();
        if (!supported || cancelled) return;
        const { data: opts } = await api.auth.webauthnAuthOptions();
        if (cancelled) return;
        const cred = await startAuthentication({ optionsJSON: opts, useBrowserAutofill: true });
        if (cancelled || passkeyHandledRef.current) return;
        passkeyHandledRef.current = true;
        const { data } = await api.auth.webauthnAuthVerify(cred);
        setTokens(data.accessToken, data.refreshToken);
        router.push('/home');
      } catch { /* user dismissed autocomplete — normal */ }
    }
    void arm();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passkeySupported]);

  const handlePasskeyLogin = useCallback(async () => {
    if (passkeyHandledRef.current) return;
    setPasskeyLoading(true);
    setError('');
    try {
      const { data: opts } = await api.auth.webauthnAuthOptions();
      const cred = await startAuthentication({ optionsJSON: opts });
      if (passkeyHandledRef.current) return;
      passkeyHandledRef.current = true;
      const { data } = await api.auth.webauthnAuthVerify(cred);
      setTokens(data.accessToken, data.refreshToken);
      router.push('/home');
    } catch (err: unknown) {
      passkeyHandledRef.current = false;
      const name = (err as { name?: string })?.name;
      setError(
        name === 'NotAllowedError'   ? 'Sign-in was cancelled.' :
        name === 'InvalidStateError' ? 'No passkey found on this device. Use your password to sign in, then add a passkey in Settings.' :
        'Passkey sign-in failed. Please try your password.'
      );
    } finally {
      setPasskeyLoading(false);
    }
  }, [router]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (MOCK_MODE) {
      if (email && password) { localStorage.setItem('cf_token', MOCK_TOKEN); router.push('/home'); }
      else { setError('Invalid email or password'); setLoading(false); }
      return;
    }
    try {
      const { data } = await api.auth.login(email, password);
      setTokens(data.accessToken, data.refreshToken);
      router.push('/home');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 400                 ? 'Please enter a valid email and password.' :
        status === 401                 ? 'Incorrect email or password.' :
        status === 429                 ? 'Too many attempts — wait a minute and try again.' :
        !status                        ? 'Cannot reach the server. Check your connection.' :
        status >= 500 && status <= 504 ? 'Server error — try again in a moment.' :
        'Sign in failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginShell
      footer={
        <div className="space-y-2 text-center">
          <div>
            New to Sozialzynk?{' '}
            <Link href="/register" className="text-[#374151] font-semibold hover:underline">
              Create a free account
            </Link>
          </div>
          <div>
            <Link
              href="/browse"
              className="text-xs text-gray-500 hover:text-[#374151] hover:underline transition-colors"
            >
              Browse public feed without signing in →
            </Link>
          </div>
          <div className="text-xs text-gray-400">
            By continuing you agree to our{' '}
            <Link href="/terms" className="hover:underline">Terms</Link>
            {' & '}
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </div>
        </div>
      }
    >
      <div className="space-y-5">

        {/* ── Passkey (primary) ────────────────────────────── */}
        {passkeySupported && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => { void handlePasskeyLogin(); }}
              disabled={passkeyLoading}
              aria-label={`Sign in with ${passkeyLabel}`}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 group text-left"
              style={{
                background: passkeyLoading
                  ? 'linear-gradient(135deg,#1f2937,#374151)'
                  : 'linear-gradient(135deg,#0f172a,#1e293b)',
                boxShadow: '0 4px 20px rgba(13,6,32,0.5)',
              }}
            >
              <span
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.10)' }}
              >
                {passkeyLoading
                  ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                  : hasPlatformAuth
                  ? <Fingerprint className="w-5 h-5 text-white/90" />
                  : <KeyRound className="w-5 h-5 text-white/90" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold leading-tight">
                  {passkeyLoading ? 'Verifying…' : 'Sign in instantly'}
                </div>
                <div className="text-white/50 text-[11px] mt-0.5 truncate">{passkeyLabel}</div>
              </div>
              {!passkeyLoading && (
                <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white/60 transition-colors shrink-0" />
              )}
            </button>

            {/* Passkey hint for users who may not know what it is */}
            {!hasPlatformAuth && (
              <p className="text-[11px] text-center text-gray-400 leading-relaxed">
                No passkey yet? Sign in with your password first, then add one in Settings.
              </p>
            )}
          </div>
        )}

        {/* ── Divider ──────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <span className="flex-1 h-px bg-gray-100" />
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">
            {passkeySupported ? 'or' : 'Sign in'}
          </span>
          <span className="flex-1 h-px bg-gray-100" />
        </div>

        {/* ── Password form (secondary) ─────────────────────── */}
        <form onSubmit={(e) => { void handlePasswordSubmit(e); }} className="space-y-3" noValidate>
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username webauthn"
            autoFocus={!passkeySupported}
            required
          />

          <div className="space-y-1">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-[#374151] hover:underline font-medium py-0.5"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error && <ErrorNote msg={error} />}

          <PrimaryBtn loading={loading} disabled={!email || !password}>
            {loading ? 'Signing in…' : 'Sign in with password'}
          </PrimaryBtn>
        </form>

        {/* ── Google OAuth ──────────────────────────────────── */}
        <SocialRow
          providers={googleProviders}
          onProviderClick={() => { void handleGoogleLogin(); }}
        />

      </div>
    </LoginShell>
  );
}
