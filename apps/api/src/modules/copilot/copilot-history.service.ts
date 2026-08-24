import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const MAX_SESSIONS_PER_USER = 20;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class CopilotHistoryService {
  private readonly logger = new Logger(CopilotHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, sessionId: string, title: string, messages: unknown[]): Promise<void> {
    await this.prisma.copilotChatSession.upsert({
      where: { userId_sessionId: { userId, sessionId } },
      create: { userId, sessionId, title, messages: messages as never }, // @reason: Prisma Json field
      update: { title, messages: messages as never }, // @reason: Prisma Json field
    });
    await this.pruneOldSessions(userId);
  }

  async list(userId: string): Promise<{ id: string; title: string; messages: unknown[]; updatedAt: string }[]> {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    const rows = await this.prisma.copilotChatSession.findMany({
      where: { userId, updatedAt: { gte: cutoff } },
      orderBy: { updatedAt: 'desc' },
      take: MAX_SESSIONS_PER_USER,
    });
    return rows.map((r) => ({
      id: r.sessionId,
      title: r.title,
      messages: r.messages as unknown[],
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  private async pruneOldSessions(userId: string): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
      await this.prisma.copilotChatSession.deleteMany({
        where: { userId, updatedAt: { lt: cutoff } },
      });
      const rows = await this.prisma.copilotChatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (rows.length > MAX_SESSIONS_PER_USER) {
        const toDelete = rows.slice(MAX_SESSIONS_PER_USER).map((r) => r.id);
        await this.prisma.copilotChatSession.deleteMany({ where: { id: { in: toDelete } } });
      }
    } catch (err) {
      this.logger.warn(`[history] prune failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
