import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export type OrgAction = 'MANAGE_ORG' | 'MANAGE_BUDGET' | 'SPEND' | 'VIEW_REPORTS';

/**
 * Role-action matrix for org billing roles.
 *
 * ORG_ADMIN    → all actions
 * BILLING_ADMIN→ MANAGE_BUDGET + VIEW_REPORTS + SPEND
 * TEAM_MANAGER → SPEND + VIEW_REPORTS
 * MEMBER       → SPEND only
 */
export function orgRoleAllows(role: string, action: OrgAction): boolean {
  switch (role) {
    case 'ORG_ADMIN':
      return true;
    case 'BILLING_ADMIN':
      return action === 'MANAGE_BUDGET' || action === 'VIEW_REPORTS' || action === 'SPEND';
    case 'TEAM_MANAGER':
      return action === 'SPEND' || action === 'VIEW_REPORTS';
    case 'MEMBER':
      return action === 'SPEND';
    default:
      return false;
  }
}

/**
 * Find the index of the BudgetPeriod whose window contains `now`.
 * Returns -1 if none match. When periods overlap, returns the first match.
 */
export function currentPeriodFor(
  periods: Array<{ periodStart: Date; periodEnd: Date }>,
  now: Date,
): number {
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (p.periodStart <= now && now < p.periodEnd) return i;
  }
  return -1;
}

/**
 * Remaining credits in a budget period (floored at 0 — never negative).
 */
export function remainingCredits(allocated: number, consumed: number): number {
  return Math.max(0, allocated - consumed);
}

/**
 * Successor windows for an expired budget period (spec §14 budget-period-rollover).
 *
 * Each window has the same duration as `latest`, starts exactly where the
 * previous one ends, and windows are generated until one contains `now`
 * (so a long outage catches up in a single run).  `maxPeriods` bounds the
 * catch-up so a years-stale period can't explode into thousands of rows.
 *
 * Returns [] when `latest` has not ended yet or its duration is non-positive.
 */
