import { Body, Controller, Get, Param, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { BillingService } from './billing.service';
import { decodeCursor, keysetWhereDesc, clampLimit, pageResult } from '../../common/pagination/cursor';

class RefundDto {
  @IsString() @MinLength(5) reason!: string;
  /** Minor units; omit for a full refund. */
  @IsOptional() @IsInt() @Min(1) amountMinor?: number;
}

class AdjustWalletDto {
  @IsString() userId!: string;
  /** Positive = grant, negative = claw back. */
  @IsInt() amount!: number;
  @IsString() @MinLength(5) reason!: string;
  @IsIn(['BONUS', 'PROMO', 'ADJUSTMENT']) entryType!: 'BONUS' | 'PROMO' | 'ADJUSTMENT';
}

class UpsertAdminUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(['SUPER_ADMIN', 'OWNER']) role?: 'SUPER_ADMIN' | 'OWNER';
}

class TransferRecordsDto {
  @IsEmail() sourceEmail!: string;
  @IsEmail() targetEmail!: string;
}

/**
 * Super Admin surface (billing spec §10) — permission-string RBAC, never
 * email/role checks in handlers. Every sensitive action lands in audit_logs
 * BEFORE the response (§9.7).
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly billing: BillingService,
  ) {}

  @Get('billing/revenue')
  @RequirePermissions('admin:revenue')
  async revenue(@Query('days') days?: string) {
    const since = new Date(Date.now() - (Math.min(Number(days) || 30, 365)) * 24 * 60 * 60 * 1000);
    const [succeeded, byGateway] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', createdAt: { gte: since } },
        _sum: { amount: true, creditsGranted: true },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['gateway'],
        where: { status: 'SUCCEEDED', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      sinceDays: Math.min(Number(days) || 30, 365),
      payments: succeeded._count,
      grossMinorUnits: succeeded._sum.amount ?? 0,
      creditsGranted: succeeded._sum.creditsGranted ?? 0,
      byGateway: byGateway.map((g) => ({ gateway: g.gateway, payments: g._count, grossMinorUnits: g._sum.amount ?? 0 })),
    };
  }

  @Get('audit-logs')
  @RequirePermissions('admin:audit-logs')
  async auditLogs(@Query('take') take?: string, @Query('cursor') cursor?: string) {
    const limit = clampLimit(take !== undefined ? parseInt(take, 10) : undefined, 100, 500);
    const rows = await this.prisma.auditLog.findMany({
      where: keysetWhereDesc('createdAt', decodeCursor(cursor)),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return pageResult(rows, limit, (r) => r.createdAt);
  }

  @Get('users')
  @RequirePermissions('admin:users')
  async users() {
    return this.prisma.user.findMany({
      select: {
        id: true, email: true, name: true, role: true, createdAt: true,
        rechargesFrozen: true,
        wallet: { select: { balanceCredits: true, lifetimePurchased: true, lifetimeUsed: true } },
        subscription: { select: { plan: true, status: true } },
        _count: { select: { channels: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('users/:userId/recharges-frozen')
  @RequirePermissions('admin:users')
  async setRechargesFrozen(
    @Param('userId') userId: string,
    @Body() dto: { frozen: boolean; reason?: string },
    @CurrentUser() admin: JwtPayload,
  ) {
    if (typeof dto.frozen !== 'boolean') throw new BadRequestException('frozen must be a boolean');
    const before = await this.prisma.user.findUnique({ where: { id: userId }, select: { rechargesFrozen: true } });
    if (!before) throw new BadRequestException('User not found');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { rechargesFrozen: dto.frozen },
      select: { id: true, email: true, rechargesFrozen: true },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: admin.sub,
        action: 'admin:recharges-frozen',
        target: userId,
        meta: { reason: dto.reason ?? null, before: before.rechargesFrozen, after: user.rechargesFrozen } as never,
      },
    });
    return user;
  }

  @Post('payments/:paymentId/refund')
  @RequirePermissions('billing:refund')
  async refund(
    @Param('paymentId') paymentId: string,
    @Body() dto: RefundDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.billing.refundPayment(paymentId, admin.sub, dto.reason, dto.amountMinor);
  }

  @Post('wallet/adjust')
  @RequirePermissions('wallet:adjust')
  async adjustWallet(@Body() dto: AdjustWalletDto, @CurrentUser() admin: JwtPayload) {
    if (dto.amount === 0) throw new BadRequestException('Adjustment amount cannot be zero');
    const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!target) throw new BadRequestException('User not found');

    const before = await this.wallet.getBalance(dto.userId);
    const idempotencyKey = `admin:${admin.sub}:${dto.userId}:${dto.entryType}:${dto.amount}:${dto.reason}`;
    const entry = dto.amount > 0
      ? await this.wallet.credit(dto.userId, {
          entryType: dto.entryType === 'ADJUSTMENT' ? 'BONUS' : dto.entryType,
          amount: dto.amount,
          referenceType: 'ADMIN_ACTION',
          referenceId: admin.sub,
          idempotencyKey,
          metadata: { reason: dto.reason, adminId: admin.sub },
        })
      : await this.wallet.debit(dto.userId, {
          entryType: 'ADJUSTMENT',
          amount: -dto.amount,
          referenceType: 'ADMIN_ACTION',
          referenceId: admin.sub,
          idempotencyKey,
          metadata: { reason: dto.reason, adminId: admin.sub },
        });
    const after = await this.wallet.getBalance(dto.userId);

    // §9.7: audit synchronously before the action is considered complete
    await this.prisma.auditLog.create({
      data: {
        userId: admin.sub,
        action: 'admin:wallet-adjust',
        target: dto.userId,
        meta: { reason: dto.reason, amount: dto.amount, entryType: dto.entryType, before, after } as never,
      },
    });
    return { entry, before: before.balanceCredits, after: after.balanceCredits };
  }

  /** POST /admin/users/upsert
   * Create or update an admin user with a specific email, password, and role.
   * Creates the account if it doesn't exist; updates password + role if it does.
   */
  @Post('users/upsert')
  @RequirePermissions('admin:users')
  async upsertAdminUser(@Body() dto: UpsertAdminUserDto, @CurrentUser() admin: JwtPayload) {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const role = dto.role ?? 'SUPER_ADMIN';

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, role: true },
    });

    let user;
    if (existing) {
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, role, name: dto.name ?? undefined },
        select: { id: true, email: true, role: true, name: true },
      });
    } else {
      user = await this.prisma.user.create({
        data: { email, passwordHash, role, name: dto.name ?? email.split('@')[0], emailVerified: new Date() },
        select: { id: true, email: true, role: true, name: true },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: admin.sub,
        action: existing ? 'admin:user-updated' : 'admin:user-created',
        target: user.id,
        meta: { email, role, by: admin.email } as never,
      },
    });

    return { ...user, action: existing ? 'updated' : 'created' };
  }

  /** POST /admin/users/transfer-records
   * Transfer all content records from sourceEmail to targetEmail.
   * Moves: Channels, Projects, Videos, Scripts, ImportedVideos, Assets, EditProjects.
   */
  @Post('users/transfer-records')
  @RequirePermissions('admin:users')
  async transferRecords(@Body() dto: TransferRecordsDto, @CurrentUser() admin: JwtPayload) {
    const [src, tgt] = await Promise.all([
      this.prisma.user.findFirst({ where: { email: { equals: dto.sourceEmail.trim().toLowerCase(), mode: 'insensitive' } }, select: { id: true, email: true } }),
      this.prisma.user.findFirst({ where: { email: { equals: dto.targetEmail.trim().toLowerCase(), mode: 'insensitive' } }, select: { id: true, email: true } }),
    ]);
    if (!src) throw new BadRequestException(`Source user not found: ${dto.sourceEmail}`);
    if (!tgt) throw new BadRequestException(`Target user not found: ${dto.targetEmail}`);
    if (src.id === tgt.id) throw new BadRequestException('Source and target are the same user');

    const [channels, projects, videos, assets, editProjects, importedVideos] = await Promise.all([
      this.prisma.channel.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } }),
      this.prisma.project.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } }),
      this.prisma.video.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } }),
      this.prisma.asset.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } }),
      this.prisma.editProject.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } }),
      this.prisma.importedVideo.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } }),
    ]);

    const summary = {
      channels: channels.count,
      projects: projects.count,
      videos: videos.count,
      assets: assets.count,
      editProjects: editProjects.count,
      importedVideos: importedVideos.count,
    };

    await this.prisma.auditLog.create({
      data: {
        userId: admin.sub,
        action: 'admin:transfer-records',
        target: tgt.id,
        meta: { from: src.email, to: tgt.email, summary, by: admin.email } as never,
      },
    });

    return { from: src.email, to: tgt.email, transferred: summary };
  }
}
