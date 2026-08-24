import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Monetization payout system.
 *
 * Pro/Agency creators cash out their ad-revenue bonusCredits.
 * A platform fee (env: WITHDRAWAL_PLATFORM_FEE_PCT, default 20%) is
 * automatically credited to the SUPER_ADMIN's bonus wallet before payout.
 *
 * Exchange rate: CREDITS_PER_USD env var (default 100) — 100 credits = $1.
 * Minimum withdrawal: WITHDRAWAL_MIN_CREDITS env var (default 1000) = $10.
 */

const CREDITS_PER_USD = Math.max(1, parseInt(process.env['CREDITS_PER_USD'] ?? '100', 10));
const PLATFORM_FEE_PCT = Math.max(0, Math.min(50, parseInt(process.env['WITHDRAWAL_PLATFORM_FEE_PCT'] ?? '20', 10)));
const MIN_WITHDRAWAL_CREDITS = Math.max(1, parseInt(process.env['WITHDRAWAL_MIN_CREDITS'] ?? '1000', 10));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pending Prisma regen
const pw = (prisma: PrismaService) => (prisma.withdrawal as any);

export interface WithdrawalRates {
  creditsPerUsd: number;
  platformFeePct: number;
  minWithdrawalCredits: number;
  minWithdrawalUsd: number;
}

