import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';

@Controller('voice')
@UseGuards(JwtAuthGuard)
@TierRateLimit({ bucket: 'voice-generate', windowSecs: 3600, limits: { FREE: 5, STARTER: 20, PRO: 60, AGENCY: 150, default: 5 } })
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

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
}
