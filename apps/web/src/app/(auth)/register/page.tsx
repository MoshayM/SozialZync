'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, AtSign, Lock, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { api, setTokens } from '@/lib/api';
import { RegisterShell, LoginInput } from '@/components/auth-shell';

const MOCK_MODE = process.env['NEXT_PUBLIC_USE_MOCK'] === 'true';
const MOCK_TOKEN = 'mock-jwt-token-for-testing';
const OWNER_EMAIL = 'ethonanpasumvalki@gmail.com';

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) localStorage.setItem('cf.pendingReferralCode', ref);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (MOCK_MODE) {
      if (form.email === OWNER_EMAIL) {
        setError('Email already registered. Please sign in instead.');
        setLoading(false);
        return;
      }
      localStorage.setItem('cf_token', MOCK_TOKEN);
      router.push('/home');
      return;
    }

    try {
      const { data } = await api.auth.register(form.email, form.password, form.name);
      setTokens(data.accessToken, data.refreshToken);
      const pending = localStorage.getItem('cf.pendingReferralCode');
      if (pending) {
        api.referral.redeem(pending).catch(() => {});
        localStorage.removeItem('cf.pendingReferralCode');
      }
      const supportsPasskey = typeof PublicKeyCredential !== 'undefined';
      router.push(supportsPasskey ? '/setup-passkey' : '/home');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError('Email already registered. Please sign in instead.');
      } else if (status === 429) {
        setError('Too many sign-up attempts. Please wait a minute and try again.');
      } else if (!status) {
        setError('Cannot reach the server. Make sure the API is running.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <RegisterShell
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="text-[#6D4AE0] font-semibold hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <LoginInput
          icon={<User className="w-4 h-4" />}
          label="Full name"
          type="text"
          aria-label="Name"
          placeholder="Optional"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />

        <LoginInput
          icon={<AtSign className="w-4 h-4" />}
          label="Email address"
          type="email"
          aria-label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />

        <LoginInput
          icon={<Lock className="w-4 h-4" />}
          label="Password"
          type={showPassword ? 'text' : 'password'}
          aria-label="Password"
          placeholder="Min 8 characters"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />

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
          {loading ? 'Creating account…' : 'Create free account'}
        </button>

        <p className="text-[11px] text-gray-500 text-center leading-relaxed">
          By signing up you agree to our{' '}
          <Link href="/terms" className="text-[#6D4AE0] hover:underline">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="text-[#6D4AE0] hover:underline">Privacy Policy</Link>.
        </p>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#faf9ff] px-3 text-gray-400 font-medium tracking-wide">or</span>
        </div>
      </div>

      {/* No-password sign-up via OTP on login page */}
      <Link
        href="/login"
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:bg-[#f5f2fd] hover:text-[#6D4AE0] active:scale-[0.99]"
        style={{ border: '1.5px solid #e3ddf8', background: '#fff', color: '#374151' }}
      >
        <Mail className="w-4 h-4 shrink-0" />
        Sign up with a one-time code instead
      </Link>
    </RegisterShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  );
}
