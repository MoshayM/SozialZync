import { Controller, Get, Param, Post, Query, Req, Res, UseGuards, StreamableFile, NotFoundException, ForbiddenException, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { createHash } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from './storage.service';
import { ExportsService } from './exports.service';
import { MediaService } from './media.service';
import { SignedMediaOrJwtGuard } from './signed-media.guard';
import { clampTtl, signMedia, signingSecret } from './signed-url.util';

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', png: 'image/png',
  jpg: 'image/jpeg', srt: 'text/plain', vtt: 'text/vtt', md: 'text/markdown',
  txt: 'text/plain', json: 'application/json',
};

function mimeFor(name: string): string {
  return MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

type MediaRequest = Request & { signedMediaAccess?: boolean; user?: JwtPayload };

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly exportsSvc: ExportsService,
    private readonly mediaSvc: MediaService,
  ) {}

  /** Returns which image/voice/music/video providers are currently active. */
  @Get('providers/status')
  getProviderStatus() {
    return this.mediaSvc.getProviderStatus();
  }

  /** Synthesise a short test phrase with the active voice provider. Returns MP3 audio. */
  @Post('providers/test-voice')
  async testVoice(@Res() res: Response): Promise<void> {
    const TEST_PROJECT = '__provider_test__';
    const stored = await this.mediaSvc.generateVoice(TEST_PROJECT, 'provider-test', {
      text: 'Hello, this is a test of your voice provider configuration.',
    });
    const stream = this.storage.stream(stored.key);
    res.set({ 'Content-Type': 'audio/mpeg', 'X-Provider': stored.provider });
    stream.pipe(res);
  }

  /** Generate a small test image with the active image provider. Returns PNG. */
  @Post('providers/test-image')
  async testImage(@Res() res: Response): Promise<void> {
    const TEST_PROJECT = '__provider_test__';
    const stored = await this.mediaSvc.generateImage(TEST_PROJECT, 'provider-test', {
      prompt: 'A simple test image: a bright orange circle on a white background.',
      width: 512,
      height: 512,
    });
    const stream = this.storage.stream(stored.key);
    res.set({ 'Content-Type': 'image/png', 'X-Provider': stored.provider });
    stream.pipe(res);
  }

  /**
   * Accept a user-recorded voice clip (webm/mp4/ogg/wav) and store it as a
   * VOICE asset so downstream pipeline stages can use it as the narration
   * track instead of TTS. Max 100 MB.
   */
  @Post('voice/upload')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async uploadVoice(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('projectId') projectId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ versionId: string; assetId: string; provider: string; sizeBytes: number }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing audio file — send as multipart field "audio"');
    }
    if (!projectId) {
      throw new BadRequestException('projectId query param is required');
    }

    // Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId: user.sub },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const ext = file.mimetype?.includes('wav') ? 'wav'
      : file.mimetype?.includes('ogg') ? 'ogg'
      : file.mimetype?.includes('mp4') ? 'mp4'
      : 'webm';

    const asset = await this.prisma.asset.create({
      data: { projectId, kind: 'VOICE', label: 'user-recording', status: 'READY' },
    });

    const key = `assets/${projectId}/${asset.id}/v1/media.${ext}`;
    const { sizeBytes } = await this.storage.put(key, file.buffer);
    const contentHash = createHash('sha256').update(file.buffer).digest('hex');

    const version = await this.prisma.assetVersion.create({
      data: {
        assetId: asset.id,
        version: 1,
        r2Key: key,
        contentHash,
        provider: 'user-recording',
        model: null,
        prompt: {} as never,
        params: {} as never,
        provenance: {
          provider: 'user-recording',
          model: null,
          generatedAt: new Date().toISOString(),
          license: 'user-owned',
          notes: 'Recorded by user via browser microphone',
        } as never,
        sizeBytes: BigInt(sizeBytes),
        durationMs: null,
      },
    });

    await this.prisma.asset.update({
      where: { id: asset.id },
      data: { currentVersionId: version.id },
    });

    return { versionId: version.id, assetId: asset.id, provider: 'user-recording', sizeBytes };
  }

  // Signed access (docs4/09): file routes accept `?exp=&sig=` OR a JWT.
  // @Public neutralises the controller-level JWT guard; SignedMediaOrJwtGuard
  // still enforces JWT when no valid signature is presented.
  @Public()
  @UseGuards(SignedMediaOrJwtGuard)
  @Get('versions/:versionId/file')
  async versionFile(
    @Param('versionId') versionId: string,
    @Req() req: MediaRequest,
  ): Promise<StreamableFile> {
    const version = await this.prisma.assetVersion.findUnique({
      where: { id: versionId },
      include: { asset: { include: { project: { select: { userId: true } } } } },
    });
    // Signature access proved ownership at issuance; JWT access proves it here.
    // (The JWT payload carries the user id in `sub` — there is no `id` field.)
    const authorized =
      req.signedMediaAccess === true || version?.asset.project.userId === req.user?.sub;
    if (!version?.r2Key || !authorized || !this.storage.exists(version.r2Key)) {
      throw new NotFoundException('Asset file not found');
    }
    const name = version.r2Key.split('/').pop() ?? 'file';
    return new StreamableFile(this.storage.stream(version.r2Key), {
      type: mimeFor(name),
      disposition: `attachment; filename="${name}"`,
    });
  }

  /** Expiring capability URL for an asset-version file (docs4/09). */
  @Get('versions/:versionId/signed-url')
  async versionSignedUrl(
    @Param('versionId') versionId: string,
    @CurrentUser() user: JwtPayload,
    @Query('ttl') ttl?: string,
  ) {
    this.assertExportAllowed(user);
    const version = await this.prisma.assetVersion.findUnique({
      where: { id: versionId },
      select: { r2Key: true, asset: { select: { project: { select: { userId: true } } } } },
    });
    if (!version?.r2Key || version.asset.project.userId !== user.sub) {
      throw new NotFoundException('Asset file not found');
    }
    return this.issueSignedUrl(`version:${versionId}`, `/media/versions/${versionId}/file`, ttl);
  }

  @Get('exports/:projectId')
  async listExports(@Param('projectId') projectId: string, @CurrentUser() user: JwtPayload) {
    await this.assertOwner(projectId, user.sub);
    return this.exportsSvc.list(projectId);
  }

  /** On-demand export package build — copies render + text assets into exports dir. */
  @Post('exports/:projectId/build')
  async buildExports(@Param('projectId') projectId: string, @CurrentUser() user: JwtPayload) {
    await this.assertOwner(projectId, user.sub);
    this.assertExportAllowed(user);
    const files = await this.exportsSvc.buildPackage(projectId);
    return { files };
  }

  @Public()
  @UseGuards(SignedMediaOrJwtGuard)
  @Get('exports/:projectId/:fileName')
  async exportFile(
    @Param('projectId') projectId: string,
    @Param('fileName') fileName: string,
    @Req() req: MediaRequest,
  ): Promise<StreamableFile> {
    if (req.signedMediaAccess !== true) await this.assertOwner(projectId, req.user?.sub ?? '');
    return new StreamableFile(this.exportsSvc.fileStream(projectId, fileName), {
      type: mimeFor(fileName),
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  /** Expiring capability URL for a project export file (docs4/09). */
  @Get('exports/:projectId/:fileName/signed-url')
  async exportSignedUrl(
    @Param('projectId') projectId: string,
    @Param('fileName') fileName: string,
    @CurrentUser() user: JwtPayload,
    @Query('ttl') ttl?: string,
  ) {
    await this.assertOwner(projectId, user.sub);
    this.assertExportAllowed(user);
    return this.issueSignedUrl(
      `export:${projectId}/${fileName}`,
      `/media/exports/${projectId}/${fileName}`,
      ttl,
    );
  }

  private issueSignedUrl(resource: string, path: string, ttlRaw: string | undefined) {
    const ttl = clampTtl(ttlRaw !== undefined ? parseInt(ttlRaw, 10) : undefined);
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = signMedia(resource, exp, signingSecret());
    return {
      url: `/api/v1${path}?exp=${exp}&sig=${sig}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  private assertExportAllowed(user: JwtPayload): void {
    const isElevated = user.role === 'SUPER_ADMIN' || user.role === 'OWNER';
    if (!isElevated && (user.plan ?? 'FREE') === 'FREE') {
      throw new ForbiddenException(
        'Free accounts cannot download or export files. Upgrade to Starter or higher to unlock downloads and exports.',
      );
    }
  }

  private async assertOwner(projectId: string, userId: string): Promise<void> {
    if (!userId) throw new NotFoundException('Project not found');
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
  }
}
