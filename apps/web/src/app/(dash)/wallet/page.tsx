'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, AlertTriangle, CheckCircle, Copy,
  DollarSign, ExternalLink, Gift, Loader2, Share2, Trophy,
  Users, X, Crown, Sparkles,
} from 'lucide-react';
import { api, apiClient, type ReferralEarnings, type LeaderboardEntry } from '@/lib/api';
import { getErrorMessage } from '@/lib/getErrorMessage';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtCredits(n: number | undefined | null) {
  return (n ?? 0).toLocaleString();
}

function statusChipStyle(s: string): string {
  switch (s) {
    case 'ACTIVE': return 'bg-[#ecfdf5] text-[#065f46]';
    case 'EXPIRED': return 'bg-red-50 text-red-700 border-red-200';
    case 'CONVERTED': return 'bg-[#f3f4f6] text-[#374151]';
    case 'PENDING_REVIEW': return 'bg-[#fff7ed] text-[#c2410c]';
    case 'REVOKED': return 'bg-[#f3f4f6] text-[#4b5563]';
    case 'PENDING': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'QUALIFIED': return 'bg-[#ecfdf5] text-[#065f46]';
    case 'REWARDED': return 'bg-[#f3f4f6] text-[#374151]';
    case 'FLAGGED': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-[#f3f4f6] text-[#4b5563]';
  }
}

// ── Referral Center ──────────────────────────────────────────────────────────

function ReferralCenter() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: earnings, isLoading: earningsLoading } = useQuery<ReferralEarnings>({
    queryKey: ['referral-earnings'],
    queryFn: () => api.referral.earnings().then((r) => r.data),
  });

  const { data: leaderboard = [], isLoading: lbLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['referral-leaderboard'],
    queryFn: () => api.referral.leaderboard().then((r) => r.data),
  });

  const { data: codeData, isLoading: codeLoading } = useQuery<{ code: string }>({
    queryKey: ['referral-code'],
    queryFn: () => api.referral.code().then((r) => r.data),
  });

  useEffect(() => {
    const pending = localStorage.getItem('cf.pendingReferralCode');
    if (pending) setRedeemInput(pending);
  }, []);

  const redeemMutation = useMutation({
    mutationFn: (code: string) => api.referral.redeem(code),
    onSuccess: () => {
      setRedeemSuccess(true);
      setRedeemError('');
      localStorage.removeItem('cf.pendingReferralCode');
      void qc.invalidateQueries({ queryKey: ['referral-earnings'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setRedeemError(msg ?? getErrorMessage(err) ?? 'Redemption failed');
    },
  });

  const shareUrl = codeData
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${codeData.code}`
    : '';

  async function copyCode(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (inputRef.current) inputRef.current.select();
    }
  }

  const shareMsg = encodeURIComponent('Join me on Sozialzynk — the best AI platform for YouTube creators! Use my referral link:');
  const twitterUrl = codeData ? `https://twitter.com/intent/tweet?text=${shareMsg}&url=${encodeURIComponent(shareUrl)}` : '#';
  const linkedInUrl = codeData ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}` : '#';
  const whatsAppUrl = codeData ? `https://wa.me/?text=${shareMsg}%20${encodeURIComponent(shareUrl)}` : '#';

  return (
    <div className="space-y-4">
      {/* Share card */}
      <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#374151]" />
          <span className="text-sm font-semibold text-gray-800">Referral Center</span>
        </div>

        {codeLoading && <Loader2 className="w-5 h-5 animate-spin text-[#374151]" />}

        {codeData && (
          <>
            <div className="space-y-2">
              <p className="text-xs text-gray-600">Your referral code</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tracking-widest text-[#374151] font-mono">{codeData.code}</span>
                <button
                  onClick={() => void copyCode(codeData.code)}
                  aria-label="Copy referral code"
                  className="p-1.5 rounded-2xl text-gray-500 hover:text-[#374151] transition-colors"
                  style={{ border: '1.5px solid #e3ddf8' }}
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-600">Share link</p>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 text-xs rounded-2xl px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
                <button
                  onClick={() => void copyCode(shareUrl)}
                  aria-label="Copy share link"
                  className="px-3 py-2 rounded-2xl text-gray-600 hover:text-[#374151] transition-colors text-xs font-semibold"
                  style={{ border: '1.5px solid #e3ddf8' }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-600">Share via:</span>
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-black text-white hover:bg-gray-800 transition-colors">
                <Share2 className="w-3 h-3" /> X / Twitter
              </a>
              <a href={linkedInUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-700 text-white hover:bg-blue-800 transition-colors">
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
              <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-green-600 text-white hover:bg-green-700 transition-colors">
                <Share2 className="w-3 h-3" /> WhatsApp
              </a>
            </div>
          </>
        )}

        {earningsLoading && <Loader2 className="w-4 h-4 animate-spin text-[#374151]" />}
        {earnings && (
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col bg-gray-50 rounded-2xl px-3 py-2 min-w-[80px]">
              <span className="text-xs text-gray-600">Total earned</span>
              <span className="text-lg font-bold text-gray-800">{fmtCredits(earnings.totalCredits)}</span>
              <span className="text-[10px] text-gray-600">credits</span>
            </div>
            <div className="flex flex-col bg-[#ecfdf5] rounded-2xl px-3 py-2 min-w-[80px]">
              <span className="text-xs text-gray-600">Qualified</span>
              <span className="text-lg font-bold text-[#065f46]">{earnings.qualifiedCount}</span>
            </div>
            <div className="flex flex-col bg-yellow-50 rounded-2xl px-3 py-2 min-w-[80px]">
              <span className="text-xs text-gray-600">Pending</span>
              <span className="text-lg font-bold text-yellow-700">{earnings.pendingCount}</span>
            </div>
            {earnings.flaggedCount > 0 && (
              <div className="flex flex-col bg-red-50 rounded-2xl px-3 py-2 min-w-[80px]">
                <span className="text-xs text-gray-600">Under review</span>
                <span className="text-lg font-bold text-red-600">{earnings.flaggedCount}</span>
              </div>
            )}
          </div>
        )}

        {earnings && earnings.referrals.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-gray-700">
              <thead>
                <tr className="text-gray-600 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Date</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-right pb-2 font-medium">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {earnings.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 text-gray-600">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="py-1.5">
                      <span className={`border rounded-full px-2 py-0.5 text-[10px] font-medium ${statusChipStyle(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-semibold text-green-700">+{fmtCredits(r.reward)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Redeem code */}
      <div className="bg-white rounded-2xl p-5 space-y-3" style={{ border: '1.5px solid #e3ddf8' }}>
        <p className="text-sm font-semibold text-gray-800">Have a referral code?</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => { setRedeemInput(e.target.value); setRedeemError(''); setRedeemSuccess(false); }}
            placeholder="Enter code"
            aria-label="Referral code input"
            className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20"
            style={{ border: '1.5px solid #e3e0f0' }}
          />
          <button
            onClick={() => { if (redeemInput.trim()) redeemMutation.mutate(redeemInput.trim()); }}
            disabled={!redeemInput.trim() || redeemMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl font-bold text-white text-sm disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(55,65,81,0.35)' }}
          >
            {redeemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Apply
          </button>
        </div>
        {redeemError && (
          <p className="text-xs text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {redeemError}
          </p>
        )}
        {redeemSuccess && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            Referral code applied successfully!
          </p>
        )}
      </div>

      {/* Leaderboard */}
      {!lbLoading && leaderboard.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-gray-800">Referral Leaderboard</span>
            <span className="text-xs text-gray-500">(top 10)</span>
          </div>
          <div className="divide-y divide-gray-50">
            {leaderboard.slice(0, 10).map((entry) => (
              <div key={entry.rank} className={`flex items-center gap-3 px-5 py-2.5 ${entry.userLabel.includes('(you)') ? 'bg-[#f3f4f6]' : ''}`}>
                <span className={`text-sm font-bold w-6 text-center ${entry.rank <= 3 ? 'text-amber-500' : 'text-gray-500'}`}>
                  {entry.rank}
                </span>
                <span className="flex-1 text-sm text-gray-700 truncate">{entry.userLabel}</span>
                <div className="text-right text-xs text-gray-600">
                  <p className="font-semibold text-gray-800">{entry.qualifiedCount} referred</p>
                  <p>{fmtCredits(entry.totalCredits)} credits</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ad Revenue / Withdraw Tab ────────────────────────────────────────────────

interface WithdrawHistoryItem {
  id: string;
  creditsRequested: number;
  creatorAmountUsd: number;
  platformFeeUsd: number;
  status: string;
  payoutEmail: string | null;
  createdAt: string;
}

interface WithdrawPageData {
  withdrawals: WithdrawHistoryItem[];
  availableBonusCredits: number;
  withdrawnCredits: number;
  rates: {
    creditsPerUsd: number;
    platformFeePct: number;
    minWithdrawalCredits: number;
    minWithdrawalUsd: number;
  };
}

const W_STATUS_STYLES: Record<string, React.CSSProperties> = {
  PENDING:    { background: '#fffbeb', color: '#b45309' },
  APPROVED:   { background: '#eff6ff', color: '#1d4ed8' },
  PROCESSING: { background: '#eff6ff', color: '#1d4ed8' },
  PAID:       { background: '#ecfdf5', color: '#065f46' },
  REJECTED:   { background: '#fef2f2', color: '#b91c1c' },
};

interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  accountId: string | null;
}

function WithdrawTab() {
  const [data, setData] = useState<WithdrawPageData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [credits, setCredits] = useState('');
  const [payoutEmail, setPayoutEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  async function loadData() {
    setDataLoading(true);
    try {
      const [withdrawRes, connectRes] = await Promise.allSettled([
        apiClient.get<WithdrawPageData>('/wallet/withdrawals'),
        apiClient.get<ConnectStatus>('/billing/connect/status'),
      ]);
      if (withdrawRes.status === 'fulfilled') setData(withdrawRes.value.data);
      if (connectRes.status === 'fulfilled') setConnectStatus(connectRes.value.data);
    } catch { /* non-fatal */ }
    finally { setDataLoading(false); }
  }

  async function startConnectOnboarding() {
    setConnectLoading(true);
    try {
      const returnUrl = `${window.location.origin}/wallet?tab=withdraw&connect=return`;
      const res = await apiClient.post<{ url: string }>('/billing/connect/onboard', { returnUrl });
      window.location.href = res.data.url;
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setSubmitError(ax.response?.data?.message ?? 'Could not start payout setup. Please try again.');
    } finally {
      setConnectLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const rates = data?.rates;
  const creditsNum = parseInt(credits, 10) || 0;
  const canEstimate = !!rates && creditsNum >= rates.minWithdrawalCredits;
  const platformFeeCredits = canEstimate ? Math.floor(creditsNum * (rates!.platformFeePct / 100)) : 0;
  const creatorCredits = creditsNum - platformFeeCredits;
  const amountUsd = rates ? creditsNum / rates.creditsPerUsd : 0;
  const platformFeeUsd = rates ? platformFeeCredits / rates.creditsPerUsd : 0;
  const creatorAmountUsd = rates ? creatorCredits / rates.creditsPerUsd : 0;
  const insufficientBalance = data != null && creditsNum > 0 && creditsNum > data.availableBonusCredits;

  async function submit() {
    if (!canEstimate || insufficientBalance) return;
    setSubmitting(true);
    setSubmitError('');
    setSuccess('');
    try {
      await apiClient.post('/wallet/withdraw', { credits: creditsNum, payoutEmail: payoutEmail || undefined });
      setSuccess('Withdrawal request submitted! An admin will review within 1–3 business days.');
      setCredits('');
      setPayoutEmail('');
      await loadData();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setSubmitError(ax.response?.data?.message ?? 'Withdrawal failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#374151' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Balance card */}
      <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(145deg, #4f2ec4 0%, #374151 55%, #7c5ae8 100%)', boxShadow: '0 20px 50px -10px rgba(55,65,81,.45)' }}>
        <div className="p-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Available', value: (data?.availableBonusCredits ?? 0).toLocaleString(), sub: 'ad revenue credits' },
            { label: 'Withdrawn', value: (data?.withdrawnCredits ?? 0).toLocaleString(), sub: 'total credits' },
            { label: 'Rate', value: `$${rates ? (1 / rates.creditsPerUsd).toFixed(2) : '—'}`, sub: 'per credit' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="text-center">
              <p className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-2xl font-extrabold text-white tabular-nums leading-none">{value}</p>
              <p className="text-[10px] text-white/60 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
        <div className="px-6 py-2 flex items-center gap-2" style={{ background: 'rgba(0,0,0,.18)', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <DollarSign className="w-3.5 h-3.5 text-white/60" />
          <p className="text-[11px] text-white/70">
            Earn ad revenue by enabling monetisation on your projects in the Browse page
          </p>
        </div>
      </div>

      {/* Stripe Connect payout account */}
      {connectStatus && (
        connectStatus.chargesEnabled ? (
          <div className="flex items-center gap-3 rounded-2xl px-5 py-3" style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7' }}>
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">Payout account connected</p>
              <p className="text-xs text-emerald-700 mt-0.5">Payouts sent directly to your bank via Stripe when approved.</p>
            </div>
          </div>
        ) : connectStatus.connected ? (
          <div className="flex items-center gap-3 rounded-2xl px-5 py-3" style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Payout account verification pending</p>
              <p className="text-xs text-amber-700 mt-0.5">Complete Stripe verification to enable automatic payouts.</p>
            </div>
            <button
              type="button"
              onClick={() => void startConnectOnboarding()}
              disabled={connectLoading}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors"
            >
              {connectLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
              Continue setup
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl px-5 py-4" style={{ background: '#f3f4f6', border: '1.5px solid #e3ddf8' }}>
            <DollarSign className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">Set up automatic payouts</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Connect your bank account via Stripe to receive automatic payouts when approved. Takes about 2 minutes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void startConnectOnboarding()}
              disabled={connectLoading}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}
            >
              {connectLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
              Connect bank
            </button>
          </div>
        )
      )}

      {/* Withdrawal form */}
      <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4" style={{ color: '#374151' }} />
          <span className="text-sm font-semibold text-gray-800">Request Withdrawal</span>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">
            Credits to withdraw {rates ? `(min ${rates.minWithdrawalCredits.toLocaleString()})` : ''}
          </label>
          <input
            type="number"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            min={rates?.minWithdrawalCredits ?? 1000}
            step={100}
            placeholder={`e.g. ${rates?.minWithdrawalCredits ?? 1000}`}
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#374151]/20"
            style={{ border: '1.5px solid #e3e0f0' }}
          />
          {insufficientBalance && (
            <p className="text-xs text-red-500 mt-1">
              Insufficient balance — you have {data!.availableBonusCredits.toLocaleString()} credits available.
            </p>
          )}
        </div>

        {canEstimate && (
          <div className="rounded-xl px-4 py-3 space-y-1.5" style={{ background: '#f3f4f6', border: '1.5px solid #e3ddf8' }}>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">You withdraw</span>
              <span className="font-semibold text-gray-800">{creditsNum.toLocaleString()} cr = ${amountUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Platform fee ({rates!.platformFeePct}%)</span>
              <span className="font-semibold text-red-600">−{platformFeeCredits.toLocaleString()} cr = ${platformFeeUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5">
              <span className="font-bold text-gray-900">You receive</span>
              <span className="font-extrabold text-green-700">{creatorCredits.toLocaleString()} cr = ${creatorAmountUsd.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">
            Payout email {connectStatus?.chargesEnabled ? '(optional — Stripe Connect is set up)' : '(PayPal or bank transfer)'}
          </label>
          <input
            type="email"
            value={payoutEmail}
            onChange={(e) => setPayoutEmail(e.target.value)}
            placeholder="your@paypal.com"
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#374151]/20"
            style={{ border: '1.5px solid #e3e0f0' }}
          />
        </div>

        {success && (
          <div className="flex items-start gap-2 rounded-2xl px-4 py-3" style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7' }}>
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800">{success}</p>
          </div>
        )}
        {submitError && (
          <div className="flex items-start gap-2 rounded-2xl px-4 py-3" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !canEstimate || insufficientBalance}
          className="w-full py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}
        >
          {submitting
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</span>
            : 'Request Withdrawal'}
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-2xl px-5 py-4" style={{ background: '#faf9ff', border: '1.5px solid #e3ddf8' }}>
        <p className="text-xs font-bold text-gray-700 mb-2">How payouts work</p>
        <ul className="space-y-1.5">
          {[
            `${rates?.creditsPerUsd ?? 100} ad revenue credits = $1.00`,
            `${rates?.platformFeePct ?? 20}% platform fee applies`,
            'Admin reviews within 1–3 business days',
            'Auto-paid via Stripe Connect (connect your bank above)',
            `Minimum: ${(rates?.minWithdrawalCredits ?? 1000).toLocaleString()} credits ($${rates?.minWithdrawalUsd?.toFixed(0) ?? '10'})`,
            'Pro and Unlimited plans only',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-gray-600">
              <CheckCircle className="w-3 h-3 shrink-0 text-gray-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Withdrawal history */}
      {data && data.withdrawals.length > 0 ? (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <span className="text-sm font-semibold text-gray-800">Withdrawal History</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Date</th>
                  <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Credits</th>
                  <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-600">You Receive</th>
                  <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-600 hidden sm:table-cell">Payout Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f9f7ff]">
                {data.withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-[#faf9ff]">
                    <td className="px-5 py-3 text-xs text-gray-600">{new Date(w.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 font-medium text-gray-800 tabular-nums">{w.creditsRequested.toLocaleString()}</td>
                    <td className="px-5 py-3 font-bold text-green-700 tabular-nums">${w.creatorAmountUsd.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={W_STATUS_STYLES[w.status] ?? { background: '#f3f4f6', color: '#374151' }}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600 hidden sm:table-cell">{w.payoutEmail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1.5px solid #e3ddf8' }}>
          <DollarSign className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No withdrawal requests yet.</p>
          <p className="text-xs text-gray-400 mt-1">Earn ad revenue from the Browse page, then request a payout above.</p>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type EarningsTab = 'referrals' | 'withdraw';

function WalletContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<EarningsTab>('referrals');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: sub } = useQuery<{ plan: string; status: string; currentPeriodEnd: string | null }>({
    queryKey: ['billing-subscription'],
    queryFn: () => api.billing.getSubscription().then((r) => r.data as { plan: string; status: string; currentPeriodEnd: string | null }),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    const tabParam = searchParams.get('tab') as EarningsTab | null;
    if (tabParam === 'withdraw') setTab('withdraw');
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('recharged') === 'true') {
      setSuccessMsg('Payment successful!');
      router.replace('/wallet');
    }
  }, [searchParams, router]);

  const planLabel = sub?.plan === 'PRO' ? 'Pro' : sub?.plan === 'UNLIMITED' ? 'Unlimited' : 'Free';

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-5">

        {successMsg && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl" style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7' }}>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-semibold text-emerald-800">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Earnings &amp; Referrals</h1>
            <p className="text-sm text-gray-600 mt-0.5">Ad revenue payouts and referral rewards</p>
          </div>
          {/* Current plan chip + link to /plans */}
          <a
            href="/plans"
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 shrink-0"
            style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)', color: '#fff' }}
          >
            {sub?.plan === 'UNLIMITED' ? <Sparkles className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
            {planLabel} plan
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[#ede9f8]">
          {([
            { id: 'referrals', label: 'Referrals', icon: <Gift className="w-4 h-4" /> },
            { id: 'withdraw',  label: 'Ad Revenue', icon: <DollarSign className="w-4 h-4" /> },
          ] as { id: EarningsTab; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-t-2xl transition-all -mb-px"
              style={tab === id
                ? { background: '#fff', border: '1.5px solid #ede9f8', borderBottom: '1.5px solid #fff', color: '#374151' }
                : { color: '#374151', border: '1.5px solid transparent' }
              }
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === 'referrals' && <ReferralCenter />}
        {tab === 'withdraw'  && <WithdrawTab />}

      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <WalletContent />
    </Suspense>
  );
}
