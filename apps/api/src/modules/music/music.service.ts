import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { MusicBriefOutputSchema, type MusicBriefOutput } from '@cf/shared';
import type { ScriptOutput } from '@cf/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

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
}
