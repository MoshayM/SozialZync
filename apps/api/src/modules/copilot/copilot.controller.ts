import {
  Controller, Post, Get, Body, UseGuards, BadRequestException,
  UseInterceptors, UploadedFile, Query, Param, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CopilotChatRequestSchema } from '@cf/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { CopilotService } from './copilot.service';
import { SpeechService } from './speech.service';
import { PlanExecutorService } from './plan-executor.service';
import { CopilotHistoryService } from './copilot-history.service';

@Controller('copilot')
@UseGuards(JwtAuthGuard)
export class CopilotController {
  constructor(
    private readonly copilot: CopilotService,
    private readonly speech: SpeechService,
    private readonly planExecutor: PlanExecutorService,
    private readonly historyService: CopilotHistoryService,
  ) {}

  @Post('chat')
  @TierRateLimit({ bucket: 'copilot-chat', windowSecs: 3600, limits: { FREE: 20, STARTER: 60, PRO: 200, AGENCY: 500, default: 20 } })
  async chat(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const parsed = CopilotChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid copilot request');
    }
    return this.copilot.chat(user.sub, parsed.data);
  }

  /**
   * Server-side speech-to-text. Accepts multipart/form-data with the audio
   * as the "audio" field. Optional "language" field is BCP-47 hint.
   * Provider is controlled by STT_PROVIDER env var (default: whisper).
   */
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async transcribe(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('language') language: string | undefined,
  ) {
    if (!file) throw new BadRequestException('Missing audio file — send as multipart field "audio"');
    return this.speech.transcribe(file.buffer, file.mimetype || 'audio/webm', language);
  }

  /** Whether server-side STT is configured and which provider is active. */
  @Get('stt-status')
  sttStatus() {
    return { available: this.speech.isAvailable, provider: this.speech.provider };
  }

  /** Recent jobs triggered by this user's copilot session (task queue display). */
  @Get('jobs')
  async jobs(@CurrentUser() user: JwtPayload, @Query('take') take?: string) {
    return this.copilot.listRecentJobs(user.sub, take ? parseInt(take, 10) : 10);
  }

  /** Poll the live status of a multi-step plan execution. */
  @Get('plan/:planId')
  getPlan(@Param('planId') planId: string, @CurrentUser() user: JwtPayload) {
    const exec = this.planExecutor.getExecution(planId);
    // Guard: planId is userId-prefixed so users can't see others' plans
    if (!exec || !planId.startsWith(user.sub + ':')) throw new NotFoundException('Plan not found');
    return exec;
  }

  /** List the user's persisted copilot sessions (up to 20, 30-day window). */
  @Get('history')
  getHistory(@CurrentUser() user: JwtPayload) {
    return { sessions: this.historyService.list(user.sub) };
  }

  /** Upsert a copilot session (called after each assistant turn). */
  @Post('history')
  saveHistory(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const b = body as Record<string, unknown>;
    const sessionId = b['sessionId'];
    const title = b['title'];
    const messages = b['messages'];
    if (!sessionId || typeof sessionId !== 'string') {
      throw new BadRequestException('sessionId required');
    }
    this.historyService.upsert(
      user.sub,
      sessionId,
      String(title ?? '').slice(0, 120),
      Array.isArray(messages) ? messages : [],
    );
    return { ok: true };
  }
}
