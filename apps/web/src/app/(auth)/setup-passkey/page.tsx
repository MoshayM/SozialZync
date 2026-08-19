'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, KeyRound, Shield, Loader2, ChevronRight, X } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '@/lib/api';

const PERKS = [
  { icon: Fingerprint, text: 'Sign in with fingerprint, Face ID, or PIN — no password to remember' },
  { icon: Shield,      text: 'Phishing-proof — passkeys can\'t be stolen like passwords' },
  { icon: KeyRound,    text: 'Synced across your devices via iCloud Keychain or Google Password Manager' },
];

export default function SetupPasskeyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const passkeySupported = typeof PublicKeyCredential !== 'undefined';

  async function handleSetup() {
    setLoading(true);
    setError('');
    try {
      const { data: options } = await api.auth.webauthnRegisterOptions();
      const credential = await startRegistration({ optionsJSON: options });
      await api.auth.webauthnRegisterVerify(credential, 'My passkey');
      setDone(true);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError') {
        setError('Setup was cancelled. You can add a passkey any time from Settings.');
      } else if (name === 'InvalidStateError') {
        // Already registered — that's fine
        setDone(true);
      } else {
        setError('Could not set up passkey. You can try again in Settings → Sign-in & Security.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'linear-gradient(135deg, #1a0f4a 0%, #2d1b6e 100%)' }}>
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Fingerprint className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white">All set!</h1>
            <p className="text-purple-200 mt-2 text-sm">Your passkey is saved. Next time, sign in with just your fingerprint or face — no password needed.</p>
          </div>
          <button
            onClick={() => router.push('/home')}
            className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ background: '#fff', color: '#2d1b6e' }}
          >
            Continue to Sozialzync <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'linear-gradient(135deg, #1a0f4a 0%, #2d1b6e 100%)' }}>
      <div className="w-full max-w-md space-y-6">

        {/* Skip button */}
        <div className="flex justify-end">
          <button
            onClick={() => router.push('/home')}
            className="flex items-center gap-1.5 text-purple-300 hover:text-white text-sm font-medium transition-colors"
          >
            <X className="w-4 h-4" /> Skip for now
          </button>
        </div>

        {/* Icon */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-5" style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)' }}>
            <Fingerprint className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-tight">
            Sign in faster<br />with a passkey
          </h1>
          <p className="text-purple-200 mt-2 text-sm leading-relaxed">
            Set up a passkey so you can sign in next time with just your fingerprint, face, or device PIN.
          </p>
        </div>

        {/* Perks */}
        <div className="space-y-3">
          {PERKS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.text} className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Icon className="w-5 h-5 text-purple-300 shrink-0 mt-0.5" />
                <p className="text-sm text-purple-100 leading-relaxed">{p.text}</p>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* CTA */}
        {passkeySupported ? (
          <button
            onClick={() => { void handleSetup(); }}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99]"
            style={{ background: '#fff', color: '#2d1b6e', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Fingerprint className="w-5 h-5" />
            )}
            {loading ? 'Setting up…' : 'Set up passkey'}
          </button>
        ) : (
          <div className="rounded-2xl px-4 py-3 text-sm text-center" style={{ background: 'rgba(255,255,255,0.08)', color: '#c4b5fd' }}>
            Passkeys aren&apos;t supported on this browser. You can add one from Settings once you&apos;re on a modern browser.
          </div>
        )}

        <p className="text-center text-[11px] text-purple-400">
          You can add or remove passkeys any time from Settings → Sign-in &amp; Security
        </p>
      </div>
    </div>
  );
}
