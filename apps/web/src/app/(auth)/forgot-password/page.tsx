'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { ForgotPasswordShell } from '@/components/auth-shell';

function Input({
  type, placeholder, value, onChange, autoComplete, autoFocus, required,
}: {
  type: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string; autoFocus?: boolean; required?: boolean;
}) {
  return (
    <div
      className="flex items-center rounded-xl transition-all focus-within:ring-2 focus-within:ring-[#6D4AE0]/20 focus-within:border-[#6D4AE0]"
      style={{ border: '1.5px solid #ece8f8', background: '#fff' }}
    >
      <input
        type={type} placeholder={placeholder} value={value} onChange={onChange}
        autoComplete={autoComplete} autoFocus={autoFocus} required={required}
        className="flex-1 min-w-0 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
      />
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

const RESEND_COOLDOWN = 60; // seconds

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer after send
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim() || cooldown > 0) return;
    setLoading(true);
    setError('');
    try {
      await api.auth.forgotPassword(email.trim());
      setSent(true);
      setCooldown(RESEND_COOLDOWN);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429 || status === 400) {
        setError('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ForgotPasswordShell
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[#6D4AE0] font-semibold hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        /* ── Success state ─────────────────────────────────────────── */
        <div className="text-center">
          {/* Envelope animation */}
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
              style={{
                background: 'linear-gradient(135deg, #f0edf9 0%, #e2dbf5 100%)',
                boxShadow: '0 8px 32px rgba(109,74,224,0.18)',
              }}
            >
              📬
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-1">
            We sent a reset link to
          </p>
          <p className="text-[#6D4AE0] font-semibold text-sm mb-6 break-all">{email}</p>

          {/* Tips */}
          <ul className="text-xs text-gray-400 space-y-1 mb-6 text-left">
            {['Check your spam or junk folder', 'Make sure the address is correct', 'Allow a minute for delivery'].map((tip) => (
              <li key={tip} className="flex items-start gap-1.5"><span className="shrink-0">·</span>{tip}</li>
            ))}
          </ul>

          {/* Resend */}
          <button
            type="button"
            onClick={() => { void submit(); }}
            disabled={loading || cooldown > 0}
            className="w-full py-[11px] rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(109,74,224,0.28)',
            }}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Resending…</>
            ) : cooldown > 0 ? (
              <span className="tabular-nums">Resend in {cooldown}s</span>
            ) : (
              <><Send className="w-4 h-4" /> Resend email</>
            )}
          </button>

          {error && <div className="mt-3"><ErrorNote msg={error} /></div>}
        </div>
      ) : (
        /* ── Email form ────────────────────────────────────────────── */
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-gray-900 leading-tight mb-1.5">Forgot your password?</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={(e) => { void submit(e); }} className="space-y-3">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />

            {error && <ErrorNote msg={error} />}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-[11px] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
                boxShadow: '0 4px 16px rgba(109,74,224,0.28)',
              }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
    </ForgotPasswordShell>
  );
}