export function rolloverWindows(
  latest: { periodStart: Date; periodEnd: Date },
  now: Date,
  maxPeriods = 12,
): Array<{ periodStart: Date; periodEnd: Date }> {
  const duration = latest.periodEnd.getTime() - latest.periodStart.getTime();
  if (duration <= 0 || latest.periodEnd > now) return [];

  const windows: Array<{ periodStart: Date; periodEnd: Date }> = [];
  let start = latest.periodEnd.getTime();
  while (windows.length < maxPeriods) {
    const end = start + duration;
    windows.push({ periodStart: new Date(start), periodEnd: new Date(end) });
    if (end > now.getTime()) break;
    start = end;
  }
  return windows;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface AddMemberDto {
  email: string;
  role?: string;
  teamId?: string;
  approvalRequired?: boolean;
}

export interface SetBudgetDto {
  teamId?: string;
  periodStart: Date;
  periodEnd: Date;
  allocatedCredits: number;
  hardCap?: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class OrgsService {
  private readonly logger = new Logger(OrgsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Org lifecycle ──────────────────────────────────────────────────────────

  async create(ownerUserId: string, name: string, billingEmail?: string) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { ownerUserId, name, billingEmail },
      });

      await tx.orgMembership.create({
        data: { orgId: org.id, userId: ownerUserId, role: 'ORG_ADMIN' },
      });

      this.logger.log(`[orgs] created org ${org.id} owner=${ownerUserId}`);
      return org;
    });
  }

  /** All orgs the user is a member of (any role). */
  async myOrgs(userId: string) {
    const memberships = await this.prisma.orgMembership.findMany({
      where: { userId },
      include: { org: true },
    });
    return memberships.map((m) => ({ ...m.org, role: m.role }));
  }

  // ── Membership management ─────────────────────────────────────────────────

  /**
   * Add (or update) a member.  Actor must hold MANAGE_ORG.
   * Target user is resolved by email — 404 if not registered.
   */
  async addMember(actorId: string, orgId: string, dto: AddMemberDto) {
    await this.requireOrgAction(actorId, orgId, 'MANAGE_ORG');
    if (dto.teamId) await this.assertTeamInOrg(orgId, dto.teamId);

    const target = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!target) throw new NotFoundException(`No user registered with email ${dto.email}`);

    const membership = await this.prisma.orgMembership.upsert({
      where: { orgId_userId: { orgId, userId: target.id } },
      create: {
        orgId,
        userId: target.id,
        role: dto.role ?? 'MEMBER',
        teamId: dto.teamId,
        approvalRequired: dto.approvalRequired ?? false,
      },
      update: {
        role: dto.role ?? 'MEMBER',
        teamId: dto.teamId,
        approvalRequired: dto.approvalRequired ?? false,
      },
    });

    this.logger.log(`[orgs] addMember org=${orgId} user=${target.id} role=${membership.role} actor=${actorId}`);
    return membership;
  }

  /** List all members. Any member of the org may call this. */
  async members(actorId: string, orgId: string) {
    await this.requireMembership(actorId, orgId);
    const memberships = await this.prisma.orgMembership.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    });
    // OrgMembership has no User relation in the schema; join manually so the
    // management UI can show who each row belongs to.
    const users = await this.prisma.user.findMany({
      where: { id: { in: memberships.map((m) => m.userId) } },
      select: { id: true, email: true, name: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return memberships.map((m) => ({
      ...m,
      email: byId.get(m.userId)?.email ?? null,
      name: byId.get(m.userId)?.name ?? null,
    }));
  }

  // ── Teams ─────────────────────────────────────────────────────────────────

  /** Create a team inside the org. Actor must hold MANAGE_ORG. */
  async createTeam(actorId: string, orgId: string, name: string) {
    await this.requireOrgAction(actorId, orgId, 'MANAGE_ORG');
    const team = await this.prisma.team.create({
      data: { name, ownerId: actorId, orgId },
    });
    this.logger.log(`[orgs] createTeam org=${orgId} team=${team.id} actor=${actorId}`);
    return team;
  }

  /** List the org's teams. Any member may call this. */
  async listTeams(actorId: string, orgId: string) {
    await this.requireMembership(actorId, orgId);
    return this.prisma.team.findMany({ where: { orgId }, orderBy: { createdAt: 'asc' } });
  }

  /**
   * A teamId sent to budget/member endpoints must name a team of THIS org —
   * a foreign or typo'd id would otherwise create a budget period that never
   * matches any member's teamId and silently never enforces.
   */
  private async assertTeamInOrg(orgId: string, teamId: string): Promise<void> {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, orgId }, select: { id: true } });
    if (!team) throw new BadRequestException('teamId does not name a team of this organisation');
  }

  // ── Budget management ─────────────────────────────────────────────────────

  /**
   * Create a BudgetPeriod for the org (optionally scoped to a team).
   * Validates: end > start, allocated >= 0.
   */
  async setBudget(actorId: string, orgId: string, dto: SetBudgetDto) {
    await this.requireOrgAction(actorId, orgId, 'MANAGE_BUDGET');
    if (dto.teamId) await this.assertTeamInOrg(orgId, dto.teamId);

    if (dto.periodEnd <= dto.periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }
    if (!Number.isInteger(dto.allocatedCredits) || dto.allocatedCredits < 0) {
      throw new BadRequestException('allocatedCredits must be a non-negative integer');
    }

    const period = await this.prisma.budgetPeriod.create({
      data: {
        orgId,
        teamId: dto.teamId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        allocatedCredits: dto.allocatedCredits,
        hardCap: dto.hardCap ?? true,
      },
    });

    this.logger.log(`[orgs] setBudget org=${orgId} team=${dto.teamId ?? 'org-wide'} credits=${dto.allocatedCredits} actor=${actorId}`);
    return period;
  }

  /**
   * Return budget status for the current period (optionally scoped to a team).
   * Falls back to org-wide period if no team-scoped one is found.
   */
  async budgetStatus(actorId: string, orgId: string, teamId?: string) {
    await this.requireMembership(actorId, orgId);

    const now = new Date();
    const periods = await this.prisma.budgetPeriod.findMany({
      where: { orgId, teamId: teamId ?? null },
      orderBy: { periodStart: 'asc' },
    });

    const idx = currentPeriodFor(periods, now);
    const period = idx >= 0 ? periods[idx] : null;

    return {
      period,
      remaining: period ? remainingCredits(period.allocatedCredits, period.consumedCredits) : null,
    };
  }

  // ── Budget rollover (spec §14 budget-period-rollover job) ────────────────

  /**
   * Open successor BudgetPeriods for every (org, team) whose latest period has
   * ended.  Without this, an expired period means `currentPeriod` finds
   * nothing and spend silently becomes unbudgeted.
   *
   * The successor copies allocation/hardCap from the expired period with
   * consumption reset; multiple missed windows are backfilled in one run
   * (bounded — see rolloverWindows).  Idempotent: a successor is only created
   * when no period already starts at the expired period's end, so replayed
   * runs are harmless.
   *
   * Returns the number of periods created (for job logging).
   */
  async rolloverExpiredBudgets(now = new Date()): Promise<number> {
    const groups = await this.prisma.budgetPeriod.groupBy({
      by: ['orgId', 'teamId'],
      _max: { periodEnd: true },
    });

    let created = 0;
    for (const g of groups) {
      const latestEnd = g._max.periodEnd;
      if (!latestEnd || latestEnd > now) continue; // current period still open

      const latest = await this.prisma.budgetPeriod.findFirst({
        where: { orgId: g.orgId, teamId: g.teamId ?? null, periodEnd: latestEnd },
        orderBy: { periodStart: 'desc' },
      });
      if (!latest) continue;

      const windows = rolloverWindows(latest, now);
      if (windows.length === 0) continue;

      // Idempotency guard: another run may have rolled this group already.
      const successor = await this.prisma.budgetPeriod.findFirst({
        where: { orgId: g.orgId, teamId: g.teamId ?? null, periodStart: { gte: latest.periodEnd } },
      });
      if (successor) continue;

      await this.prisma.budgetPeriod.createMany({
        data: windows.map((w) => ({
          orgId: g.orgId,
          teamId: g.teamId,
          periodStart: w.periodStart,
          periodEnd: w.periodEnd,
          allocatedCredits: latest.allocatedCredits,
          hardCap: latest.hardCap,
        })),
      });
      created += windows.length;

      await this.notifyAdmins(g.orgId, {
        type: 'org.budget.rollover',
        title: 'Budget period rolled over',
        body: `A new ${latest.allocatedCredits}-credit budget period has started${g.teamId ? ' for your team' : ''}`,
        meta: { orgId: g.orgId, teamId: g.teamId, allocatedCredits: latest.allocatedCredits, periods: windows.length },
      });

      this.logger.log(
        `[orgs] budget rollover org=${g.orgId} team=${g.teamId ?? 'org-wide'} periods=${windows.length}`,
      );
    }
    return created;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async currentPeriod(orgId: string, teamId: string | undefined, now: Date) {
    const periods = await this.prisma.budgetPeriod.findMany({
      where: {
        orgId,
        teamId: teamId ?? null,
        periodStart: { lte: now },
        periodEnd: { gt: now },
      },
      orderBy: { periodStart: 'asc' },
      take: 1,
    });
    return periods[0] ?? null;
  }

  private async requireMembership(userId: string, orgId: string) {
    const m = await this.prisma.orgMembership.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!m) throw new ForbiddenException('Not a member of this organisation');
    return m;
  }

  private async requireOrgAction(userId: string, orgId: string, action: OrgAction) {
    const m = await this.requireMembership(userId, orgId);
    if (!orgRoleAllows(m.role, action)) {
      throw new ForbiddenException(`Role ${m.role} cannot perform ${action}`);
    }
    return m;
  }

  private async notifyManagers(
    orgId: string,
    teamId: string | undefined,
    payload: { type: string; title: string; body: string; meta: Record<string, unknown> },
  ) {
    const managers = await this.prisma.orgMembership.findMany({
      where: {
        orgId,
        role: { in: ['ORG_ADMIN', 'TEAM_MANAGER'] },
        ...(teamId ? { teamId } : {}),
      },
      select: { userId: true },
    });
    for (const m of managers) {
      // notify is guaranteed non-throwing
      await this.notifications.notify(m.userId, payload.type, payload.title, payload.body, payload.meta);
    }
  }

  private async notifyAdmins(
    orgId: string,
    payload: { type: string; title: string; body: string; meta: Record<string, unknown> },
  ) {
    const admins = await this.prisma.orgMembership.findMany({
      where: { orgId, role: { in: ['ORG_ADMIN', 'BILLING_ADMIN'] } },
      select: { userId: true },
    });
    for (const a of admins) {
      await this.notifications.notify(a.userId, payload.type, payload.title, payload.body, payload.meta);
    }
  }
}
