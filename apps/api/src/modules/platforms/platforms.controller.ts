import {
  Body, Controller, Delete, Get, NotFoundException, Logger,
  Param, Post, UseGuards, BadRequestException, UnauthorizedException,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PlatformRegistryService } from './platform-registry.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const WATCH_SUPPORTED_PLATFORMS = ['youtube', 'facebook', 'instagram', 'tiktok', 'x', 'linkedin', 'threads'];

class PlatformPublishDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  /** r2Key of the rendered video asset — resolved to a public URL server-side */
  @IsOptional() @IsString() r2Key?: string;
  /** Fallback: asset version ID (used to construct media URL when r2Key not directly known) */
  @IsOptional() @IsString() versionId?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() privacyStatus?: 'public' | 'private' | 'unlisted';
  @IsOptional() @IsBoolean() containsSyntheticMedia?: boolean;
}

@Controller('platforms')
@UseGuards(JwtAuthGuard)
export class PlatformsController {
  private readonly logger = new Logger(PlatformsController.name);

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

  /**
   * Publish a rendered video to a given platform.
   *
   * The caller must provide either `r2Key` (an R2 object key that resolves to a public CDN URL)
   * or `versionId` (used to build a signed media URL). The resolved HTTPS URL is forwarded to
   * the platform provider as `videoFilePath`.
   */
  @Post(':platform/publish')
  @TierRateLimit({ bucket: 'platform-publish', windowSecs: 2592000, limits: { FREE: 0, STARTER: 10, PRO: 9999, AGENCY: 9999, default: 0 } })
  async publishToPlatform(
    @CurrentUser() user: JwtPayload,
    @Param('platform') platform: string,
    @Body() body: PlatformPublishDto,
  ) {
    const provider = this.registry.getProvider(platform);
    if (!provider) throw new NotFoundException(`Platform "${platform}" is not supported`);

    const status = await provider.getConnectionStatus(user.sub);
    if (!status.connected) {
      throw new BadRequestException(`Not connected to ${platform}. Connect first at Settings → Channels.`);
    }

    // Resolve r2Key or versionId → public HTTPS video URL
    const videoFilePath = await this.resolveVideoUrl(body.r2Key, body.versionId);
    if (!videoFilePath) {
      throw new BadRequestException('Provide r2Key or versionId to identify the rendered video');
    }

    // Validate before spending API credits
    const validation = provider.validate({ title: body.title, videoFilePath });
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    try {
      let result;
      if (body.scheduledAt) {
        result = await provider.schedule(user.sub, {
          title: body.title,
          description: body.description,
          tags: body.tags,
          videoFilePath,
          privacyStatus: body.privacyStatus,
          scheduledAt: new Date(body.scheduledAt),
        });
      } else {
        result = await provider.publish(user.sub, {
          title: body.title,
          description: body.description,
          tags: body.tags,
          videoFilePath,
          privacyStatus: body.privacyStatus ?? 'public',
        });
      }

      this.logger.log(`Published to ${platform} for user ${user.sub}: ${result.url}`);
      return { ok: true, platform, postId: result.platformPostId, url: result.url, publishedAt: result.publishedAt };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed publishing to ${platform} for user ${user.sub}: ${msg}`);
      throw new BadRequestException(`Publish to ${platform} failed: ${msg}`);
    }
  }

  private async resolveVideoUrl(r2Key?: string, versionId?: string): Promise<string | undefined> {
    const cdnBase = (process.env['ASSET_CDN_URL'] ?? '').replace(/\/$/, '');
    const apiBase = (process.env['API_BASE_URL'] ?? '').replace(/\/$/, '');
    const internalToken = process.env['INTERNAL_MEDIA_TOKEN'] ?? '';
    const tokenParam = internalToken ? `?token=${encodeURIComponent(internalToken)}` : '';

    if (r2Key) {
      if (cdnBase) return `${cdnBase}/${r2Key}`;
      // Look up the version to get its ID for the media URL
      const version = await this.prisma.assetVersion.findFirst({
        where: { r2Key },
        select: { id: true },
      });
      if (version && apiBase) return `${apiBase}/media/versions/${version.id}/file${tokenParam}`;
      return undefined;
    }

    if (versionId && apiBase) {
      return `${apiBase}/media/versions/${versionId}/file${tokenParam}`;
    }

    return undefined;
  }
}
