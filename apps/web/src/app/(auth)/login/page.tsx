'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye, EyeOff, Loader2, KeyRound, Mail, Lock, AtSign,
  Fingerprint, ArrowLeft, CheckCircle2,
} from 'lucide-react';
import {
  startAuthentication,
  browserSupportsWebAuthnAutofill,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { api, setTokens } from '@/lib/api';
import { LoginShell, LoginInput } from '@/components/auth-shell';

const MOCK_MODE = process.env['NEXT_PUBLIC_USE_MOCK'] === 'true';
const MOCK_TOKEN = 'mock-jwt-token-for-testing';
const IS_DEV = process.env['NODE_ENV'] === 'development';
const LAST_OTP_KEY = 'sz_last_otp_identifier';
const RESEND_SECS = 30;

type Mode = 'password' | 'otp-send' | 'otp-verify';

function detectPasskeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Passkey';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'Face ID / Touch ID';
  if (/Macintosh/.test(ua) && !/Chrome/.test(ua)) return 'Touch ID';
  if (/Android/.test(ua)) return 'Fingerprint';
  if (/Win/.test(ua)) return 'Windows Hello';
  return 'Passkey';
}

export default function LoginPage() {
  const router = useRouter();

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('password');

  // ── Password ──────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── OTP ───────────────────────────────────────────────────────────────────
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyFormRef = useRef<HTMLFormElement>(null);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Passkey ───────────────────────────────────────────────────────────────
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyLabel, setPasskeyLabel] = useState('Passkey');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false);
  const passkeyHandledRef = useRef(false);

  const otpIdentifier = otpEmail.trim();

  // ── Passkey detection + conditional UI arm ───────────────────────────────
  useEffect(() => {
    if (typeof PublicKeyCredential === 'undefined') return;
    setPasskeySupported(true);
    setPasskeyLabel(detectPasskeyLabel());
    platformAuthenticatorIsAvailable().then(setHasPlatformAuth).catch(() => {});
  }, []);

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
      } catch { /* user didn't pick from autofill — normal */ }
    }
    void arm();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passkeySupported]);

  // ── Restore last-used OTP email ───────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_OTP_KEY);
      if (saved?.includes('@')) setOtpEmail(saved);
    } catch { /* ignore */ }
  }, []);

  // ── Cooldown cleanup ──────────────────────────────────────────────────────
  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // ── Auto-submit when 6 digits entered ────────────────────────────────────
  useEffect(() => {
    if (otpCode.length === 6 && mode === 'otp-verify' && !loading) {
      verifyFormRef.current?.requestSubmit();
    }
  }, [otpCode, mode, loading]);

  function startResendCooldown() {
    setResendCooldown(RESEND_SECS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(n => {
        if (n <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return n - 1;
      });
    }, 1000);
  }

  function goToOtp() {
    // Carry over email from password form if available
    if (email.trim()) setOtpEmail(email.trim());
    setError(''); setInfo(''); setOtpCode(''); setMaskedEmail('');
    setMode('otp-send');
  }

  function backToPassword() {
    setError(''); setInfo(''); setOtpCode(''); setMaskedEmail('');
    setMode('password');
  }

  // ── Passkey ───────────────────────────────────────────────────────────────
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
        name === 'NotAllowedError'   ? 'Passkey sign-in was cancelled.' :
        name === 'InvalidStateError' ? 'No passkey on this device. Sign in with password, then add one in Settings.' :
        'Passkey sign-in failed. Try another method.'
      );
    } finally {
      setPasskeyLoading(false);
    }
  }, [router]);

  // ── Password ──────────────────────────────────────────────────────────────
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
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
        status === 401              ? 'Invalid email or password.' :
        status === 429              ? 'Too many attempts. Wait a minute and try again.' :
        !status                     ? 'Cannot reach the server — check your connection.' :
        status >= 502 && status <= 504 ? 'Server is starting up — try again in a moment.' :
        status >= 500               ? 'Server error. Please try again.' :
        'Login failed. Check your credentials and try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ── OTP send ──────────────────────────────────────────────────────────────
  async function handleOtpSend(e: React.FormEvent) {
    e.preventDefault();
    if (!otpIdentifier) return;
    setLoading(true); setError('');
    try {
      const { data } = await api.auth.otpSend(otpIdentifier, undefined);
      try { localStorage.setItem(LAST_OTP_KEY, otpIdentifier); } catch { /* ignore */ }
      setMaskedEmail(data.maskedEmail ?? '');
      setInfo(`Code sent to ${data.maskedEmail ?? otpIdentifier}`);
      startResendCooldown();
      setMode('otp-verify');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? 'Too many requests. Wait a few minutes.' : 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── OTP verify ────────────────────────────────────────────────────────────
  async function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length !== 6) return;
    setLoading(true); setError('');
    try {
      const { data } = await api.auth.otpVerify(otpIdentifier, otpCode.trim());
      setTokens(data.accessToken, data.refreshToken);
      router.push(data.hasPassword === false ? '/set-password' : '/home');
    } catch {
      setError('Invalid or expired code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Resend ────────────────────────────────────────────────────────────────
  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    setLoading(true); setError('');
    try {
      await api.auth.otpSend(otpIdentifier, undefined);
      setInfo('New code sent!');
      startResendCooldown();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? 'Too many requests. Wait a few minutes.' : 'Could not resend. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Shared sub-components ─────────────────────────────────────────────────
  function ErrorBanner({ msg }: { msg: string }) {
    return (
      <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
        <span className="text-red-400 text-sm mt-px shrink-0" aria-hidden>⚠</span>
        <p className="text-red-600 text-xs font-medium leading-relaxed">{msg}</p>
      </div>
    );
  }

  function InfoBanner({ msg }: { msg: string }) {
    return (
      <div className="flex items-center gap-2 bg-[#f0edf9] border border-[#d4c8f5] rounded-xl px-3.5 py-2.5">
        <CheckCircle2 className="w-4 h-4 text-[#6D4AE0] shrink-0" />
        <p className="text-[#6D4AE0] text-xs font-medium">{msg}</p>
      </div>
    );
  }

  return (
    <LoginShell
      footer={
        <>
          {mode === 'password' && (
            <>
              Don&rsquo;t have an account?{' '}
              <Link href="/register" className="text-[#6D4AE0] font-semibold hover:underline">
                Create one free
              </Link>
              <br />
            </>
          )}
          <span className="text-xs text-gray-600">
            By continuing you agree to our{' '}
            <Link href="/terms" className="text-[#6D4AE0] hover:underline">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-[#6D4AE0] hover:underline">Privacy Policy</Link>
          </span>
        </>
      }
    >

      {/* ── 1. Passkey — always at top ────────────────────────────────── */}
      {passkeySupported && (
        <>
          <button
            type="button"
            onClick={() => { void handlePasskeyLogin(); }}
            disabled={passkeyLoading}
            aria-label={`Sign in with ${passkeyLabel}`}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: passkeyLoading
                ? 'linear-gradient(135deg,#5b3ab0,#6D4AE0)'
                : 'linear-gradient(135deg,#1a0f4a,#2d1b6e)',
              color: '#fff',
              boxShadow: '0 4px 18px rgba(45,27,110,0.4)',
            }}
          >
            {passkeyLoading
              ? <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              : hasPlatformAuth
              ? <Fingerprint className="w-5 h-5 shrink-0" />
              : <KeyRound className="w-5 h-5 shrink-0" />}
            <span>{passkeyLoading ? 'Verifying…' : `Continue with ${passkeyLabel}`}</span>
          </button>
          <p className="text-center text-[11px] text-gray-400 -mt-1">
            Use fingerprint, face, or device PIN
          </p>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#faf9ff] px-3 text-gray-400 font-medium tracking-wide">
                or sign in with email
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── 2a. Password mode ─────────────────────────────────────────── */}
      {mode === 'password' && (
        <>
          <form onSubmit={(e) => { void handlePasswordSubmit(e); }} className="space-y-4">
            <LoginInput
              icon={<AtSign className="w-4 h-4" />}
              label="Email address"
              type="email"
              aria-label="Email"
              placeholder="you@example.com"
              autoComplete="username webauthn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="space-y-1">
              <LoginInput
                icon={<Lock className="w-4 h-4" />}
                label="Password"
                type={showPassword ? 'text' : 'password'}
                aria-label="Password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-xs text-[#6D4AE0] hover:underline font-medium py-0.5">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && <ErrorBanner msg={error} />}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
                boxShadow: '0 4px 20px rgba(109,74,224,0.35)',
              }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* ── OTP as alternative (where Google used to be) ── */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#faf9ff] px-3 text-gray-400 font-medium tracking-wide">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={goToOtp}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:bg-[#f5f2fd] hover:text-[#6D4AE0] active:scale-[0.99]"
            style={{
              border: '1.5px solid #e3ddf8',
              background: '#fff',
              color: '#374151',
            }}
          >
            <Mail className="w-4 h-4 shrink-0" />
            Sign in with a one-time code
          </button>
        </>
      )}

      {/* ── 2b. OTP — email entry ─────────────────────────────────────── */}
      {mode === 'otp-send' && (
        <div className="space-y-4">
          {/* Back */}
          <button
            type="button"
            onClick={backToPassword}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#6D4AE0] transition-colors font-medium -mt-1"
          >
            <ArrowLeft className="w-4 h-4" /> Use password instead
          </button>

          {/* Explainer */}
          <div className="rounded-2xl px-4 py-3.5 space-y-0.5" style={{ background: '#f5f2fd', border: '1.5px solid #e3ddf8' }}>
            <p className="text-sm font-bold text-gray-900">Sign in without a password</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              We&apos;ll send a 6-digit code to your email. No password needed.
              <span className="block mt-1 text-[#6D4AE0] font-medium">New here? We&apos;ll create your account automatically.</span>
            </p>
          </div>

          <form onSubmit={(e) => { void handleOtpSend(e); }} className="space-y-4">
            <LoginInput
              icon={<Mail className="w-4 h-4" />}
              label="Email address"
              type="email"
              aria-label="Email"
              placeholder="you@example.com"
              autoComplete="username webauthn"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              autoFocus
              required
            />

            {error && <ErrorBanner msg={error} />}

            <button
              type="submit"
              disabled={loading || !otpIdentifier}
              className="w-full py-3.5 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
                boxShadow: '0 4px 20px rgba(109,74,224,0.35)',
              }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
        </div>
      )}

      {/* ── 2c. OTP — code verify ─────────────────────────────────────── */}
      {mode === 'otp-verify' && (
        <div className="space-y-4">
          {/* Header with destination */}
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: '#f0edf9' }}>
              <Mail className="w-6 h-6" style={{ color: '#6D4AE0' }} />
            </div>
            <p className="text-sm font-bold text-gray-900">Check your email</p>
            <p className="text-xs text-gray-600">
              Code sent to{' '}
              <span className="font-semibold text-gray-800">{maskedEmail || otpIdentifier}</span>
            </p>
            <button
              type="button"
              onClick={() => { setMode('otp-send'); setOtpCode(''); setError(''); setInfo(''); }}
              className="text-[11px] text-[#6D4AE0] hover:underline font-medium"
            >
              Wrong address? Change →
            </button>
          </div>

          {/* 6-digit code input */}
          <form ref={verifyFormRef} onSubmit={(e) => { void handleOtpVerify(e); }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600 px-1">Enter 6-digit code</label>
              <div
                className="flex items-center bg-white rounded-2xl transition-all focus-within:ring-2 focus-within:ring-[#6D4AE0]/25 focus-within:border-[#6D4AE0]"
                style={{ border: '1.5px solid #e3ddf8' }}
              >
                <span className="pl-4 text-gray-300">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  aria-label="6-digit sign-in code"
                  placeholder="· · · · · ·"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  className="flex-1 px-3 py-3.5 text-center text-2xl font-bold tracking-[0.4em] outline-none bg-transparent placeholder:font-normal placeholder:tracking-[0.25em] placeholder:text-gray-300 placeholder:text-lg"
                  style={{ color: otpCode.length === 6 ? '#6D4AE0' : '#1a1a2e' }}
                />
                {/* Progress dots */}
                <div className="pr-4 flex gap-1">
                  {[...Array(6)].map((_, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{
                        background: i < otpCode.length
                          ? otpCode.length === 6 ? '#22c55e' : '#6D4AE0'
                          : '#e5e7eb',
                        transform: i < otpCode.length ? 'scale(1.1)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
              {otpCode.length === 6 && (
                <p className="text-[11px] text-center text-green-600 font-medium">✓ Verifying automatically…</p>
              )}
            </div>

            {info && <InfoBanner msg={info} />}
            {error && <ErrorBanner msg={error} />}

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full py-3.5 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
                boxShadow: '0 4px 20px rgba(109,74,224,0.35)',
              }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Verifying…' : 'Verify & sign in'}
            </button>

            {/* Resend */}
            <div className="text-center">
              {resendCooldown > 0 ? (
                <p className="text-xs text-gray-600">
                  Resend available in{' '}
                  <span className="font-bold tabular-nums" style={{ color: '#6D4AE0' }}>{resendCooldown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => { void handleResend(); }}
                  disabled={loading}
                  className="text-xs font-medium text-[#6D4AE0] hover:underline disabled:opacity-50"
                >
                  Didn&apos;t get it? Resend code
                </button>
              )}
            </div>

            {IS_DEV && (
              <button
                type="button"
                disabled={loading}
                className="w-full text-xs text-amber-500 hover:underline disabled:opacity-50 py-0.5"
                onClick={async () => {
                  try {
                    const { data } = await api.auth.otpDevPeek(otpIdentifier);
                    setOtpCode(data.code);
                    setInfo(`[Dev] Auto-filled: ${data.code}`);
                  } catch {
                    setError('[Dev] No pending OTP found.');
                  }
                }}
              >
                [Dev] Auto-fill OTP from server
              </button>
            )}
          </form>

          {/* Back to password */}
          <button
            type="button"
            onClick={backToPassword}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to password sign-in
          </button>
        </div>
      )}

    </LoginShell>
  );
}
