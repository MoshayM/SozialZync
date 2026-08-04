import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { MusicBriefOutputSchema, type MusicBriefOutput } from '@cf/shared';
import type { ScriptOutput } from '@cf/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MusicExternalService } from './music-external.service';

const MUSIC_SYSTEM = `You are a music director for YouTube content. Create detailed AI music generation briefs. All output is original creator-licensed AI generation. Respond only with valid JSON.`;

export interface CreateMusicTrackDto {
  title: string;
  artist?: string;
  album?: string;
  duration: number;
  bpm?: number;
  key?: string;
  mood?: string[];
  genre?: string[];
  tags?: string[];
  license: string;
  licenseUrl?: string;
  source?: string;
  attribution?: string;
  fileUrl: string;
  fileSizeBytes?: number;
  waveformData?: string;
  previewUrl?: string;
  isAiGenerated?: boolean;
  aiModel?: string;
}

export interface ListMusicTracksQuery {
  mood?: string;
  genre?: string;
  license?: string;
  search?: string;
  minDuration?: number;
  maxDuration?: number;
  limit?: number;
  offset?: number;
}

@Injectable()
export class MusicService {
  private readonly logger = new Logger(MusicService.name);

  constructor(private readonly prisma: PrismaService, private readonly externalMusic: MusicExternalService) {}

  // ── AI brief generation (original capability, used by SupervisorWorker) ──────

  async generateBrief(script: ScriptOutput, projectId: string, mood?: string, genre?: string): Promise<MusicBriefOutput> {
    this.logger.log(`Generating music brief — projectId="${projectId}"`);
    const durationSecs = Math.round(script.estimatedDurationMins * 60);

    try {
      return await callAIStructured(
        [{
          role: 'user',
          content: `Create a music generation brief for YouTube video "${script.title}"\nDuration: ${durationSecs}s\nMood: ${mood ?? 'professional and engaging'}\nGenre: ${genre ?? 'electronic/ambient'}\nHook: "${script.hook.slice(0, 150)}"\n\nGenerate: mood, genre, bpm (60-160), instruments (array), energy (low/medium/high/dynamic), durationSecs, structure, prompt, provider ("suno").`,
        }],
        MusicBriefOutputSchema,
        { systemPrompt: MUSIC_SYSTEM, maxTokens: 2048 },
      ) as MusicBriefOutput;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Music brief failed — ${msg}`);
      throw new InternalServerErrorException(`Music brief generation failed: ${msg}`);
    }
  }

  // ── Music library CRUD ────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateMusicTrackDto) {
    return this.prisma.musicTrack.create({ data: { ...dto, userId } });
  }

  async list(userId: string, query: ListMusicTracksQuery = {}) {
    const where: Record<string, unknown> = { userId };
    if (query.mood) where['mood'] = { has: query.mood };
    if (query.genre) where['genre'] = { has: query.genre };
    if (query.license) where['license'] = query.license;
    if (query.search) {
      where['OR'] = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { artist: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search } },
      ];
    }
    if (query.minDuration ?? query.maxDuration) {
      where['duration'] = {};
      if (query.minDuration) (where['duration'] as Record<string, number>)['gte'] = query.minDuration;
      if (query.maxDuration) (where['duration'] as Record<string, number>)['lte'] = query.maxDuration;
    }
    const [tracks, total] = await Promise.all([
      this.prisma.musicTrack.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      }),
      this.prisma.musicTrack.count({ where }),
    ]);
    return { tracks, total };
  }

  async findOne(userId: string, id: string) {
    return this.prisma.musicTrack.findFirst({ where: { id, userId } });
  }

  async update(userId: string, id: string, dto: Partial<CreateMusicTrackDto>) {
    await this.prisma.musicTrack.findFirstOrThrow({ where: { id, userId } });
    return this.prisma.musicTrack.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.prisma.musicTrack.findFirstOrThrow({ where: { id, userId } });
    await this.prisma.musicTrack.delete({ where: { id } });
  }

  async getMoods(userId: string): Promise<string[]> {
    const tracks = await this.prisma.musicTrack.findMany({ where: { userId }, select: { mood: true } });
    return [...new Set(tracks.flatMap(t => t.mood))].sort();
  }

  async getGenres(userId: string): Promise<string[]> {
    const tracks = await this.prisma.musicTrack.findMany({ where: { userId }, select: { genre: true } });
    return [...new Set(tracks.flatMap(t => t.genre))].sort();
  }

  async autoSelectTrack(userId: string, scriptText: string, projectId: string): Promise<{
    track: Record<string, unknown> | null;
    brief: MusicBriefOutput;
    source: 'library' | 'external' | 'none';
    reason: string;
  }> {
    const pseudoScript = {
      title: 'Auto-select',
      hook: scriptText.slice(0, 200),
      estimatedDurationMins: 5,
      sections: [],
      callToAction: '',
    } as never;

    const brief = await this.generateBrief(pseudoScript, projectId).catch(() => ({
      mood: 'upbeat',
      genre: 'electronic',
      bpm: 120,
      instruments: [],
      energy: 'medium',
      durationSecs: 300,
      structure: '',
      prompt: '',
      provider: 'suno',
    } as MusicBriefOutput));

    const mood = typeof brief.mood === 'string' ? brief.mood : 'upbeat';
    const genre = typeof brief.genre === 'string' ? brief.genre : 'electronic';

    const localByMood = await this.list(userId, { mood, limit: 5 });
    if (localByMood.tracks.length > 0) {
      return { track: localByMood.tracks[0] as unknown as Record<string, unknown>, brief, source: 'library', reason: `Mood match: "${mood}" from your library` };
    }

    const localByGenre = await this.list(userId, { genre, limit: 5 });
    if (localByGenre.tracks.length > 0) {
      return { track: localByGenre.tracks[0] as unknown as Record<string, unknown>, brief, source: 'library', reason: `Genre match: "${genre}" from your library` };
    }

    try {
      const external = await this.externalMusic.search({ mood, genre, limit: 5 });
      if (external.length > 0) {
        const pick = external[0];
        const imported = await this.create(userId, {
          title: pick.title,
          artist: pick.artist,
          album: pick.album,
          duration: pick.duration,
          bpm: pick.bpm,
          mood: pick.mood,
          genre: pick.genre,
          license: pick.license,
          licenseUrl: pick.licenseUrl,
          source: pick.externalUrl,
          attribution: pick.attribution,
          fileUrl: pick.audioUrl,
          previewUrl: pick.previewUrl,
          isAiGenerated: false,
        });
        return { track: imported as unknown as Record<string, unknown>, brief, source: 'external', reason: `AI matched: "${mood}" ${genre} from ${pick.source}` };
      }
    } catch {
      // external search failed gracefully
    }

    return { track: null, brief, source: 'none', reason: 'No matching track found' };
  }
}
