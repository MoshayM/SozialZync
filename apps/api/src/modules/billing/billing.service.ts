import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { Plan } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const PLAN_PRICE_IDS: Record<string, string> = {
  STARTER: process.env['STRIPE_STARTER_PRICE_ID'] ?? '',
  PRO: process.env['STRIPE_PRO_PRICE_ID'] ?? '',
  AGENCY: process.env['STRIPE_AGENCY_PRICE_ID'] ?? '',
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private _stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private get stripe(): Stripe {
    if (!this._stripe) {
      const key = process.env['STRIPE_SECRET_KEY'];
      if (!key) throw new BadRequestException('Billing is not configured (STRIPE_SECRET_KEY missing)');
      const base = process.env['STRIPE_API_BASE'];
      let hostOpts: Pick<Stripe.StripeConfig, 'host' | 'port' | 'protocol'> = {};
      if (base) {
        const u = new URL(base);
        hostOpts = { host: u.hostname, port: Number(u.port || (u.protocol === 'https:' ? 443 : 80)), protocol: u.protocol.replace(':', '') as 'http' | 'https' };
      }
      this._stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia', ...hostOpts });
    }
    return this._stripe;
  }

  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (sub) return sub.stripeCustomerId;

    const customer = await this.stripe.customers.create({ email, metadata: { userId } });
    await this.prisma.subscription.create({
      data: {
        userId,
        stripeCustomerId: customer.id,
        plan: 'FREE',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return customer.id;
  }

  async createCheckoutSession(userId: string, email: string, plan: string, successUrl: string, cancelUrl: string) {
    const priceId = PLAN_PRICE_IDS[plan];
    if (!priceId) throw new BadRequestException('Invalid plan');
    const customerId = await this.getOrCreateCustomer(userId, email);
    return this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: { userId, plan },
    });
  }

  async handleWebhook(payload: Buffer | undefined, signature: string) {
    const secret = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
    if (!payload) {
      throw new BadRequestException('Webhook raw body unavailable (rawBody not enabled)');
    }
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      await this.handleConnectAccountUpdated({ id: account.id, charges_enabled: account.charges_enabled });
      this.logger.log(`[connect/main] account ${account.id} updated — charges_enabled: ${account.charges_enabled}`);
      return;
    }

    // §6.2: dedupe on the gateway's event id
    try {
      await this.prisma.webhookEvent.create({
        data: { gateway: 'STRIPE', eventId: event.id, eventType: event.type },
      });
    } catch {
      this.logger.log(`[webhook] duplicate ${event.type} ${event.id} — ignored`);
      return;
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const sub = event.data.object as Stripe.Subscription;
      await this.prisma.subscription.updateMany({
        where: { stripeCustomerId: sub.customer as string },
        data: {
          stripeSubscriptionId: sub.id,
          status: sub.status.toUpperCase() as 'ACTIVE',
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        await this.prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: { status: 'PAST_DUE' },
        });
        const sub = await this.prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
        if (sub) {
          this.notifications.notify(
            sub.userId,
            'billing.payment_failed',
            'Payment failed',
            'Your subscription payment failed. Please update your payment method to keep access.',
            { customerId, invoiceId: typeof invoice.id === 'string' ? invoice.id : '' },
          ).catch(() => undefined);
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      await this.prisma.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: { status: 'CANCELLED', plan: 'FREE', cancelAtPeriodEnd: false },
      });
    }
  }

  async getSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (sub) return sub;
    return {
      plan: 'FREE',
      status: 'ACTIVE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
    };
  }

  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeSubscriptionId) throw new BadRequestException('No active subscription found');
    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    await this.prisma.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd: true } });
    return { cancelAtPeriodEnd: true, currentPeriodEnd: sub.currentPeriodEnd };
  }

  async changePlan(userId: string, newPlan: string) {
    const priceId = PLAN_PRICE_IDS[newPlan];
    if (!priceId) throw new BadRequestException('Invalid plan');
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeSubscriptionId) throw new BadRequestException('No active subscription found');

    const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) throw new BadRequestException('Subscription has no items');

    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
    });
    await this.prisma.subscription.update({ where: { userId }, data: { plan: newPlan as Plan } });
    return { plan: newPlan };
  }

  async resumeSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeSubscriptionId) throw new BadRequestException('No active subscription found');
    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
    await this.prisma.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd: false } });
    return { cancelAtPeriodEnd: false };
  }

  async getBillingPortalUrl(userId: string, returnUrl: string): Promise<{ url: string }> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeCustomerId) throw new BadRequestException('No billing record found');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  // ── Stripe Connect (creator payout onboarding) ────────────────────────────

  async getConnectStatus(userId: string): Promise<{ connected: boolean; chargesEnabled: boolean; accountId: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectAccountId: true, stripeConnectEnabled: true },
    });
    return {
      connected: !!user?.stripeConnectAccountId,
      chargesEnabled: user?.stripeConnectEnabled ?? false,
      accountId: user?.stripeConnectAccountId ?? null,
    };
  }

  async createConnectOnboardingLink(userId: string, email: string, returnUrl: string, refreshUrl: string): Promise<{ url: string }> {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectAccountId: true },
    });

    let accountId = user?.stripeConnectAccountId ?? null;
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email,
        capabilities: { transfers: { requested: true } },
        metadata: { userId },
      });
      accountId = account.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeConnectAccountId: accountId },
      });
    }

    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return { url: link.url };
  }

  async handleConnectWebhook(payload: Buffer | undefined, signature: string): Promise<void> {
    const secret = process.env['STRIPE_CONNECT_WEBHOOK_SECRET'] ?? '';
    if (!payload) throw new BadRequestException('Webhook raw body unavailable');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
      throw new BadRequestException(
        `Connect webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      await this.handleConnectAccountUpdated({ id: account.id, charges_enabled: account.charges_enabled });
      this.logger.log(`[connect] account ${account.id} updated — charges_enabled: ${account.charges_enabled}`);
    }
  }

  async handleConnectAccountUpdated(account: { id: string; charges_enabled: boolean }): Promise<void> {
    await this.prisma.user.updateMany({
      where: { stripeConnectAccountId: account.id },
      data: { stripeConnectEnabled: account.charges_enabled },
    });
  }

  async transferToCreator(withdrawalId: string, userId: string, amountUsd: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectAccountId: true, stripeConnectEnabled: true },
    });
    if (!user?.stripeConnectAccountId) {
      throw new BadRequestException('Creator has not completed Stripe Connect onboarding');
    }
    if (!user.stripeConnectEnabled) {
      throw new BadRequestException('Creator\'s Stripe Connect account is not yet verified');
    }
    const amountCents = Math.round(amountUsd * 100);
    if (amountCents < 100) {
      throw new BadRequestException('Transfer amount must be at least $1.00');
    }
    const transfer = await this.stripe.transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: user.stripeConnectAccountId,
      metadata: { withdrawalId, userId },
    });
    this.logger.log(`Stripe transfer ${transfer.id} → ${user.stripeConnectAccountId} for $${amountUsd.toFixed(2)} (withdrawal ${withdrawalId})`);
    return transfer.id;
  }

  /** Mark stale PENDING Stripe checkout sessions as FAILED. No credit granting. */
  async reconcilePendingPayments(): Promise<{ checked: number; expired: number }> {
    if (!process.env['STRIPE_SECRET_KEY']) return { checked: 0, expired: 0 };
    const stale = await this.prisma.payment.findMany({
      where: { gateway: 'STRIPE', status: 'PENDING', createdAt: { lt: new Date(Date.now() - 60 * 60_000) } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    let expired = 0;
    for (const p of stale) {
      if (!p.gatewayPaymentId?.startsWith('cs_')) continue;
      try {
        const session = await this.stripe.checkout.sessions.retrieve(p.gatewayPaymentId);
        if (session.status === 'expired') {
          await this.prisma.payment.update({
            where: { id: p.id },
            data: { status: 'FAILED', failureReason: 'checkout session expired' },
          });
          expired += 1;
        }
      } catch (err) {
        this.logger.warn(`[reconcile] payment ${p.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { checked: stale.length, expired };
  }

  /** Refund a payment via Stripe. No credit claw-back — credits system removed. */
  async refundPayment(paymentId: string, adminId: string, reason: string, amountMinor?: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.gateway !== 'STRIPE') {
      return { ok: false, reason: 'Refund not supported for this payment gateway — contact support.' };
    }
    if (payment.status !== 'SUCCEEDED' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new BadRequestException(`Payment is ${payment.status} — only succeeded payments can be refunded`);
    }
    if (!payment.gatewayPaymentId?.startsWith('pi_')) {
      throw new BadRequestException('Payment has no settled payment intent to refund against');
    }
    const refundMinor = amountMinor ?? payment.amount;
    if (!Number.isInteger(refundMinor) || refundMinor < 1 || refundMinor > payment.amount) {
      throw new BadRequestException('Refund amount must be between 1 and the original payment amount (minor units)');
    }

    await this.stripe.refunds.create(
      { payment_intent: payment.gatewayPaymentId, amount: refundMinor, reason: 'requested_by_customer' },
      { idempotencyKey: `refund:${payment.id}:${refundMinor}` },
    );

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: refundMinor === payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'admin:refund',
        target: payment.id,
        meta: { reason, refundMinor, currency: payment.currency, before: { status: payment.status }, after: { status: updated.status } } as never,
      },
    });
    this.logger.warn(`[refund] ${payment.id}: ${refundMinor} ${payment.currency} refunded`);
    return { paymentId: payment.id, status: updated.status, refundedMinor: refundMinor };
  }
}
