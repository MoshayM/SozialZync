import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { randomBytes } from 'crypto';

const REFERRER_CREDITS = 50;
const REFERRED_CREDITS = 25;

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async getOrCreateCode(userId: string): Promise<{ code: string }> {
    const existing = await this.prisma.referralCode.findUnique({ where: { userId } });
    if (existing) return { code: existing.code };
    const code = randomBytes(6).toString('base64url').toUpperCase().slice(0, 8);
    const created = await this.prisma.referralCode.create({ data: { userId, code } });
    this.logger.log(`Referral code created: user=${userId} code=${code}`);
    return { code: created.code };
  }

  async redeem(code: string, userId: string): Promise<{ ok: boolean; message: string }> {
    const referralCode = await this.prisma.referralCode.findUnique({ where: { code } });
    if (!referralCode || !referralCode.isActive) {
      return { ok: false, message: 'Invalid or inactive referral code.' };
    }
    if (referralCode.userId === userId) {
      return { ok: false, message: 'You cannot use your own referral code.' };
    }
    const already = await this.prisma.referral.findUnique({ where: { referredId: userId } });
    if (already) {
      return { ok: false, message: 'You have already used a referral code.' };
    }

    const referral = await this.prisma.referral.create({
      data: {
        referrerId: referralCode.userId,
        referredId: userId,
        codeId: referralCode.id,
        status: 'QUALIFIED',
        qualifiedAt: new Date(),
      },
    });
    await this.prisma.referralCode.update({
      where: { id: referralCode.id },
      data: { usesCount: { increment: 1 } },
    });

    // Grant credits to referred user
    await this.wallet.credit(userId, {
      entryType: 'REFERRAL',
      referenceType: 'REFERRAL',
      referenceId: referral.id,
      amount: REFERRED_CREDITS,
      idempotencyKey: `referral:referred:${referral.id}`,
    });

    // Grant credits to referrer
    await this.wallet.credit(referralCode.userId, {
      entryType: 'REFERRAL',
      referenceType: 'REFERRAL',
      referenceId: referral.id,
      amount: REFERRER_CREDITS,
      idempotencyKey: `referral:referrer:${referral.id}`,
    });

    this.logger.log(`Referral redeemed: referrer=${referralCode.userId} referred=${userId} code=${code}`);
    return { ok: true, message: `You've been referred! ${REFERRED_CREDITS} credits added to your wallet.` };
  }

  async getEarnings(userId: string) {
    const [codeRow, referrals] = await Promise.all([
      this.prisma.referralCode.findUnique({ where: { userId } }),
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        include: { rewards: { where: { beneficiaryId: userId } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const totalCredits = referrals.flatMap((r) => r.rewards).reduce((s, rw) => s + rw.credits, 0);
    return {
      code: codeRow?.code ?? null,
      totalCredits,
      qualifiedCount: referrals.filter((r) => r.status === 'QUALIFIED' || r.status === 'REWARDED').length,
      pendingCount: referrals.filter((r) => r.status === 'PENDING').length,
      flaggedCount: referrals.filter((r) => r.status === 'FLAGGED').length,
      referrals: referrals.map((r) => ({
        id: r.id,
        status: r.status,
        reward: r.rewards.reduce((s, rw) => s + rw.credits, 0),
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async getLeaderboard() {
    const rows = await this.prisma.referral.groupBy({
      by: ['referrerId'],
      where: { status: { in: ['QUALIFIED', 'REWARDED'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const userIds = rows.map((r) => r.referrerId);
    const rewards = await this.prisma.referralReward.groupBy({
      by: ['beneficiaryId'],
      where: { beneficiaryId: { in: userIds }, kind: 'REFERRER' },
      _sum: { credits: true },
    });
    const rewardMap = Object.fromEntries(rewards.map((r) => [r.beneficiaryId, r._sum.credits ?? 0]));
    return rows.map((r, i) => ({
      rank: i + 1,
      userLabel: `Creator #${r.referrerId.slice(-4).toUpperCase()}`,
      qualifiedCount: r._count.id,
      totalCredits: rewardMap[r.referrerId] ?? 0,
    }));
  }
}
