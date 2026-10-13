import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type CreditStatus = 'healthy' | 'warning' | 'critical' | 'free' | 'unknown';

export interface ProviderCreditInfo {
  provider: string;
  label: string;
  status: CreditStatus;
  /** Credit/quota remaining as a 0-100 percentage (null = not queryable) */
  remainingPct: number | null;
  /** Human-readable balance or usage string */
  balance: string;
  /** Estimated monthly cost in USD based on internal usage */
  estimatedMonthlyCostUsd: number;
  /** How many assets this provider generated this month */
  assetCount: number;
  /** Breakdown by asset kind */
  breakdown: Record<string, number>;
  /** Source of balance info: 'api' = queried live, 'internal' = from DB, 'free' = no limit */
  source: 'api' | 'internal' | 'free';
  note?: string;
}

/** Warning at 20% remaining, critical at 10%. */
function statusFromPct(pct: number | null): CreditStatus {
  if (pct === null) return 'unknown';
  if (pct <= 10) return 'critical';
  if (pct <= 20) return 'warning';
  return 'healthy';
}

// Rough per-unit cost estimates (USD) for cost projection when APIs don't expose balance
const COST_RATES: Record<string, number> = {
  'elevenlabs':           0.0003,  // per character (~$0.30 / 1000 chars)
  'openai-image':         0.04,    // per image (DALL-E 3 standard)
  'gemini-image':         0.0004,  // per image (Imagen ~free tier)
  'pollinations-image':   0,       // free
  'offline-gradient-image': 0,     // free
  'openai-tts':           0.015,   // per 1000 chars
  'ffmpeg-kenburns':      0,       // free
  'ffmpeg-local':         0,       // free
  'in-app-synth':         0,       // free
  'replicate':            0.005,   // per call estimate
  'stability-ai':         0.002,   // per image estimate
};

