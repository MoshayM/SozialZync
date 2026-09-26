import { Body, Controller, Get, Param, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingService } from './billing.service';
import { decodeCursor, keysetWhereDesc, clampLimit, pageResult } from '../../common/pagination/cursor';

class RefundDto {
  @IsString() @MinLength(5) reason!: string;
  @IsOptional() @IsInt() @Min(1) amountMinor?: number;
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

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  @Get('billing/revenue')
  @RequirePermissions('admin:revenue')
  async revenue(@Query('days') days?: string) {
    const since = new Date(Date.now() - (Math.min(Number(days) || 30, 365)) * 24 * 60 * 60 * 1000);
    const [succeeded, byGateway] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', createdAt: { gte: since } },
        _sum: { amount: true },
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
        subscription: { select: { plan: true, status: true } },
        _count: { select: { channels: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
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

    const [channels, projects] = await Promise.all([
      this.prisma.channel.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } }),
      this.prisma.project.updateMany({ where: { userId: src.id }, data: { userId: tgt.id } }),
    ]);

    const summary = { channels: channels.count, projects: projects.count };

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
