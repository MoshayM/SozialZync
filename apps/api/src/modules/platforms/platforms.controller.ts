import {
  Body, Controller, Delete, Get, NotFoundException,
  Param, Post, UseGuards, BadRequestException, UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PlatformRegistryService } from './platform-registry.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const WATCH_SUPPORTED_PLATFORMS = ['youtube', 'facebook', 'instagram', 'tiktok', 'x', 'linkedin', 'threads'];

@Controller('platforms')
@UseGuards(JwtAuthGuard)
export class PlatformsController {
  constructor(
    private readonly registry: PlatformRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  listPlatforms() {
    return this.registry.listProviders();
  }

  @Get('connection-status')
  async getConnectionStatuses(@CurrentUser() user: JwtPayload) {
    return this.registry.getAllConnectionStatuses(user.sub);
  }

  @Post(':platform/watch')
  async watchAccount(
    @CurrentUser() user: JwtPayload,
    @Param('platform') platform: string,
    @Body() body: { handle: string },
  ) {
    if (!WATCH_SUPPORTED_PLATFORMS.includes(platform)) {
      throw new NotFoundException(`Platform "${platform}" is not supported`);
    }
    const handle = (body.handle ?? '').trim();
    if (!handle) throw new BadRequestException('handle is required');

    const accountId = handle.startsWith('@') ? handle : `@${handle}`;

    const row = await this.prisma.platformConnection.upsert({
      where: { userId_platformId_accountId: { userId: user.sub, platformId: platform, accountId } },
      create: {
        userId: user.sub,
        platformId: platform,
        accountId,
        accountName: accountId,
        encryptedTokens: 'WATCH',
        readOnly: true,
      },
      update: { accountName: accountId, updatedAt: new Date() },
    });

    return { id: row.id, handle: accountId, platform, addedAt: row.createdAt };
  }

  @Delete(':platform/watch/:id')
  async unwatchAccount(
    @CurrentUser() user: JwtPayload,
    @Param('platform') platform: string,
    @Param('id') id: string,
  ) {
    const row = await this.prisma.platformConnection.findUnique({
      where: { id },
      select: { userId: true, platformId: true, readOnly: true },
    });

    if (!row) throw new NotFoundException('Watch account not found');
    if (row.userId !== user.sub) throw new UnauthorizedException('Forbidden');
    if (!row.readOnly) throw new BadRequestException('This is an OAuth connection — use the disconnect endpoint');
    if (row.platformId !== platform) throw new BadRequestException('Platform mismatch');

    await this.prisma.platformConnection.delete({ where: { id } });
    return { ok: true };
  }

  @Delete(':platform/disconnect')
  async disconnectPlatform(
    @CurrentUser() user: JwtPayload,
    @Param('platform') platform: string,
  ) {
    const provider = this.registry.getProvider(platform);
    if (!provider) throw new NotFoundException(`Platform "${platform}" is not supported`);
    await provider.disconnect(user.sub);
    return { ok: true };
  }
}
