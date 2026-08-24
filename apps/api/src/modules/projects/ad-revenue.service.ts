import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Ad Revenue System — CPM-based model for public Browse content.
 *
 * Creators opt in per-project. Platform earns ad impressions from Browse views;
 * a daily payout job converts accumulated view counts into bonusCredits in the
 * creator's wallet. No external ad network required — internal CPM model.
 *
 * CPM_CREDITS: credits per 1000 views (env: AD_REVENUE_CPM_CREDITS, default 50).
 * At CREDITS_PER_USD=100 that is $0.50 CPM — typical mobile/social CPM range.
 *
 * Fields on Project model (pending Prisma client regen after migration):
 *   viewCount        Int  — cumulative public Browse page views
 *   adRevenueCredits Int  — credits earned, awaiting payout
 *   adRevenuePaidOut Int  — total credits ever paid out
 *   adRevenueEnabled Bool — creator opt-in flag
 */
const CPM_CREDITS = parseInt(process.env['AD_REVENUE_CPM_CREDITS'] ?? '50', 10);
const MIN_PAYOUT_CREDITS = parseInt(process.env['AD_REVENUE_MIN_PAYOUT'] ?? '10', 10);
const PAYOUT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AdRevenueStats {
  projectId: string;
  title: string;
  viewCount: number;
  adRevenueCredits: number;
  adRevenuePaidOut: number;
  adRevenueEnabled: boolean;
  estimatedCpmCredits: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- new fields pending Prisma client regen after migration
type AnyProject = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- new fields pending Prisma client regen after migration
const prismaProject = (prisma: PrismaService) => (prisma.project as AnyProject);

@Injectable()
export class AdRevenueService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdRevenueService.name);
  private payoutTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    // Schedule daily payout distribution — starts 24h after boot to avoid stampede on redeploy
    this.payoutTimer = setInterval(() => {
      void this.distributeAdRevenue();
    }, PAYOUT_INTERVAL_MS);
  }

  /** Atomically increment view count for a published project. */
  async trackView(projectId: string): Promise<void> {
    await prismaProject(this.prisma).updateMany({
      where: { id: projectId, publishingStatus: 'PUBLISHED' },
      data: { viewCount: { increment: 1 } },
    });
  }

  /** Creator opts their project into the ad revenue programme. */
  async enableAdRevenue(userId: string, projectId: string): Promise<void> {
    await prismaProject(this.prisma).updateMany({
      where: { id: projectId, userId },
      data: { adRevenueEnabled: true },
    });
  }

  /** Creator opts their project out. */
  async disableAdRevenue(userId: string, projectId: string): Promise<void> {
    await prismaProject(this.prisma).updateMany({
      where: { id: projectId, userId },
      data: { adRevenueEnabled: false },
    });
  }

  /** Return ad revenue stats for all of a creator's projects. */
  async getCreatorStats(userId: string): Promise<AdRevenueStats[]> {
    const projects: AnyProject[] = await prismaProject(this.prisma).findMany({
      where: { userId },
      select: {
        id: true, title: true, viewCount: true,
        adRevenueCredits: true, adRevenuePaidOut: true, adRevenueEnabled: true,
      },
    });
    return projects.map((p: AnyProject) => ({
      projectId: p.id,
      title: p.title,
      viewCount: p.viewCount ?? 0,
      adRevenueCredits: p.adRevenueCredits ?? 0,
      adRevenuePaidOut: p.adRevenuePaidOut ?? 0,
      adRevenueEnabled: p.adRevenueEnabled ?? false,
      estimatedCpmCredits: Math.floor(((p.viewCount ?? 0) / 1000) * CPM_CREDITS),
    }));
  }

  /** Admin: platform-wide ad revenue summary. */
  async getPlatformStats() {
    const rows: AnyProject[] = await prismaProject(this.prisma).findMany({
      where: { adRevenueEnabled: true },
      select: { viewCount: true, adRevenueCredits: true, adRevenuePaidOut: true },
    });
    const totalViews = rows.reduce((s: number, r: AnyProject) => s + (r.viewCount ?? 0), 0);
    const totalPending = rows.reduce((s: number, r: AnyProject) => s + (r.adRevenueCredits ?? 0), 0);
    const totalPaid = rows.reduce((s: number, r: AnyProject) => s + (r.adRevenuePaidOut ?? 0), 0);
    return {
      totalViews,
      totalCreditsEarned: totalPending + totalPaid,
      totalCreditsPaid: totalPaid,
      activeProjects: rows.length,
      cpmCredits: CPM_CREDITS,
      minPayoutCredits: MIN_PAYOUT_CREDITS,
    };
  }

  /** Convert accumulated view counts into bonusCredits for each eligible creator. */
  async distributeAdRevenue(): Promise<{ paid: number; skipped: number }> {
    this.logger.log('Ad revenue distribution: starting');
    let paid = 0; let skipped = 0;
    try {
      const projects: AnyProject[] = await prismaProject(this.prisma).findMany({
        where: { adRevenueEnabled: true, viewCount: { gt: 0 } },
        select: { id: true, userId: true, viewCount: true, adRevenueCredits: true },
      });

      for (const project of projects) {
        const earned = Math.floor(((project.viewCount ?? 0) / 1000) * CPM_CREDITS);
        const pending = (project.adRevenueCredits ?? 0) + earned;
        if (pending < MIN_PAYOUT_CREDITS) { skipped++; continue; }

        await this.prisma.$transaction([
          this.prisma.wallet.upsert({
            where: { userId: project.userId },
            create: { userId: project.userId, bonusCredits: pending },
            update: { bonusCredits: { increment: pending } },
          }),
          prismaProject(this.prisma).update({
            where: { id: project.id },
            data: { adRevenueCredits: 0, adRevenuePaidOut: { increment: pending } },
          }),
        ]);
        paid++;
      }
      this.logger.log(`Ad revenue distribution: paid=${paid}, skipped=${skipped}`);
    } catch (err) {
      this.logger.error(`Ad revenue distribution failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { paid, skipped };
  }
}
