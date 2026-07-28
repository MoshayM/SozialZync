import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { MusicService, type CreateMusicTrackDto, type ListMusicTracksQuery } from './music.service';

@Controller('music')
@UseGuards(JwtAuthGuard)
export class MusicController {
  constructor(private readonly svc: MusicService) {}

  // ── Music library endpoints ────────────────────────────────────────────────

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() q: ListMusicTracksQuery) {
    return this.svc.list(u.sub, q);
  }

  @Get('moods')
  moods(@CurrentUser() u: JwtPayload) { return this.svc.getMoods(u.sub); }

  @Get('genres')
  genres(@CurrentUser() u: JwtPayload) { return this.svc.getGenres(u.sub); }

  @Get(':id')
  findOne(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.findOne(u.sub, id);
  }

  @Post()
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateMusicTrackDto) {
    return this.svc.create(u.sub, dto);
  }

  @Put(':id')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: Partial<CreateMusicTrackDto>) {
    return this.svc.update(u.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.remove(u.sub, id);
  }

  // ── AI brief generation (legacy endpoint, used by content pipeline) ────────

  @Post('brief')
  async brief(@Body() body: { script: unknown; projectId: string; mood?: string; genre?: string }) {
    return this.svc.generateBrief(body.script as never, body.projectId, body.mood, body.genre);
  }
}
