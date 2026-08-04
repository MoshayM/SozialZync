import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { MusicService, type CreateMusicTrackDto, type ListMusicTracksQuery } from './music.service';
import { MusicExternalService, type ExternalTrack } from './music-external.service';

@Controller('music')
@UseGuards(JwtAuthGuard)
export class MusicController {
  constructor(private readonly svc: MusicService, private readonly external: MusicExternalService) {}

  // ── Music library endpoints ────────────────────────────────────────────────

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() q: ListMusicTracksQuery) {
    return this.svc.list(u.sub, q);
  }

  @Get('moods')
  moods(@CurrentUser() u: JwtPayload) { return this.svc.getMoods(u.sub); }

  @Get('genres')
  genres(@CurrentUser() u: JwtPayload) { return this.svc.getGenres(u.sub); }

  // ── AI auto-select ────────────────────────────────────────────────────────

  @Post('auto-select')
  async autoSelect(
    @CurrentUser() u: JwtPayload,
    @Body() body: { scriptText: string; projectId: string },
  ) {
    return this.svc.autoSelectTrack(u.sub, body.scriptText ?? '', body.projectId ?? 'auto');
  }

  // ── External browse endpoints (Jamendo + Pixabay) ─────────────────────────

  @Get('browse/trending')
  browseTrending() {
    return this.external.getTrending();
  }

  @Get('browse/search')
  browseSearch(
    @Query('q') q?: string,
    @Query('genre') genre?: string,
    @Query('mood') mood?: string,
    @Query('bpm') bpm?: string,
    @Query('source') source?: 'jamendo' | 'pixabay' | 'all',
    @Query('limit') limit?: string,
  ) {
    return this.external.search({ q, genre, mood, bpm: bpm ? Number(bpm) : undefined, source, limit: limit ? Number(limit) : 20 });
  }

  @Post('browse/import')
  async browseImport(@CurrentUser() u: JwtPayload, @Body() track: ExternalTrack) {
    return this.svc.create(u.sub, {
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      bpm: track.bpm,
      mood: track.mood,
      genre: track.genre,
      license: track.license,
      licenseUrl: track.licenseUrl,
      source: track.externalUrl,
      attribution: track.attribution,
      fileUrl: track.audioUrl,
      previewUrl: track.previewUrl,
      isAiGenerated: false,
    });
  }

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
