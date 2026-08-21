'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Copy, Check, ExternalLink, AlertCircle, Mail } from 'lucide-react';
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
      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
      <p className="text-red-600 text-xs font-medium leading-relaxed">{msg}</p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied]     = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    setNotFound(false);
    setResetUrl(null);
    setEmailSent(false);
    try {
      const { data } = await api.auth.forgotPassword(email.trim());
      if (data.resetUrl === null && !data.emailSent) {
        // Account not found
        setNotFound(true);
      } else if (data.emailSent) {
        setEmailSent(true);
      } else if (data.resetUrl) {
        // SMTP not configured — show link on screen as fallback
        setResetUrl(data.resetUrl);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        setError('Too many requests. Please wait a few minutes and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!resetUrl) return;
    try {
      await navigator.clipboard.writeText(resetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  }

  const backLink = (
    <Link
      href="/login"
      className="inline-flex items-center gap-1.5 text-[#6D4AE0] font-semibold hover:underline"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back to sign in
    </Link>
  );

  /* ── Email sent confirmation ─────────────────────────────────────────────── */
  if (emailSent) {
    return (
      <ForgotPasswordShell footer={backLink}>
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #f0edf9 0%, #e2dbf5 100%)',
                boxShadow: '0 8px 24px rgba(109,74,224,0.18)',
              }}
            >
              <Mail className="w-8 h-8 text-[#6D4AE0]" />
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-1.5">Check your inbox</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            We sent a reset link to{' '}
            <span className="font-semibold text-gray-700">{email}</span>.
          </p>
          <p className="text-gray-400 text-xs mb-6">
            The link is valid for <span className="font-semibold text-gray-600">1 hour</span>.
            Check your spam folder if you don&apos;t see it.
          </p>

          <button
            type="button"
            onClick={() => { setEmailSent(false); setEmail(''); }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: '#f5f3ff', color: '#6D4AE0', border: '1.5px solid #ddd6fe' }}
          >
            Try a different email
          </button>
        </div>
      </ForgotPasswordShell>
    );
  }

  /* ── Fallback: reset link shown on-screen (no SMTP configured) ───────────── */
  if (resetUrl) {
    return (
      <ForgotPasswordShell footer={backLink}>
        <div>
          <div className="flex justify-center mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{
                background: 'linear-gradient(135deg, #f0edf9 0%, #e2dbf5 100%)',
                boxShadow: '0 8px 24px rgba(109,74,224,0.18)',
              }}
            >
              🔑
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-1.5 text-center">Your reset link</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-5 text-center">
            Click the link below or copy it to reset your password.
            Valid for <span className="font-semibold text-gray-700">1 hour</span>.
          </p>

          <div
            className="rounded-xl px-4 py-3 mb-3 break-all"
            style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe' }}
          >
            <a
              href={resetUrl}
              className="text-[#6D4AE0] text-xs font-medium hover:underline"
              style={{ wordBreak: 'break-all' }}
            >
              {resetUrl}
            </a>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
              style={{
                background: copied ? '#16a34a' : 'linear-gradient(135deg,#6D4AE0,#7c5ae8)',
                color: '#fff',
                boxShadow: '0 3px 12px rgba(109,74,224,0.28)',
              }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>

            <a
              href={resetUrl}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
              style={{
                background: '#f5f3ff',
                color: '#6D4AE0',
                border: '1.5px solid #ddd6fe',
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Open link
            </a>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            This link is single-use and expires in 1 hour.
          </p>
        </div>
      </ForgotPasswordShell>
    );
  }

  /* ── Account not found ───────────────────────────────────────────────────── */
  if (notFound) {
    return (
      <ForgotPasswordShell footer={backLink}>
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: '#fef2f2', boxShadow: '0 8px 24px rgba(239,68,68,0.12)' }}
            >
              🔍
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Account not found</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            No account is registered with{' '}
            <span className="font-semibold text-gray-700">{email}</span>.
          </p>
          <p className="text-gray-400 text-xs mb-6">
            Double-check the address or create a new account.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => { setNotFound(false); setEmail(''); }}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(109,74,224,0.28)',
              }}
            >
              Try a different email
            </button>
            <Link
              href="/register"
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: '#f5f3ff', color: '#6D4AE0', border: '1.5px solid #ddd6fe' }}
            >
              Create an account
            </Link>
          </div>
        </div>
      </ForgotPasswordShell>
    );
  }

  /* ── Email form ──────────────────────────────────────────────────────────── */
  return (
    <ForgotPasswordShell footer={backLink}>
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
    </ForgotPasswordShell>
  );
}
