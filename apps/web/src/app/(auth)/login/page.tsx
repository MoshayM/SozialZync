'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, KeyRound, Mail, Lock, AtSign } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { api, setTokens, type OAuthProviders, type OAuthProvider } from '@/lib/api';
import { LoginShell, LoginInput, SocialRow, type OAuthProviderName } from '@/components/auth-shell';

const MOCK_MODE = process.env['NEXT_PUBLIC_USE_MOCK'] === 'true';
const MOCK_TOKEN = 'mock-jwt-token-for-testing';
const IS_DEV = process.env['NODE_ENV'] === 'development';
const LAST_ID_KEY = 'sz_last_otp_identifier';
const RESEND_SECS = 30;

type Tab = 'password' | 'otp';
type OtpStep = 'send' | 'verify';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('password');

  // Password fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP fields
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<OtpStep>('send');
  const [maskedEmail, setMaskedEmail] = useState(''); // displayed in verify step

  // Resend countdown
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<OAuthProviders | undefined>(undefined);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const passkeySupported = typeof window !== 'undefined' && typeof PublicKeyCredential !== 'undefined';

  const otpIdentifier = otpEmail.trim();

  // Prefill last-used identifier from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_ID_KEY);
      if (saved && saved.includes('@')) {
        setOtpEmail(saved);
      }
    } catch {
      // localStorage not available (SSR guard)
    }
  }, []);

  useEffect(() => {
    if (MOCK_MODE) return;
    api.auth.providers()
      .then((r) => setProviders(r.data))
      .catch(() => setProviders({ google: false }));
  }, []);

  // Auto-submit OTP when all 6 digits are entered
  const verifyFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (otpCode.length === 6 && otpStep === 'verify' && !loading) {
      verifyFormRef.current?.requestSubmit();
    }
  }, [otpCode, otpStep, loading]);

  // Countdown timer cleanup
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  function startResendCooldown() {
    setResendCooldown(RESEND_SECS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((n) => {
        if (n <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (MOCK_MODE) {
      if (email && password) {
        localStorage.setItem('cf_token', MOCK_TOKEN);
        router.push('/home');
      } else {
        setError('Invalid email or password');
        setLoading(false);
      }
      return;
    }

    try {
      const { data } = await api.auth.login(email, password);
      setTokens(data.accessToken, data.refreshToken);
      router.push('/home');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError('Invalid email or password.');
      } else if (status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else if (!status) {
        setError('Cannot reach the server — check your connection and try again.');
      } else if (status === 502 || status === 503 || status === 504) {
        setError('Server is starting up — please wait a moment and try again.');
      } else if (status >= 500) {
        setError('Server error. Please try again in a moment.');
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSend(e: React.FormEvent) {
    e.preventDefault();
    if (!otpIdentifier) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.auth.otpSend(otpIdentifier, undefined);
      try { localStorage.setItem(LAST_ID_KEY, otpIdentifier); } catch { /* ignore */ }
      setMaskedEmail(data.maskedEmail ?? '');
      setOtpStep('verify');
      setInfo(`Code sent to ${data.maskedEmail ?? otpIdentifier}`);
      startResendCooldown();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) {
        setError('Too many requests. Please wait a few minutes.');
      } else {
        setError('Could not send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.auth.otpVerify(otpIdentifier, otpCode.trim());
      setTokens(data.accessToken, data.refreshToken);
      // New user (no password yet) → prompt to set one; existing user → home
      if (data.hasPassword === false) {
        router.push('/set-password');
      } else {
        router.push('/home');
      }
    } catch {
      setError('Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      await api.auth.otpSend(otpIdentifier, undefined);
      setInfo('New code sent!');
      startResendCooldown();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) {
        setError('Too many requests. Please wait a few minutes.');
      } else {
        setError('Could not resend. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeyLogin() {
    setPasskeyLoading(true);
    setError('');
    try {
      const { data: options } = await api.auth.webauthnAuthOptions();
      const credential = await startAuthentication({ optionsJSON: options });
      const { data } = await api.auth.webauthnAuthVerify(credential);
      setTokens(data.accessToken, data.refreshToken);
      router.push('/home');
    } catch (err: unknown) {
      const message = (err as { name?: string })?.name === 'NotAllowedError'
        ? 'Passkey sign-in was cancelled or not allowed.'
        : 'Passkey sign-in failed. Please try a different method.';
      setError(message);
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function handleSocialLogin(provider: OAuthProviderName) {
    setError('');
    try {
      const redirectUri = `${window.location.origin}/oauth/callback/${provider}`;
      const { data } = await api.auth.oauthStart(provider as OAuthProvider, redirectUri, 'login');
      sessionStorage.setItem('cf.oauth.state', data.state);
      window.location.href = data.authUrl;
    } catch {
      setError(`Could not start ${provider} sign-in. Please try again.`);
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError('');
    setInfo('');
    setOtpStep('send');
    setOtpCode('');
    setMaskedEmail('');
  }

  return (
    <LoginShell
      footer={
        <>
          {tab === 'password' && (
            <>
              Don&rsquo;t have an account?{' '}
              <Link href="/register" className="text-[#6D4AE0] font-semibold hover:underline">
                Create one free
              </Link>
              <br />
            </>
          )}
          <span className="text-xs text-gray-600">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-[#6D4AE0] hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-[#6D4AE0] hover:underline">Privacy Policy</Link>
          </span>
        </>
      }
    >
      {/* ── Tab switcher ────────────────────────────────────────────── */}
      <div className="flex bg-[#f0edf9] rounded-2xl p-1 mb-6">
        <button
          type="button"
          onClick={() => switchTab('password')}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            tab === 'password'
              ? 'bg-white shadow text-[#6D4AE0]'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => switchTab('otp')}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            tab === 'otp'
              ? 'bg-white shadow text-[#6D4AE0]'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Sign in with OTP
        </button>
      </div>

      {/* ── Password tab ─────────────────────────────────────────────── */}
      {tab === 'password' ? (
        <form onSubmit={(e) => { void handlePasswordSubmit(e); }} className="space-y-4">
          <LoginInput
            icon={<AtSign className="w-4 h-4" />}
            label="Email address"
            type="email"
            aria-label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <LoginInput
            icon={<Lock className="w-4 h-4" />}
            label="Password"
            type={showPassword ? 'text' : 'password'}
            aria-label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="p-2 text-gray-600 hover:text-gray-700 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              className="text-xs text-[#6D4AE0] hover:underline font-medium"
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
              <span className="text-red-400 text-sm" aria-hidden>⚠</span>
              <p className="text-red-600 text-xs font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
            style={{
              background: loading ? '#8b74d8' : 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
              boxShadow: '0 4px 20px rgba(109,74,224,0.35)',
            }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        /* ── OTP tab ───────────────────────────────────────────────── */
        <div className="space-y-4">
          {otpStep === 'send' ? (
            <form onSubmit={(e) => { void handleOtpSend(e); }} className="space-y-4">
              <p className="text-xs text-gray-600 text-center">
                Enter your email to receive a one-time sign-in code.
                <br />
                <span className="text-[#6D4AE0]">New here? We'll create your account automatically.</span>
              </p>

              <LoginInput
                icon={<Mail className="w-4 h-4" />}
                type="email"
                aria-label="Email"
                placeholder="you@example.com"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                required
              />

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                  <span className="text-red-400 text-sm" aria-hidden>⚠</span>
                  <p className="text-red-600 text-xs font-medium">{error}</p>
                </div>
              )}

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
                {loading ? 'Sending…' : 'Send Code'}
              </button>
            </form>
          ) : (
            <form ref={verifyFormRef} onSubmit={(e) => { void handleOtpVerify(e); }} className="space-y-4">
              <div className="bg-[#f0edf9] rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-gray-600">
                  Code sent to{' '}
                  <span className="font-semibold text-[#6D4AE0]">
                    {maskedEmail || otpIdentifier}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => { setOtpStep('send'); setError(''); setInfo(''); setOtpCode(''); }}
                  className="text-[10px] text-[#6D4AE0] hover:underline mt-0.5"
                >
                  Change
                </button>
              </div>

              {/* 6-digit OTP input — large and clear */}
              <div className="space-y-1.5">
                <label className="block text-xs text-gray-700 font-medium px-1">
                  Enter 6-digit code
                </label>
                <div
                  className="flex items-center bg-white rounded-2xl transition-all focus-within:ring-2 focus-within:ring-[#6D4AE0]/20 focus-within:border-[#6D4AE0]"
                  style={{ border: '1.5px solid #e3e0f0' }}
                >
                  <div className="pl-4 text-gray-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    aria-label="6-digit OTP"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    className="flex-1 px-3 py-3 text-center text-xl font-bold tracking-[0.35em] outline-none bg-transparent text-gray-800 placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal placeholder:text-base"
                  />
                  {otpCode.length > 0 && (
                    <div className="pr-4 text-xs font-medium" style={{ color: otpCode.length === 6 ? '#22c55e' : '#374151' }}>
                      {otpCode.length}/6
                    </div>
                  )}
                </div>
              </div>

              {info && (
                <div className="flex items-center gap-2 bg-[#f0edf9] border border-[#d4c8f5] rounded-xl px-3.5 py-2.5">
                  <span className="text-[#6D4AE0] text-sm" aria-hidden>✓</span>
                  <p className="text-[#6D4AE0] text-xs font-medium">{info}</p>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                  <span className="text-red-400 text-sm" aria-hidden>⚠</span>
                  <p className="text-red-600 text-xs font-medium">{error}</p>
                </div>
              )}

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
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>

              {/* Resend with countdown */}
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-xs text-gray-600">
                    Resend code in <span className="font-semibold text-[#6D4AE0]">{resendCooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => { void handleResend(); }}
                    disabled={loading}
                    className="text-xs text-[#6D4AE0] hover:underline disabled:opacity-50 py-1"
                  >
                    Didn't receive it? Resend code
                  </button>
                )}
              </div>

              {IS_DEV && (
                <button
                  type="button"
                  disabled={loading}
                  className="w-full text-xs text-amber-500 hover:underline disabled:opacity-50 py-1"
                  onClick={async () => {
                    try {
                      const { data } = await api.auth.otpDevPeek(otpIdentifier);
                      setOtpCode(data.code);
                      setInfo(`[Dev] OTP auto-filled: ${data.code}`);
                    } catch {
                      setError('[Dev] No pending OTP found. Check API console.');
                    }
                  }}
                >
                  [Dev] Auto-fill OTP from server
                </button>
              )}
            </form>
          )}
        </div>
      )}

      {/* ── Social sign-in — password tab only ──────────────────────── */}
      {tab === 'password' && (
        <SocialRow
          providers={providers}
          onProviderClick={(p) => { void handleSocialLogin(p); }}
        />
      )}

      {/* ── Passkey sign-in ──────────────────────────────────────── */}
      {passkeySupported && (
        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400 font-medium">Or</span>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => { void handlePasskeyLogin(); }}
              disabled={passkeyLoading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white rounded-2xl hover:bg-[#f5f2fd] hover:text-[#6D4AE0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ border: '1.5px solid #e3ddf8' }}
            >
              {passkeyLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <KeyRound className="w-4 h-4" />}
              {passkeyLoading ? 'Verifying…' : 'Sign in with Passkey'}
            </button>
          </div>
        </div>
      )}
    </LoginShell>
  );
}