export interface WithdrawalEstimate extends WithdrawalRates {
  creditsRequested: number;
  platformFeeCredits: number;
  creatorCredits: number;
  amountUsd: number;
  platformFeeUsd: number;
  creatorAmountUsd: number;
}

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(private readonly prisma: PrismaService) {}

  getRates(): WithdrawalRates {
    return {
      creditsPerUsd: CREDITS_PER_USD,
      platformFeePct: PLATFORM_FEE_PCT,
      minWithdrawalCredits: MIN_WITHDRAWAL_CREDITS,
      minWithdrawalUsd: Math.round((MIN_WITHDRAWAL_CREDITS / CREDITS_PER_USD) * 100) / 100,
    };
  }

  estimate(credits: number): WithdrawalEstimate {
    const platformFeeCredits = Math.floor(credits * (PLATFORM_FEE_PCT / 100));
    const creatorCredits = credits - platformFeeCredits;
    const amountUsd = credits / CREDITS_PER_USD;
    const platformFeeUsd = platformFeeCredits / CREDITS_PER_USD;
    const creatorAmountUsd = creatorCredits / CREDITS_PER_USD;
    return {
      creditsPerUsd: CREDITS_PER_USD,
      platformFeePct: PLATFORM_FEE_PCT,
      minWithdrawalCredits: MIN_WITHDRAWAL_CREDITS,
      minWithdrawalUsd: MIN_WITHDRAWAL_CREDITS / CREDITS_PER_USD,
      creditsRequested: credits,
      platformFeeCredits,
      creatorCredits,
      amountUsd,
      platformFeeUsd,
      creatorAmountUsd,
    };
  }

  /** Creator requests a withdrawal of their bonusCredits. */
  async requestWithdrawal(userId: string, plan: string, role: string, credits: number, payoutEmail?: string) {
    const isElevated = role === 'SUPER_ADMIN' || role === 'OWNER';
    const normalizedPlan = plan.toUpperCase();
    if (!isElevated && normalizedPlan !== 'PRO' && normalizedPlan !== 'AGENCY') {
      throw new ForbiddenException('Withdrawals are available on Pro and Agency plans only.');
    }
    if (!Number.isInteger(credits) || credits < MIN_WITHDRAWAL_CREDITS) {
      throw new BadRequestException(`Minimum withdrawal is ${MIN_WITHDRAWAL_CREDITS} credits ($${MIN_WITHDRAWAL_CREDITS / CREDITS_PER_USD}).`);
    }

    // Find or create the user's wallet and check bonusCredits
    const wallet = await this.prisma.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    if ((wallet.bonusCredits ?? 0) < credits) {
      throw new BadRequestException(
        `Insufficient bonus credits. You have ${wallet.bonusCredits ?? 0} bonus credits; requested ${credits}.`,
      );
    }

    const est = this.estimate(credits);

    // Find super admin to credit the platform fee
    const superAdmin = await this.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });

    return this.prisma.$transaction(async (tx) => {
      // 1. Deduct bonusCredits from creator wallet, increment withdrawnCredits
      await tx.wallet.update({
        where: { userId },
        data: {
          bonusCredits: { decrement: credits },
          withdrawnCredits: { increment: credits },
        },
      });

      // 2. Credit platform fee to super admin's bonusCredits
      if (superAdmin && est.platformFeeCredits > 0) {
        await tx.wallet.upsert({
          where: { userId: superAdmin.id },
          create: { userId: superAdmin.id, bonusCredits: est.platformFeeCredits },
          update: { bonusCredits: { increment: est.platformFeeCredits } },
        });
        this.logger.log(
          `Platform fee: ${est.platformFeeCredits} credits ($${est.platformFeeUsd.toFixed(2)}) credited to super admin`,
        );
      }

      // 3. Create withdrawal record
      const withdrawal = await pw(tx).create({
        data: {
          userId,
          creditsRequested: credits,
          platformFeeCredits: est.platformFeeCredits,
          creatorCredits: est.creatorCredits,
          creditsPerUsd: CREDITS_PER_USD,
          amountUsd: est.amountUsd,
          platformFeeUsd: est.platformFeeUsd,
          creatorAmountUsd: est.creatorAmountUsd,
          status: 'PENDING',
          payoutEmail: payoutEmail ?? null,
        },
      });

      this.logger.log(`Withdrawal ${withdrawal.id} created: ${credits} credits → $${est.creatorAmountUsd.toFixed(2)} for user ${userId}`);
      return withdrawal;
    });
  }

  /** Creator's withdrawal history. */
  async getCreatorWithdrawals(userId: string) {
    const withdrawals = await pw(this.prisma).findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return {
      withdrawals,
      availableBonusCredits: wallet?.bonusCredits ?? 0,
      withdrawnCredits: (wallet as any)?.withdrawnCredits ?? 0,
      rates: this.getRates(),
    };
  }

  /** Admin: list all withdrawals with user info. */
  async adminListWithdrawals(status?: string) {
    const where = status && status !== 'ALL' ? { status } : {};
    return pw(this.prisma).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /** Admin: platform earnings summary. */
  async adminStats() {
    const all = await pw(this.prisma).findMany({
      select: {
        status: true,
        creditsRequested: true,
        platformFeeCredits: true,
        creatorAmountUsd: true,
        platformFeeUsd: true,
        amountUsd: true,
      },
    });

    const totals = (all as any[]).reduce(
      (acc: any, w: any) => {
        acc.totalRequested += w.creditsRequested;
        acc.totalPlatformFee += w.platformFeeCredits;
        acc.totalPaidOutUsd += w.status === 'PAID' ? w.creatorAmountUsd : 0;
        acc.totalPlatformEarnedUsd += w.status === 'PAID' ? w.platformFeeUsd : 0;
        acc.pending += w.status === 'PENDING' ? 1 : 0;
        acc.approved += w.status === 'APPROVED' ? 1 : 0;
        acc.paid += w.status === 'PAID' ? 1 : 0;
        acc.rejected += w.status === 'REJECTED' ? 1 : 0;
        return acc;
      },
      { totalRequested: 0, totalPlatformFee: 0, totalPaidOutUsd: 0, totalPlatformEarnedUsd: 0, pending: 0, approved: 0, paid: 0, rejected: 0 },
    );

    return { ...totals, platformFeePct: PLATFORM_FEE_PCT, creditsPerUsd: CREDITS_PER_USD };
  }

  /** Admin approves a PENDING withdrawal → moves to APPROVED (ready for Stripe). */
  async approveWithdrawal(withdrawalId: string) {
    const w = await pw(this.prisma).findUnique({ where: { id: withdrawalId } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== 'PENDING') throw new BadRequestException(`Cannot approve — status is ${w.status}`);

    return pw(this.prisma).update({
      where: { id: withdrawalId },
      data: { status: 'APPROVED', processedAt: new Date() },
    });
  }

  /** Admin marks as PAID (manual bank transfer confirmed, or Stripe confirmed). */
  async markPaid(withdrawalId: string, stripeTransferId?: string) {
    const w = await pw(this.prisma).findUnique({ where: { id: withdrawalId } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== 'APPROVED' && w.status !== 'PROCESSING') {
      throw new BadRequestException(`Cannot mark paid — status is ${w.status}`);
    }
    return pw(this.prisma).update({
      where: { id: withdrawalId },
      data: { status: 'PAID', processedAt: new Date(), stripeTransferId: stripeTransferId ?? w.stripeTransferId },
    });
  }

  /** Admin rejects — credits returned to creator's bonusCredits. */
  async rejectWithdrawal(withdrawalId: string, notes: string) {
    const w = await pw(this.prisma).findUnique({ where: { id: withdrawalId } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== 'PENDING' && w.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot reject — status is ${w.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Return credits to creator and reverse withdrawnCredits
      await tx.wallet.update({
        where: { userId: w.userId },
        data: {
          bonusCredits: { increment: w.creditsRequested },
          withdrawnCredits: { decrement: w.creditsRequested },
        },
      });

      // Reverse platform fee from super admin wallet
      const superAdmin = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
      if (superAdmin && w.platformFeeCredits > 0) {
        await tx.wallet.update({
          where: { userId: superAdmin.id },
          data: { bonusCredits: { decrement: w.platformFeeCredits } },
        }).catch(() => {/* ignore if admin wallet has less */});
      }

      return pw(tx).update({
        where: { id: withdrawalId },
        data: { status: 'REJECTED', adminNotes: notes, processedAt: new Date() },
      });
    });
  }
}
