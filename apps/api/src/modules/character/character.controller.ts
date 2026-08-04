import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { CharacterService, type CreateCharacterDto } from './character.service';
import { CharacterVoiceService } from './character-voice.service';
import type { VoiceEffect } from './character.types';

@Controller('characters')
@UseGuards(JwtAuthGuard)
export class CharacterController {
  constructor(
    private readonly svc: CharacterService,
    private readonly voice: CharacterVoiceService,
  ) {}

  @Get('presets')
  getPresets() { return this.svc.getPresets(); }

  @Get()
  list(@CurrentUser() u: JwtPayload) { return this.svc.list(u.sub); }

  @Get(':id')
  findOne(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.findOne(u.sub, id);
  }

  @Post()
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateCharacterDto) {
    return this.svc.create(u.sub, dto);
  }

  @Post('from-preset/:presetId')
  createFromPreset(@CurrentUser() u: JwtPayload, @Param('presetId') presetId: string) {
    return this.svc.createFromPreset(u.sub, presetId);
  }

  @Put(':id')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: Partial<CreateCharacterDto>) {
    return this.svc.update(u.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.remove(u.sub, id);
  }

  // ── Voice preview (streams MP3) ────────────────────────────────────────────

  @Post('preview-voice')
  async previewVoice(
    @Body() body: {
      text: string;
      voiceProvider: 'openai' | 'elevenlabs';
      voiceId: string;
      voicePitch?: number;
      voiceSpeed?: number;
      voiceEffect?: VoiceEffect;
    },
    @Res() res: Response,
  ) {
    const audio = await this.voice.synthesize({
      text: body.text.slice(0, 300),
      voiceProvider: body.voiceProvider,
      voiceId: body.voiceId,
      voicePitch: body.voicePitch ?? 1.0,
      voiceSpeed: body.voiceSpeed ?? 1.0,
      voiceEffect: body.voiceEffect ?? 'none',
    });
    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length }).send(audio);
  }

  // ── DiceBear avatar URL helper ─────────────────────────────────────────────

  @Get('avatar/dicebear')
  getDiceBearUrl(@Query('style') style: string, @Query('seed') seed: string) {
    return { url: this.svc.getDiceBearUrl(style ?? 'avataaars', seed ?? 'character') };
  }
}
