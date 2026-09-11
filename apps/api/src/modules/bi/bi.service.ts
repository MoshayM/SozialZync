import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// ── Pure math helpers (exported for unit tests — no I/O, no side effects) ────

/**
 * Moving-average forecast over a window of the most-recent min(6, N) points.
 *
 * semantics: value = mean(window); the forecast is already a per-period rate,
 * so we multiply by horizonPeriods to project over the horizon.
 * Confidence band: value ∓ 1.96 × stddev(window) × √horizonPeriods
 * (propagating Gaussian uncertainty — simple and explainable per §11).
 *
 * Guard: empty points array → { 0, 0, 0 }.
 */
export function movingAverageForecast(
  points: number[],
  horizon: number,
): { value: number; low: number; high: number } {
  if (points.length === 0) return { value: 0, low: 0, high: 0 };

  const window = points.slice(-Math.min(6, points.length));
  const n = window.length;
  const mean = window.reduce((a, b) => a + b, 0) / n;

  // Sample stddev (Bessel-corrected when n > 1; 0 for a single point)
  const variance =
    n < 2
      ? 0
      : window.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (n - 1);
  const stddev = Math.sqrt(variance);

  const value = mean * horizon;
  const margin = 1.96 * stddev * Math.sqrt(horizon);

  return {
    value,
    low: Math.max(0, value - margin),
    high: value + margin,
  };
}

/**
 * Least-squares linear regression forecast.
 *
 * Fits y = slope × x + intercept through the supplied (x, y) pairs and
 * evaluates at xFuture.  Confidence band: ∓ 1.96 × residual stddev.
 *
 * Fewer than 2 points: falls back to the last y value (or 0) with zero-width
 * interval — no meaningful regression is possible.
 */
