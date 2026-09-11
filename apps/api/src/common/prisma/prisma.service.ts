import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const SLOW_QUERY_MS = 1_000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: [{ emit: 'event', level: 'query' }] });
    // Log queries that exceed the slow-query threshold so they surface in
    // structured logs and Grafana without needing a separate APM agent.
    (this as unknown as { $on: (event: string, cb: (e: { duration: number; query: string }) => void) => void })
      .$on('query', (e) => {
        if (e.duration >= SLOW_QUERY_MS) {
          this.logger.warn(`Slow query ${e.duration}ms`, {
            durationMs: e.duration,
            query: e.query.slice(0, 300),
          });
        }
      });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      // Log but do not crash the process — lets the API start and return 503
      // on DB-dependent routes rather than failing all routes at cold start.
      this.logger.error('Database connection failed at startup', err instanceof Error ? err.message : String(err));
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
