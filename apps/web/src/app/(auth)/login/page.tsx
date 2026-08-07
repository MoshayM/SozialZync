'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye, EyeOff, Loader2, KeyRound, Mail,
  Fingerprint, CheckCircle2, ChevronRight,
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

// ── Shared primitives ──────────────────────────────────────────────────────────

function Input({
  type, placeholder, value, onChange, autoComplete, autoFocus, required,
  rightElement, inputRef,
}: {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  rightElement?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div
      className="flex items-center rounded-xl transition-all focus-within:ring-2 focus-within:ring-[#6D4AE0]/20 focus-within:border-[#6D4AE0]"
      style={{ border: '1.5px solid #ece8f8', background: '#fff' }}
    >
      <input
        ref={inputRef}
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('password');

  // password mode
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // otp mode
  const [otpEmail, setOtpEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpBoxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifyFormRef = useRef<HTMLFormElement>(null);

  // shared
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // passkey
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyLabel, setPasskeyLabel] = useState('Passkey');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false);
  const passkeyHandledRef = useRef(false);

  const otpIdentifier = otpEmail.trim();
  const otpCode = otpDigits.join('');

  // ── Effects ──────────────────────────────────────────────────────────────────

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
      } catch { /* user dismissed autocomplete — normal */ }
    }
    void arm();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passkeySupported]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_OTP_KEY);
      if (saved?.includes('@')) setOtpEmail(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (otpCode.length === 6 && mode === 'otp-verify' && !loading) {
      verifyFormRef.current?.requestSubmit();
    }
  }, [otpCode, mode, loading]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

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
    if (email.trim()) setOtpEmail(email.trim());
    setError(''); setInfo(''); setOtpDigits(['', '', '', '', '', '']); setMaskedEmail('');
    setMode('otp-send');
  }

  function backToPassword() {
    setError(''); setInfo(''); setOtpDigits(['', '', '', '', '', '']); setMaskedEmail('');
    setMode('password');
  }

  // ── OTP box handlers ─────────────────────────────────────────────────────────

  function handleOtpBoxChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpBoxRefs.current[index + 1]?.focus();
  }

  function handleOtpBoxKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpBoxRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) otpBoxRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpBoxRefs.current[index + 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text.length) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, i) => text[i] ?? '');
    setOtpDigits(next);
    const focusIdx = Math.min(text.length, 5);
    setTimeout(() => otpBoxRefs.current[focusIdx]?.focus(), 0);
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

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
        name === 'InvalidStateError' ? 'No passkey on this device. Sign in with password, then add one in Settings.' :
        'Passkey sign-in failed. Try another method.'
      );
    } finally {
      setPasskeyLoading(false);
    }
  }, [router]);

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
        status === 401              ? 'Incorrect email or password.' :
        status === 429              ? 'Too many attempts — wait a minute and try again.' :
        !status                     ? 'Cannot reach the server. Check your connection.' :
        status >= 502 && status <= 504 ? 'Server is starting up — try again in a moment.' :
        'Sign in failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

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
      setError(status === 400 ? 'Too many requests — wait a few minutes.' : 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.length !== 6) return;
    setLoading(true); setError('');
    try {
      const { data } = await api.auth.otpVerify(otpIdentifier, otpCode);
      setTokens(data.accessToken, data.refreshToken);
      router.push(data.hasPassword === false ? '/set-password' : '/home');
    } catch {
      setError('Incorrect or expired code. Try again.');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpBoxRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    setLoading(true); setError(''); setInfo('');
    try {
      await api.auth.otpSend(otpIdentifier, undefined);
      setInfo('New code sent!');
      startResendCooldown();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? 'Too many requests — wait a few minutes.' : 'Could not resend. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <LoginShell
      footer={
        <>
          {mode === 'password' && (
            <span>
              New to AI CreatorForce?{' '}
              <Link href="/register" className="text-[#6D4AE0] font-semibold hover:underline">
                Create a free account
              </Link>
            </span>
          )}
          {mode !== 'password' && <span className="text-transparent select-none">·</span>}
          <br />
          <span className="text-xs text-gray-400 mt-1 inline-block">
            By continuing you agree to our{' '}
            <Link href="/terms" className="hover:underline">Terms</Link>
            {' & '}
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </span>
        </>
      }
    >

      {/* ════════════════════════════════════════════════════════════
          PASSWORD MODE
          ════════════════════════════════════════════════════════════ */}
      {mode === 'password' && (
        <div className="space-y-4">

          {/* Passkey — primary when available */}
          {passkeySupported && (
            <button
              type="button"
              onClick={() => { void handlePasskeyLogin(); }}
              disabled={passkeyLoading}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 group text-left"
              style={{
                background: passkeyLoading
                  ? 'linear-gradient(135deg,#5b3ab0,#6D4AE0)'
                  : 'linear-gradient(135deg,#0d0620,#1c0e5a)',
                boxShadow: '0 4px 18px rgba(13,6,32,0.5)',
              }}
            >
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.10)' }}
              >
                {passkeyLoading
                  ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                  : hasPlatformAuth
                  ? <Fingerprint className="w-[18px] h-[18px] text-white/90" />
                  : <KeyRound className="w-[18px] h-[18px] text-white/90" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold">
                  {passkeyLoading ? 'Verifying…' : 'Sign in instantly'}
                </div>
                <div className="text-white/45 text-[11px] truncate">{passkeyLabel}</div>
              </div>
              {!passkeyLoading && (
                <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white/55 transition-colors shrink-0" />
              )}
            </button>
          )}

          {/* Divider */}
          {passkeySupported && (
            <div className="flex items-center gap-3">
              <span className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">or</span>
              <span className="flex-1 h-px bg-gray-100" />
            </div>
          )}

          {/* Email + password form */}
          <form onSubmit={(e) => { void handlePasswordSubmit(e); }} className="space-y-3">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username webauthn"
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
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
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

            <PrimaryBtn loading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </PrimaryBtn>
          </form>

          {/* OTP — secondary option, link-style */}
          <button
            type="button"
            onClick={goToOtp}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#6D4AE0] transition-colors py-1 font-medium"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            Use email code instead
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          OTP — EMAIL ENTRY
          ════════════════════════════════════════════════════════════ */}
      {mode === 'otp-send' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Get a sign-in code</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              We&apos;ll email you a 6-digit code. No password needed.
            </p>
          </div>

          <form onSubmit={(e) => { void handleOtpSend(e); }} className="space-y-3">
            <Input
              type="email"
              placeholder="your@email.com"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              autoComplete="username webauthn"
              autoFocus
              required
            />
            {error && <ErrorNote msg={error} />}
            <PrimaryBtn loading={loading} disabled={!otpIdentifier}>
              {loading ? 'Sending…' : 'Send code →'}
            </PrimaryBtn>
          </form>

          <button
            type="button"
            onClick={backToPassword}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-0.5"
          >
            ← Use password instead
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          OTP — CODE VERIFY
          ════════════════════════════════════════════════════════════ */}
      {mode === 'otp-verify' && (
        <div className="space-y-5">

          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="text-lg font-bold text-gray-900">Check your email</h3>
              <button
                type="button"
                onClick={() => {
                  setMode('otp-send');
                  setOtpDigits(['', '', '', '', '', '']);
                  setError('');
                  setInfo('');
                }}
                className="text-xs text-[#6D4AE0] hover:underline font-medium"
              >
                Change email
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Code sent to{' '}
              <span className="font-semibold text-gray-700">{maskedEmail || otpIdentifier}</span>
            </p>
          </div>

          {info && (
            <div className="flex items-center gap-2 text-xs text-[#6D4AE0] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {info}
            </div>
          )}

          {/* 6 individual digit boxes */}
          <form ref={verifyFormRef} onSubmit={(e) => { void handleOtpVerify(e); }}>
            <div
              className="grid grid-cols-6 gap-2"
              onPaste={handleOtpPaste}
            >
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpBoxRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={digit}
                  onChange={(e) => handleOtpBoxChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpBoxKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  autoFocus={i === 0}
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${i + 1} of 6`}
                  className="aspect-square text-center text-xl font-bold rounded-xl transition-all outline-none focus:ring-2 focus:ring-[#6D4AE0]/25"
                  style={{
                    border: `1.5px solid ${digit ? '#6D4AE0' : '#ece8f8'}`,
                    background: digit ? '#f5f2fd' : '#fff',
                    color: digit ? '#5a35c0' : '#1a1a2e',
                  }}
                />
              ))}
            </div>

            {otpCode.length === 6 && !loading && (
              <p className="text-[11px] text-center text-emerald-600 font-medium mt-2.5">
                Verifying automatically…
              </p>
            )}
            {error && <div className="mt-3"><ErrorNote msg={error} /></div>}

            <div className="mt-4">
              <PrimaryBtn loading={loading} disabled={otpCode.length !== 6}>
                {loading ? 'Verifying…' : 'Verify & sign in'}
              </PrimaryBtn>
            </div>
          </form>

          {/* Resend */}
          <div className="text-center">
            {resendCooldown > 0 ? (
              <p className="text-xs text-gray-500">
                Resend in{' '}
                <span className="font-bold tabular-nums" style={{ color: '#6D4AE0' }}>
                  {resendCooldown}s
                </span>
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

          <button
            type="button"
            onClick={backToPassword}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-0.5"
          >
            ← Back to password
          </button>

          {IS_DEV && (
            <button
              type="button"
              disabled={loading}
              className="w-full text-xs text-amber-500 hover:underline disabled:opacity-50 py-0.5"
              onClick={async () => {
                try {
                  const { data } = await api.auth.otpDevPeek(otpIdentifier);
                  setOtpDigits(Array.from({ length: 6 }, (_, i) => data.code[i] ?? ''));
                  setInfo(`[Dev] Auto-filled: ${data.code}`);
                } catch {
                  setError('[Dev] No pending OTP found.');
                }
              }}
            >
              [Dev] Auto-fill OTP from server
            </button>
          )}
        </div>
      )}

    </LoginShell>
  );
}
