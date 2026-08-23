'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { LoginShell } from '@/components/auth-shell';

function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f97316' };
  if (score <= 3) return { score, label: 'Good', color: '#eab308' };
  if (score <= 4) return { score, label: 'Strong', color: '#22c55e' };
  return { score, label: 'Very strong', color: '#16a34a' };
}

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const strength = getStrength(password);
  const passwordsMatch = password === confirm && password.length > 0;
  const canSubmit = password.length >= 8 && passwordsMatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await api.auth.setPassword(password);
      setDone(true);
      setTimeout(() => router.push('/home'), 2000);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError('Session expired. Please sign in again.');
      } else if (status === 400) {
        setError('Password must be at least 8 characters.');
      } else {
        setError('Could not save password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <LoginShell footer={null}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #374151 0%, #4b5563 100%)' }}
          >
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Password set!</h2>
            <p className="text-sm text-gray-500 mt-1">Taking you to your dashboard…</p>
          </div>
        </div>
      </LoginShell>
    );
  }

  return (
    <LoginShell
      footer={
        <button
          type="button"
          onClick={() => router.push('/home')}
          className="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors"
        >
          Skip for now — I'll use OTP to sign in
        </button>
      }
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-6 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #374151 0%, #4b5563 100%)' }}
        >
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Create a password</h1>
          <p className="text-xs text-gray-400 mt-1 max-w-[260px]">
            Add a password so you can also sign in with your email — no OTP needed next time.
          </p>
        </div>
      </div>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        {/* Password field */}
        <div className="space-y-1.5">
          <label className="block text-xs text-gray-500 font-medium px-1">New password</label>
          <div
            className="flex items-center bg-white rounded-2xl transition-all focus-within:ring-2 focus-within:ring-[#374151]/20 focus-within:border-[#374151]"
            style={{ border: '1.5px solid #e3e0f0' }}
          >
            <div className="pl-4 text-gray-400"><Lock className="w-4 h-4" /></div>
            <input
              type={showPw ? 'text' : 'password'}
              aria-label="New password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="flex-1 px-3 py-3 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="pr-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Strength meter */}
          {password.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background: i <= strength.score ? strength.color : '#e5e7eb',
                    }}
                  />
                ))}
              </div>
              <p className="text-[11px] font-medium px-0.5" style={{ color: strength.color }}>
                {strength.label}
              </p>
            </div>
          )}
        </div>

        {/* Confirm password field */}
        <div className="space-y-1.5">
          <label className="block text-xs text-gray-500 font-medium px-1">Confirm password</label>
          <div
            className="flex items-center bg-white rounded-2xl transition-all focus-within:ring-2 focus-within:ring-[#374151]/20 focus-within:border-[#374151]"
            style={{
              border: `1.5px solid ${confirm.length > 0 ? (passwordsMatch ? '#22c55e' : '#ef4444') : '#e3e0f0'}`,
            }}
          >
            <div className="pl-4 text-gray-400"><Lock className="w-4 h-4" /></div>
            <input
              type={showConfirm ? 'text' : 'password'}
              aria-label="Confirm password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className="flex-1 px-3 py-3 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide' : 'Show'}
              className="pr-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirm.length > 0 && !passwordsMatch && (
            <p className="text-[11px] text-red-500 px-0.5">Passwords don't match</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
            <span className="text-red-400 text-sm" aria-hidden>⚠</span>
            <p className="text-red-600 text-xs font-medium">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-3.5 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
          style={{
            background: canSubmit
              ? 'linear-gradient(135deg, #374151 0%, #4b5563 100%)'
              : '#c4b5f4',
            boxShadow: canSubmit ? '0 4px 20px rgba(55,65,81,0.35)' : 'none',
          }}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </LoginShell>
  );
}