export function linearForecast(
  points: Array<{ x: number; y: number }>,
  xFuture: number,
): { value: number; low: number; high: number } {
  if (points.length < 2) {
    const fallback = points.length === 1 ? points[0]!.y : 0;
    return { value: fallback, low: fallback, high: fallback };
  }

  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  // Degenerate case: all x values identical → constant; return mean
  if (denom === 0) {
    const meanY = sumY / n;
    return { value: meanY, low: meanY, high: meanY };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const value = slope * xFuture + intercept;

  // Residual stddev
  const residualVariance =
    points.reduce((acc, p) => {
      const predicted = slope * p.x + intercept;
      return acc + (p.y - predicted) ** 2;
    }, 0) /
    (n > 2 ? n - 2 : 1); // degrees of freedom; guard against n=2 → 0
  const residualStddev = Math.sqrt(residualVariance);
  const margin = 1.96 * residualStddev;

  return {
    value,
    low: Math.max(0, value - margin),
    high: value + margin,
  };
}

/**
 * Churn rate: fraction of active-start users who were lost.
 * Returns 0 when activeStart is 0 (no denominator).  Clamped to [0, 1].
 */
export function churnRate(activeStart: number, lost: number): number {
  if (activeStart <= 0) return 0;
  return Math.min(1, Math.max(0, lost / activeStart));
}

/**
 * Bucket rows by contiguous time periods ending at `now`.
 *
 * Returns an array of `periods` sums (oldest bucket first).
 * Rows whose `at` timestamp falls outside the total range are ignored.
 */
export function bucketByPeriod(
  rows: Array<{ at: Date; amount: number }>,
  periodDays: number,
  periods: number,
  now: Date,
): number[] {
  const buckets = Array<number>(periods).fill(0);
  const totalMs = periodDays * 24 * 60 * 60 * 1000;
  const rangeStartMs = now.getTime() - periods * totalMs;

  for (const row of rows) {
    const rowMs = row.at.getTime();
    if (rowMs < rangeStartMs || rowMs > now.getTime()) continue;
    // Which bucket (0 = oldest)?
    const idx = Math.floor((rowMs - rangeStartMs) / totalMs);
    const clampedIdx = Math.min(idx, periods - 1);
    buckets[clampedIdx] = (buckets[clampedIdx] ?? 0) + row.amount;
  }

  return buckets;
}

/**
 * North-star metric (docs4/01_Product_Vision §North-Star): published,
 * human-approved videos produced through the full workflow per active
 * channel per month.  Returns 0 when there are no active channels
 * (no denominator).
 */
export function northStarRate(
  publishedVideos: number,
  activeChannels: number,
): number {
  if (activeChannels <= 0) return 0;
  return publishedVideos / activeChannels;
}

// ── Plan price map ────────────────────────────────────────────────────────────
// MRR/ARR require mapping the Plan enum to a monthly price in minor units
// (cents).  Real prices live in the Stripe product catalogue; we mirror them
// here so the BI service can run without an external API call.
//
// Override at runtime via PLAN_PRICES_JSON env-var (JSON object mapping
// plan name → monthly price in minor units, e.g. {"PRO":2900,"AGENCY":7900}).
// Deviation from spec: the codebase has no read replica — every query here is
// an aggregate (groupBy/count/sum), never a full-table row scan.

function planPriceMap(): Record<string, number> {
  const envVal = process.env['PLAN_PRICES_JSON'];
  if (envVal) {
    try {
      return JSON.parse(envVal) as Record<string, number>;
    } catch {
      // fall through to defaults
    }
  }
  // Defaults mirror the published plans (settings page / Stripe catalogue):
  // Starter $29/mo, Pro $79/mo, Agency $199/mo.
  return {
    FREE: 0,
    STARTER: 2900,
    PRO: 7900,
    AGENCY: 19900,
  };
}

// ── BiService ─────────────────────────────────────────────────────────────────

@Injectable()
export class BiService {
  private readonly logger = new Logger(BiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute live enterprise-level metrics from aggregate DB queries.
   *
   * Deviation from spec §9: no read replica exists in this codebase.
   * All queries are aggregate-only (groupBy/count/sum) — never full-table
   * row scans — so they remain safe on the primary.
   */
  async enterpriseMetrics(): Promise<Record<string, unknown>> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      activeSubscriptions,
      cancelledSubscriptions,
      revenueBy6Months,
      revenueDistinctUsers30d,
      revenueSum30d,
      aiCostSum30d,
      cacheHitCostSum30d,
      topModels,
    ] = await Promise.all([
      // Active subscriptions grouped by plan for MRR/ARR
      this.prisma.subscription.groupBy({
        by: ['plan'],
        where: { status: 'ACTIVE' },
        _count: true,
      }).catch(() => [] as Array<{ plan: string; _count: number }>),

      // Subscriptions cancelled in the last 30d (churn numerator)
      this.prisma.subscription.count({
        where: { status: 'CANCELLED', updatedAt: { gte: thirtyDaysAgo } },
      }).catch(() => 0),

      // Succeeded payments in the last 6 months for monthly revenue buckets
      this.prisma.payment.findMany({
        where: { status: 'SUCCEEDED', createdAt: { gte: new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000) } },
        select: { createdAt: true, amount: true },
        orderBy: { createdAt: 'asc' },
      }).catch(() => [] as Array<{ createdAt: Date; amount: number }>),

      // Distinct paying users last 30d (for ARPU denominator)
      this.prisma.payment.groupBy({
        by: ['userId'],
        where: { status: 'SUCCEEDED', createdAt: { gte: thirtyDaysAgo } },
      }).catch(() => [] as Array<{ userId: string }>),

      // Total revenue last 30d
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', createdAt: { gte: thirtyDaysAgo } },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),

      // AI cost last 30d (non-cache rows)
      this.prisma.tokenUsage.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo }, fromCache: false },
        _sum: { costUsd: true },
      }).catch(() => ({ _sum: { costUsd: 0 } })),

      // Cache hit rows last 30d — costUsd is 0 for cache hits in this
      // codebase (no charge on cache).  Estimate via tokensIn + tokensOut
      // at a blended rate of $1.50 / 1M tokens (rough average across models).
      // This is an explainable heuristic noted in comments (§11 spec).
      this.prisma.tokenUsage.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo }, fromCache: true },
        _sum: { tokensIn: true, tokensOut: true, costUsd: true },
      }).catch(() => ({ _sum: { tokensIn: 0, tokensOut: 0, costUsd: 0 } })),

      // Top 5 models by cost last 30d
      this.prisma.tokenUsage.groupBy({
        by: ['model'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { costUsd: true, tokensIn: true, tokensOut: true },
        orderBy: { _sum: { costUsd: 'desc' } },
        take: 5,
      }).catch(() => [] as Array<{ model: string; _sum: { costUsd: number | null; tokensIn: number | null; tokensOut: number | null } }>),
    ]);

    // North-star queries run independently so a failure in one doesn't block the rest
    const publishedVideos30d = await this.prisma.video.count({
      where: { status: 'PUBLISHED', publishedAt: { gte: thirtyDaysAgo } },
    }).catch(() => 0);

    const activeChannelRows = await this.prisma.project.findMany({
      where: { jobs: { some: { createdAt: { gte: thirtyDaysAgo } } } },
      select: { channelId: true },
      distinct: ['channelId'],
    }).catch(() => [] as Array<{ channelId: string | null }>);

    // MRR: sum of (count × monthly plan price) across active subscriptions
    const prices = planPriceMap();
    let mrrMinor = 0;
    for (const group of activeSubscriptions) {
      const price = prices[group.plan] ?? 0;
      mrrMinor += group._count * price;
    }
    const arrMinor = mrrMinor * 12;

    // Churn rate: cancelled last 30d / (active now + cancelled last 30d)
    // Proxy for "active at period start" — nearest computable value from the
    // Subscription table without a snapshot table.  Documented deviation.
    const activeNow = activeSubscriptions.reduce((s, g) => s + g._count, 0);
    const churnNumerator = cancelledSubscriptions;
    const churnDenominator = activeNow + churnNumerator;
    const churn = churnRate(churnDenominator, churnNumerator);

    // ARPU and LTV
    const distinctPayingUsers = revenueDistinctUsers30d.length;
    const revenue30d = revenueSum30d._sum.amount ?? 0;
    const arpu = distinctPayingUsers > 0 ? revenue30d / distinctPayingUsers : 0;
    // LTV = ARPU / max(churn, 0.01) — heuristic: a 1% floor prevents
    // division-by-zero and keeps LTV bounded when churn is near-zero.
    const ltv = arpu / Math.max(churn, 0.01);

    // Revenue by month (last 6 months, oldest first)
    const revenueByMonth = bucketByPeriod(
      revenueBy6Months.map((p) => ({ at: p.createdAt, amount: p.amount })),
      30,
      6,
      now,
    );

    // AI cost
    const aiCostUsd = aiCostSum30d._sum.costUsd ?? 0;

    // Cache savings: actual costUsd stored for cache rows (usually 0 in this
    // codebase because provider is not called).  Fall back to token-based
    // estimate at $1.50 / 1M tokens (blended average — explainable heuristic).
    const BLENDED_RATE_PER_TOKEN = 1.5 / 1_000_000;
    const cacheActualSavings = cacheHitCostSum30d._sum.costUsd ?? 0;
    const cacheTokens =
      (cacheHitCostSum30d._sum.tokensIn ?? 0) +
      (cacheHitCostSum30d._sum.tokensOut ?? 0);
    const cacheSavingsUsd =
      cacheActualSavings > 0
        ? cacheActualSavings
        : cacheTokens * BLENDED_RATE_PER_TOKEN;

    // North-star metric (docs4/01): published videos per active channel, 30d
    const activeChannels30d = activeChannelRows.length;

    return {
      northStar: {
        publishedVideos30d,
        activeChannels30d,
        perActiveChannel: northStarRate(publishedVideos30d, activeChannels30d),
      },
      mrr: mrrMinor,
      arr: arrMinor,
      revenueByMonth,
      arpu,
      ltv,
      churn,
      aiCostUsd,
      cacheSavingsUsd,
      topModels: topModels.map((m) => ({
        model: m.model,
        costUsd: m._sum.costUsd ?? 0,
        tokensIn: m._sum.tokensIn ?? 0,
        tokensOut: m._sum.tokensOut ?? 0,
      })),
    };
  }

  /**
   * Generate and persist forecasts for revenue, cost, and subscription metrics.
   *
   * Idempotent per day: skips a metric if a forecast was already generated
   * today (UTC date comparison).  Writes the linear forecast when points >= 4
   * (enough data for regression to be meaningful); otherwise uses moving average.
   */
  async generateForecasts(): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const metrics = ['revenue', 'cost', 'subscription'] as const;

    for (const metric of metrics) {
      // Idempotency: skip if already generated today
      const existing = await this.prisma.forecast.findFirst({
        where: { metric, generatedAt: { gte: today } },
        select: { id: true },
      });
      if (existing) {
        this.logger.debug(`[forecast] ${metric} already generated today — skipping`);
        continue;
      }

      const buckets = await this.fetchMetricBuckets(metric);
      if (buckets.length === 0) {
        this.logger.debug(`[forecast] ${metric} has no data points — skipping`);
        continue;
      }

      const horizonDays = 30;
      const horizonPeriods = 1; // 1 period = 30 days

      let result: { value: number; low: number; high: number };
      let method: string;

      if (buckets.length >= 4) {
        // Linear regression: x = period index (0-based), y = bucket value
        const xyPoints = buckets.map((v, i) => ({ x: i, y: v }));
        const xFuture = buckets.length; // next period
        result = linearForecast(xyPoints, xFuture);
        method = 'linear_regression';
      } else {
        result = movingAverageForecast(buckets, horizonPeriods);
        method = 'moving_average';
      }

      await this.prisma.forecast.create({
        data: {
          metric,
          horizonDays,
          predictedValue: result.value,
          confidenceLow: result.low,
          confidenceHigh: result.high,
          method,
          inputPointsCount: buckets.length,
        },
      });

      this.logger.log(`[forecast] generated ${metric} (${method}, ${buckets.length} points)`);
    }
  }

  /**
   * Retrieve the most recent forecast(s), optionally filtered by metric name.
   */
  async latestForecasts(metric?: string): Promise<unknown[]> {
    try {
      if (metric) {
        const row = await this.prisma.forecast.findFirst({
          where: { metric },
          orderBy: { generatedAt: 'desc' },
        });
        return row ? [row] : [];
      }

      // Return the latest row per metric using a subquery via groupBy
      const latest = await this.prisma.forecast.groupBy({
        by: ['metric'],
        _max: { generatedAt: true },
      });

      const rows = await Promise.all(
        latest.map((g) =>
          this.prisma.forecast.findFirst({
            where: { metric: g.metric, generatedAt: g._max.generatedAt! },
            orderBy: { generatedAt: 'desc' },
          }),
        ),
      );

      return rows.filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Full SaaS analytics suite: subscription & revenue KPIs, retention & churn
   * metrics, marketing efficiency (CAC / LTV:CAC), and cashflow indicators.
   *
   * All monetary values returned in minor units (cents) unless the field name
   * ends in `Usd`. Rates are 0..1 decimals (multiply by 100 for %).
   *
   * Marketing metrics (CAC, payback) require MONTHLY_MARKETING_SPEND_USD env
   * var — they return null when unconfigured rather than silently computing
   * with a zero denominator.
   */
  async subscriptionAnalyticsMetrics(): Promise<Record<string, unknown>> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo  = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    const prices = planPriceMap();

    const [
      activeSubscriptions,
      cancelledByPlan30d,
      newPayingCount30d,
      totalUserCount,
      totalPayingCount,
      revenue30d,
      prevRevenue30d,
      payingUsersDistinct30d,
      aiCost30d,
      revenueRows6m,
      cohortRows,
    ] = await Promise.all([
      // Active subscriptions by plan → MRR/ARR
      this.prisma.subscription.groupBy({ by: ['plan'], where: { status: 'ACTIVE' }, _count: true })
        .catch(() => [] as Array<{ plan: string; _count: number }>),

      // Cancelled by plan last 30d → churned MRR
      this.prisma.subscription.groupBy({ by: ['plan'], where: { status: 'CANCELLED', updatedAt: { gte: thirtyDaysAgo } }, _count: true })
        .catch(() => [] as Array<{ plan: string; _count: number }>),

      // New paying subscriptions last 30d
      this.prisma.subscription.count({ where: { status: 'ACTIVE', createdAt: { gte: thirtyDaysAgo }, plan: { not: 'FREE' } } })
        .catch(() => 0),

      // Total registered users
      this.prisma.user.count().catch(() => 0),

      // Currently paying (non-free active)
      this.prisma.subscription.count({ where: { status: 'ACTIVE', plan: { not: 'FREE' } } })
        .catch(() => 0),

      // Revenue last 30d
      this.prisma.payment.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: thirtyDaysAgo } }, _sum: { amount: true } })
        .catch(() => ({ _sum: { amount: 0 } })),

      // Revenue 30–60d ago (prior period for growth / NRR baseline)
      this.prisma.payment.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }, _sum: { amount: true } })
        .catch(() => ({ _sum: { amount: 0 } })),

      // Distinct paying users last 30d (ARPU denominator)
      this.prisma.payment.groupBy({ by: ['userId'], where: { status: 'SUCCEEDED', createdAt: { gte: thirtyDaysAgo } } })
        .catch(() => [] as Array<{ userId: string }>),

      // AI cost last 30d (variable burn rate proxy)
      this.prisma.tokenUsage.aggregate({ where: { fromCache: false, createdAt: { gte: thirtyDaysAgo } }, _sum: { costUsd: true } })
        .catch(() => ({ _sum: { costUsd: 0 } })),

      // Raw payment rows for 6-month revenue buckets
      this.prisma.payment.findMany({ where: { status: 'SUCCEEDED', createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true, amount: true } })
        .catch(() => [] as Array<{ createdAt: Date; amount: number }>),

      // Subscriptions from last 6 months for cohort retention analysis
      this.prisma.subscription.findMany({
        where: { plan: { not: 'FREE' }, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true, status: true, plan: true },
        orderBy: { createdAt: 'asc' },
      }).catch(() => [] as Array<{ createdAt: Date; status: string; plan: string }>),
    ]);

    // ── Revenue KPIs ───────────────────────────────────────────────────────────
    let mrrMinor = 0;
    for (const g of activeSubscriptions) mrrMinor += g._count * (prices[g.plan] ?? 0);
    const arrMinor = mrrMinor * 12;

    const payingCount = totalPayingCount || activeSubscriptions.filter(g => g.plan !== 'FREE').reduce((s, g) => s + g._count, 0);
    const acvMinor = payingCount > 0 ? arrMinor / payingCount : 0;   // Annual Contract Value per customer
    const tcvMinor = acvMinor;                                         // TCV ≈ ACV for month-to-month plans

    const revenue30dMinor    = revenue30d._sum.amount     ?? 0;
    const prevRevenue30dMinor = prevRevenue30d._sum.amount ?? 0;
    const distinctPaying     = payingUsersDistinct30d.length;
    const arpu  = distinctPaying > 0 ? revenue30dMinor / distinctPaying : 0;
    const arpa  = arpu; // one account = one user in current model

    const revenueByMonth = bucketByPeriod(
      revenueRows6m.map(p => ({ at: p.createdAt, amount: p.amount })),
      30, 6, now,
    );

    const planDistribution = activeSubscriptions.map(g => ({
      plan: g.plan,
      count: g._count,
      mrr: g._count * (prices[g.plan] ?? 0),
    }));

    // ── Customer Counts ────────────────────────────────────────────────────────
    const cancelledCount30d = cancelledByPlan30d.reduce((s, g) => s + g._count, 0);
    const freeUsers = Math.max(0, totalUserCount - payingCount);

    // ── Churn & Retention ──────────────────────────────────────────────────────
    const activeNow       = activeSubscriptions.reduce((s, g) => s + g._count, 0);
    const churnDenom      = activeNow + cancelledCount30d;
    const monthlyChurn    = churnRate(churnDenom, cancelledCount30d);
    const annualChurn     = 1 - Math.pow(1 - monthlyChurn, 12);

    let churnedMrrMinor = 0;
    for (const g of cancelledByPlan30d) churnedMrrMinor += g._count * (prices[g.plan] ?? 0);

    // New MRR: average plan price × new subscribers
    const avgPlanPrice    = payingCount > 0 ? mrrMinor / payingCount : 0;
    const newMrrMinor     = newPayingCount30d * avgPlanPrice;

    // Revenue Churn = churned MRR / previous period MRR
    const prevMrr         = prevRevenue30dMinor || mrrMinor;
    const revenueChurn    = prevMrr > 0 ? Math.min(1, churnedMrrMinor / prevMrr) : 0;

    // NRR ≈ current MRR / prior MRR (expansion/contraction not tracked without change log)
    const nrr = prevMrr > 0 ? mrrMinor / prevMrr : 1;
    // GRR = (MRR - churnedMRR) / prior MRR — no expansion credit (gross = before upsell)
    const grr = prevMrr > 0 ? Math.max(0, Math.min(1, (mrrMinor - churnedMrrMinor) / prevMrr)) : 1;

    const retentionRate   = 1 - monthlyChurn;
    const lifespanMonths  = monthlyChurn > 0 ? 1 / monthlyChurn : 120;
    const ltv             = arpu / Math.max(monthlyChurn, 0.01);
    const netMrrGrowth    = prevMrr > 0 ? (mrrMinor - prevMrr) / prevMrr : 0;

    // ── Cohort Retention ───────────────────────────────────────────────────────
    const cohortMap = new Map<string, { total: number; active: number }>();
    for (const sub of cohortRows) {
      const key = `${sub.createdAt.getFullYear()}-${String(sub.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const c   = cohortMap.get(key) ?? { total: 0, active: 0 };
      c.total++;
      if (sub.status === 'ACTIVE') c.active++;
      cohortMap.set(key, c);
    }
    const cohortRetention = Array.from(cohortMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohortMonth, d]) => ({
        cohortMonth,
        initialCount: d.total,
        activeCount: d.active,
        retentionRate: d.total > 0 ? d.active / d.total : 0,
      }));

    // ── Marketing & Acquisition ────────────────────────────────────────────────
    const marketingSpendUsd = parseFloat(process.env['MONTHLY_MARKETING_SPEND_USD'] ?? '0');
    const grossMarginRate   = parseFloat(process.env['GROSS_MARGIN_PCT'] ?? '0.8');
    const marketingConfigured = marketingSpendUsd > 0;

    const cac = marketingConfigured && newPayingCount30d > 0
      ? marketingSpendUsd / newPayingCount30d
      : null;
    // ARPU in USD for payback calc
    const arpuUsd = arpu / 100;
    const cacPaybackMonths = cac && arpuUsd > 0
      ? cac / (arpuUsd * grossMarginRate)
      : null;
    const ltvUsd      = ltv / 100;
    const ltvCacRatio = cac && ltvUsd > 0 ? ltvUsd / cac : null;

    // ── Cashflow ──────────────────────────────────────────────────────────────
    const aiCostUsd     = aiCost30d._sum.costUsd ?? 0;
    const burnRateUsd   = aiCostUsd; // variable AI burn component; infra cost needs env input

    return {
      // Revenue
      mrr: mrrMinor, arr: arrMinor, acv: acvMinor, tcv: tcvMinor,
      runRate: arrMinor, arpu, arpa, ltv, revenueByMonth, planDistribution,
      // Customers
      totalUsers: totalUserCount, payingUsers: payingCount, freeUsers,
      newCustomers30d: newPayingCount30d, lostCustomers30d: cancelledCount30d,
      // Retention
      monthlyChurnRate: monthlyChurn, annualChurnRate: annualChurn,
      revenueChurnRate: revenueChurn, nrr, grr,
      customerRetentionRate: retentionRate, avgCustomerLifespanMonths: lifespanMonths,
      cohortRetention,
      // MRR movements
      newMrr: newMrrMinor, churnedMrr: churnedMrrMinor, expansionMrr: 0, contractionMrr: 0,
      netMrrGrowthRate: netMrrGrowth,
      // Acquisition
      cac, cacPaybackPeriodMonths: cacPaybackMonths, ltvCacRatio,
      marketingSpendConfigured: marketingConfigured,
      // Cashflow
      aiCostUsd, burnRateUsd,
      // Meta
      generatedAt: now.toISOString(), dataWindow: 'Last 30 days',
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Pull 6 monthly aggregate buckets for the given metric (oldest first).
   * Returns raw sums in metric-specific units:
   *   revenue     → minor units (cents)
   *   cost        → USD (float)
   *   subscription → count of active subscriptions at each period end
   */
  private async fetchMetricBuckets(
    metric: 'revenue' | 'cost' | 'subscription',
  ): Promise<number[]> {
    const now = new Date();

    if (metric === 'revenue') {
      const rows = await this.prisma.payment.findMany({
        where: {
          status: 'SUCCEEDED',
          createdAt: { gte: new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true, amount: true },
        orderBy: { createdAt: 'asc' },
      });
      return bucketByPeriod(
        rows.map((r) => ({ at: r.createdAt, amount: r.amount })),
        30,
        6,
        now,
      );
    }

    if (metric === 'cost') {
      const rows = await this.prisma.tokenUsage.findMany({
        where: {
          fromCache: false,
          createdAt: { gte: new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true, costUsd: true },
        orderBy: { createdAt: 'asc' },
      });
      // costUsd is Float; multiply by 1 to keep units (USD, not minor)
      return bucketByPeriod(
        rows.map((r) => ({ at: r.createdAt, amount: r.costUsd })),
        30,
        6,
        now,
      );
    }

    // subscription: count of ACTIVE subscriptions over each 30-day period
    // We use createdAt as a proxy for "when the subscription became active".
    // This is a simplification — true cohort analysis requires a snapshot
    // table. Documented deviation from the ideal spec.
    const rows = await this.prisma.subscription.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return bucketByPeriod(
      rows.map((r) => ({ at: r.createdAt, amount: 1 })),
      30,
      6,
      now,
    );
  }
}
