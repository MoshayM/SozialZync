import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../../common/prisma/prisma.service';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Shape of a Web Push subscription as sent by the browser's
 * PushManager.subscribe() call.
 */
export interface PushSubscriptionDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Wraps the `web-push` library for VAPID-authenticated Web Push.
 *
 * Subscriptions are stored in `pushSubscription` (not yet in the Prisma schema;
 * access goes through `(this.prisma as any).pushSubscription` — the same
 * pattern used by otpCode, passwordResetToken, etc. — until the migration is
 * added and `prisma generate` is re-run).
 *
 * All public methods are fire-and-forget-safe: they catch and log errors so
 * that push failures never propagate to callers.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  /** True when all required VAPID env vars are present and webpush is configured. */
  private readonly configured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env['VAPID_PUBLIC_KEY'];
    const privateKey = process.env['VAPID_PRIVATE_KEY'];
    const email = process.env['VAPID_EMAIL'];

    if (publicKey && privateKey && email) {
      webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
      this.configured = true;
    } else {
      this.logger.warn(
        '[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_EMAIL not set — push disabled',
      );
      this.configured = false;
    }
  }

  /**
   * One-time helper: generates a fresh VAPID key pair.
   * Run once, persist the output to env vars; never call in hot path.
   */
  generateVapidKeys(): { publicKey: string; privateKey: string } {
    return webpush.generateVAPIDKeys();
  }

  /** Exposes the VAPID public key so the frontend can subscribe. */
  getPublicKey(): string {
    return process.env['VAPID_PUBLIC_KEY'] ?? '';
  }

  /**
   * Upsert a push subscription for a user.
   * If a row with the same endpoint already exists, its keys are refreshed.
   */
  async saveSubscription(userId: string, sub: PushSubscriptionDto): Promise<void> {
    try {
      // @reason: pushSubscription model not yet generated in Prisma client; using dynamic accessor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (this.prisma as any).pushSubscription;
      await table.upsert({
        where: { endpoint: sub.endpoint },
        create: {
          userId,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
        update: {
          userId,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      });
    } catch (err) {
      this.logger.warn(
        `[push] saveSubscription failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Remove a subscription by endpoint (called on unsubscribe or 410 Gone). */
  async removeSubscription(endpoint: string): Promise<void> {
    try {
      // @reason: pushSubscription model not yet generated in Prisma client; using dynamic accessor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.prisma as any).pushSubscription.deleteMany({
        where: { endpoint },
      });
    } catch (err) {
      this.logger.warn(
        `[push] removeSubscription failed for ${endpoint}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Send a push notification to all registered subscriptions for a user.
   *
   * Stale subscriptions (HTTP 410 Gone / 404) are automatically cleaned up.
   * Any other send error is logged but never thrown — push is best-effort.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.configured) return;

    let subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>;
    try {
      // @reason: pushSubscription model not yet generated in Prisma client; using dynamic accessor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subscriptions = await (this.prisma as any).pushSubscription.findMany({
        where: { userId },
        select: { endpoint: true, p256dh: true, auth: true },
      });
    } catch (err) {
      this.logger.warn(
        `[push] failed to fetch subscriptions for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (err) {
          // @reason: webpush throws WebPushError with statusCode; using any to access it without importing private type
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const statusCode = (err as any)?.statusCode as number | undefined;
          if (statusCode === 410 || statusCode === 404) {
            // Subscription expired — remove it silently
            await this.removeSubscription(sub.endpoint);
          } else {
            this.logger.warn(
              `[push] send failed for endpoint ${sub.endpoint}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }),
    );
  }
}
