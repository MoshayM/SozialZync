import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UpgradeService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecommendations(userId: string) {
    return this.prisma.upgradeRecommendation.findMany({
      where: { userId, dismissedAt: null, converted: false },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      select: { id: true, reasonCode: true, recommendedPlan: true, confidence: true, createdAt: true },
    });
  }

  async dismiss(id: string, userId: string): Promise<{ dismissed: boolean }> {
    const rec = await this.prisma.upgradeRecommendation.findFirst({ where: { id, userId } });
    if (!rec) throw new NotFoundException('Recommendation not found');
    await this.prisma.upgradeRecommendation.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });
    return { dismissed: true };
  }
}
