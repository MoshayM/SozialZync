'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api, setTokens } from '@/lib/api';
import { RegisterShell } from '@/components/auth-shell';

const MOCK_MODE = process.env['NEXT_PUBLIC_USE_MOCK'] === 'true';
const MOCK_TOKEN = 'mock-jwt-token-for-testing';
const OWNER_EMAIL = 'ethonanpasumvalki@gmail.com';

// ── Primitives ─────────────────────────────────────────────────────────────────

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

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 bg-red-50 border border-red-100">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
      <p className="text-red-600 text-xs font-medium leading-relaxed">{msg}</p>
    </div>
  );
}

// ── Inner page (needs useSearchParams → must be wrapped in Suspense) ───────────

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      if (email === OWNER_EMAIL) {
        setError('That email is already registered. Sign in instead.');
        setLoading(false);
        return;
      }
      localStorage.setItem('cf_token', MOCK_TOKEN);
      router.push('/home');
      return;
    }

    try {
      const { data } = await api.auth.register(email, password, name);
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
      setError(
        status === 409 ? 'That email is already registered. Sign in instead.' :
        status === 429 ? 'Too many attempts — wait a minute and try again.' :
        !status        ? 'Cannot reach the server. Check your connection.' :
        'Registration failed. Please try again.'
      );
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
          <br />
          <span className="text-xs text-gray-400 mt-1 inline-block">
            By signing up you agree to our{' '}
            <Link href="/terms" className="hover:underline">Terms</Link>
            {' & '}
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </span>
        </>
      }
    >
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-3">
        <Input
          type="text"
          placeholder="Full name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />

        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <Input
          type={showPassword ? 'text' : 'password'}
          placeholder="Password — at least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
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

        {error && <ErrorNote msg={error} />}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-[11px] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
          style={{
            background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
            boxShadow: '0 4px 16px rgba(109,74,224,0.28)',
          }}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
          {loading ? 'Creating account…' : 'Create free account'}
        </button>
      </form>

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
