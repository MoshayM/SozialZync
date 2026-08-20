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
import { LoginShell } from '@/components/auth-shell';

const MOCK_MODE = process.env['NEXT_PUBLIC_USE_MOCK'] === 'true';
const MOCK_TOKEN = 'mock-jwt-token-for-testing';

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
      className="flex items-center rounded-xl transition-all focus-within:ring-2 focus-within:ring-[#6D4AE0]/20 focus-within:border-[#6D4AE0]"
      style={{ border: '1.5px solid #ece8f8', background: '#fff' }}
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
        background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
        boxShadow: '0 4px 16px rgba(109,74,224,0.28)',
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyLabel, setPasskeyLabel] = useState('Passkey');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false);
  const passkeyHandledRef = useRef(false);

  // Detect device passkey capability
  useEffect(() => {
    if (typeof PublicKeyCredential === 'undefined') return;
    setPasskeySupported(true);
    setPasskeyLabel(detectPasskeyLabel());
    platformAuthenticatorIsAvailable().then(setHasPlatformAuth).catch(() => {});
  }, []);

  // Arm browser autofill passkey (triggers when user taps the autocomplete suggestion)
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
        status === 401                 ? 'Incorrect email or password.' :
        status === 429                 ? 'Too many attempts — wait a minute and try again.' :
        !status                        ? 'Cannot reach the server. Check your connection.' :
        status >= 502 && status <= 504 ? 'Server is starting up — try again in a moment.' :
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
            New to Sozialzync?{' '}
            <Link href="/register" className="text-[#6D4AE0] font-semibold hover:underline">
              Create a free account
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
                  ? 'linear-gradient(135deg,#5b3ab0,#6D4AE0)'
                  : 'linear-gradient(135deg,#0d0620,#1c0e5a)',
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
                className="text-xs text-[#6D4AE0] hover:underline font-medium py-0.5"
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

      </div>
    </LoginShell>
  );
}
