import { Controller, Get, Post, Body, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VoiceService } from './voice.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('voice')
@UseGuards(JwtAuthGuard)
@TierRateLimit({ bucket: 'voice-generate', windowSecs: 3600, limits: { FREE: 5, STARTER: 20, PRO: 60, AGENCY: 150, default: 5 } })
export class VoiceController {
  constructor(
    private readonly voice: VoiceService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('library')
  getVoiceLibrary(@Query('source') source?: 'elevenlabs' | 'openai' | 'all') {
    return this.voice.getVoiceLibrary(source);
  }

  @Post('auto-select')
  async autoSelect(@Body() body: { scriptText: string }) {
    return this.voice.autoSelectVoice(body.scriptText ?? '');
  }

  @Post('spec')
  async generateSpec(@Body() body: { script: unknown; projectId: string; voiceProfile?: Record<string, unknown> }) {
    return this.voice.generateSpec(body.script as never, body.projectId, body.voiceProfile);
  }

  @Get('clone-available')
  checkCloneAvailability() {
    return this.voice.checkCloneAvailability();
  }

  /**
   * Store a user voice sample for in-app style transfer.
   * No external API required — reference audio is stored locally and the
   * pipeline applies FFmpeg pitch-matching when generating narration.
   */
  @Post('clone')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async cloneVoice(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('projectId') projectId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ voiceId: string; name: string }> {
    if (!file?.buffer?.length) throw new BadRequestException('Audio file is required');
    if (!projectId) throw new BadRequestException('projectId query param is required');

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId: user.sub },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.voice.cloneVoice(file.buffer, file.mimetype || 'audio/webm', project.id);
  }
}