@Injectable()
export class CreditMonitorService {
  private readonly logger = new Logger(CreditMonitorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProviderCredits(): Promise<ProviderCreditInfo[]> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregate asset counts per provider this month
    const assetRows = await this.prisma.assetVersion.findMany({
      where: { createdAt: { gte: monthStart }, provider: { not: null } },
      select: { provider: true, asset: { select: { kind: true } } },
    });

    const providerStats: Record<string, { total: number; breakdown: Record<string, number> }> = {};
    for (const row of assetRows) {
      const p = row.provider ?? 'unknown';
      if (!providerStats[p]) providerStats[p] = { total: 0, breakdown: {} };
      providerStats[p]!.total += 1;
      const kind = row.asset.kind.toLowerCase();
      providerStats[p]!.breakdown[kind] = (providerStats[p]!.breakdown[kind] ?? 0) + 1;
    }

    const results: ProviderCreditInfo[] = [];

    // ── ElevenLabs — real API query ─────────────────────────────────────────
    const el11Key = process.env['ELEVENLABS_API_KEY'];
    if (el11Key) {
      const stats = providerStats['elevenlabs'] ?? { total: 0, breakdown: {} };
      let info: ProviderCreditInfo = {
        provider: 'elevenlabs',
        label: 'ElevenLabs (Voice)',
        status: 'unknown',
        remainingPct: null,
        balance: 'Balance unavailable',
        estimatedMonthlyCostUsd: stats.total * (COST_RATES['elevenlabs'] ?? 0) * 800,
        assetCount: stats.total,
        breakdown: stats.breakdown,
        source: 'internal',
      };
      try {
        const r = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': el11Key },
          signal: AbortSignal.timeout(8000),
        });
        if (r.ok) {
          const data = (await r.json()) as {
            subscription?: {
              character_count?: number;
              character_limit?: number;
              tier?: string;
            };
          };
          const used = data.subscription?.character_count ?? 0;
          const limit = data.subscription?.character_limit ?? 0;
          const remaining = limit > 0 ? Math.max(0, limit - used) : 0;
          const pct = limit > 0 ? Math.round((remaining / limit) * 100) : null;
          info = {
            ...info,
            status: statusFromPct(pct),
            remainingPct: pct,
            balance: limit > 0
              ? `${remaining.toLocaleString()} / ${limit.toLocaleString()} chars remaining`
              : `${used.toLocaleString()} chars used (${data.subscription?.tier ?? 'unknown'} plan)`,
            source: 'api',
          };
        }
      } catch (e) {
        this.logger.warn(`ElevenLabs credit check failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      results.push(info);
    }

    // ── OpenAI — internal usage tracking (no public balance API) ────────────
    const oaiKey = process.env['OPENAI_API_KEY'];
    if (oaiKey) {
      const stats = providerStats['openai-image'] ?? { total: 0, breakdown: {} };
      const voiceStats = providerStats['openai-tts'] ?? { total: 0, breakdown: {} };
      const totalCount = stats.total + voiceStats.total;
      const cost = (stats.total * (COST_RATES['openai-image'] ?? 0)) + (voiceStats.total * (COST_RATES['openai-tts'] ?? 0) * 0.5);
      results.push({
        provider: 'openai',
        label: 'OpenAI (GPT-4 / DALL-E / TTS)',
        status: 'unknown',
        remainingPct: null,
        balance: `~$${cost.toFixed(2)} spent this month (${totalCount} assets)`,
        estimatedMonthlyCostUsd: cost,
        assetCount: totalCount,
        breakdown: { ...stats.breakdown, ...voiceStats.breakdown },
        source: 'internal',
        note: 'OpenAI does not expose a balance API — cost is estimated from asset count.',
      });
    }

    // ── Gemini (Google AI) — free quota tracking ─────────────────────────────
    const geminiKey = process.env['GEMINI_API_KEY'];
    if (geminiKey) {
      const stats = providerStats['gemini-image'] ?? { total: 0, breakdown: {} };
      results.push({
        provider: 'gemini',
        label: 'Google Gemini / Imagen',
        status: stats.total > 800 ? 'warning' : 'healthy',
        remainingPct: stats.total < 1000 ? Math.round(((1000 - stats.total) / 1000) * 100) : 0,
        balance: `${stats.total} images this month (free tier: ~1000/month)`,
        estimatedMonthlyCostUsd: 0,
        assetCount: stats.total,
        breakdown: stats.breakdown,
        source: 'internal',
        note: 'Gemini Imagen free tier: ~1000 images/month. Contact Google for higher limits.',
      });
    }

    // ── Pollinations — always free ───────────────────────────────────────────
    const polStats = providerStats['pollinations-image'] ?? { total: 0, breakdown: {} };
    results.push({
      provider: 'pollinations',
      label: 'Pollinations.ai (Images)',
      status: 'free',
      remainingPct: 100,
      balance: `Free tier · ${polStats.total} images generated this month`,
      estimatedMonthlyCostUsd: 0,
      assetCount: polStats.total,
      breakdown: polStats.breakdown,
      source: 'free',
    });

    // ── Internal (ffmpeg, offline) — always free ─────────────────────────────
    const ffmpegStats = {
      total: (providerStats['ffmpeg-kenburns']?.total ?? 0) + (providerStats['ffmpeg-local']?.total ?? 0),
      breakdown: {
        ...providerStats['ffmpeg-kenburns']?.breakdown,
        ...providerStats['ffmpeg-local']?.breakdown,
      },
    };
    results.push({
      provider: 'internal-ffmpeg',
      label: 'Internal (FFmpeg / Offline)',
      status: 'free',
      remainingPct: 100,
      balance: `Free · ${ffmpegStats.total} media files rendered this month`,
      estimatedMonthlyCostUsd: 0,
      assetCount: ffmpegStats.total,
      breakdown: ffmpegStats.breakdown,
      source: 'free',
    });

    // ── Replicate — internal tracking ────────────────────────────────────────
    const repKey = process.env['REPLICATE_API_TOKEN'];
    if (repKey) {
      const stats = providerStats['replicate'] ?? { total: 0, breakdown: {} };
      const cost = stats.total * (COST_RATES['replicate'] ?? 0);
      results.push({
        provider: 'replicate',
        label: 'Replicate (Music / Video)',
        status: 'unknown',
        remainingPct: null,
        balance: `~$${cost.toFixed(2)} spent (${stats.total} calls this month)`,
        estimatedMonthlyCostUsd: cost,
        assetCount: stats.total,
        breakdown: stats.breakdown,
        source: 'internal',
        note: 'Login to replicate.com/usage to see account balance.',
      });
    }

    // ── Stability AI — internal tracking ────────────────────────────────────
    const stabKey = process.env['STABILITY_API_KEY'];
    if (stabKey) {
      const stats = providerStats['stability-ai'] ?? { total: 0, breakdown: {} };
      let stabilityInfo: ProviderCreditInfo = {
        provider: 'stability-ai',
        label: 'Stability AI (Images)',
        status: 'unknown',
        remainingPct: null,
        balance: `${stats.total} images generated this month`,
        estimatedMonthlyCostUsd: stats.total * (COST_RATES['stability-ai'] ?? 0),
        assetCount: stats.total,
        breakdown: stats.breakdown,
        source: 'internal',
      };
      try {
        const r = await fetch('https://api.stability.ai/v1/user/balance', {
          headers: { Authorization: `Bearer ${stabKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (r.ok) {
          const data = (await r.json()) as { credits?: number };
          const credits = data.credits ?? 0;
          const pct = Math.min(100, Math.round(credits / 10)); // 1000 credits = 100%
          stabilityInfo = {
            ...stabilityInfo,
            status: statusFromPct(pct),
            remainingPct: pct,
            balance: `${credits.toFixed(2)} credits remaining`,
            source: 'api',
          };
        }
      } catch { /* ignore — internal tracking still shown */ }
      results.push(stabilityInfo);
    }

    return results;
  }

  /**
   * Check all providers and notify admin users if any are at warning/critical levels.
   * Called from the automation heartbeat.
   */
  async checkAndNotifyAdmins(): Promise<void> {
    let credits: ProviderCreditInfo[];
    try {
      credits = await this.getProviderCredits();
    } catch (e) {
      this.logger.warn(`Credit check failed: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    const problematic = credits.filter((c) => c.status === 'warning' || c.status === 'critical');
    if (problematic.length === 0) return;

    // Find all elevated-role users to notify (SUPER_ADMIN or OWNER)
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'OWNER'] } },
      select: { id: true },
    });

    for (const admin of admins) {
      for (const c of problematic) {
        const pctStr = c.remainingPct !== null ? ` (${c.remainingPct}% remaining)` : '';
        await this.prisma.notification.create({
          data: {
            userId: admin.id,
            type: c.status === 'critical' ? 'credits.critical' : 'credits.low',
            title: c.status === 'critical'
              ? `⚠️ ${c.label} credits critically low${pctStr}`
              : `${c.label} credits running low${pctStr}`,
            body: `${c.balance}. Top up soon to avoid pipeline failures.`,
            meta: { provider: c.provider, remainingPct: c.remainingPct, status: c.status } as never,
          },
        }).catch(() => undefined); // best-effort, never block the heartbeat
      }
    }

    this.logger.log(`[CreditMonitor] Notified ${admins.length} admin(s) about ${problematic.length} provider(s) with low credits`);
  }
}
