import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CHARACTER_PRESETS, type VideoStyle, type VoiceEffect, type AvatarStyle } from './character.types';

export interface CreateCharacterDto {
  name: string;
  description?: string;
  personality?: string;
  voiceProvider: 'elevenlabs' | 'openai';
  voiceId: string;
  voicePitch?: number;
  voiceSpeed?: number;
  voiceEffect?: VoiceEffect;
  videoStyle?: VideoStyle;
  avatarStyle?: AvatarStyle;
  avatarUrl?: string;
}

@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name);

  constructor(private readonly prisma: PrismaService) {}

  getPresets() {
    return CHARACTER_PRESETS;
  }

  async list(userId: string) {
    return this.prisma.character.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const c = await this.prisma.character.findFirst({ where: { id, userId } });
    if (!c) throw new NotFoundException('Character not found');
    return c;
  }

  async create(userId: string, dto: CreateCharacterDto) {
    return this.prisma.character.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        personality: dto.personality,
        voiceProvider: dto.voiceProvider,
        voiceId: dto.voiceId,
        voicePitch: dto.voicePitch ?? 1.0,
        voiceSpeed: dto.voiceSpeed ?? 1.0,
        voiceEffect: dto.voiceEffect ?? 'none',
        videoStyle: dto.videoStyle ?? 'realistic',
        avatarStyle: dto.avatarStyle ?? 'avataaars',
        avatarUrl: dto.avatarUrl,
      },
    });
  }

  async createFromPreset(userId: string, presetId: string) {
    const preset = CHARACTER_PRESETS.find(p => p.id === presetId);
    if (!preset) throw new NotFoundException(`Preset "${presetId}" not found`);
    return this.create(userId, {
      name: preset.name,
      description: preset.description,
      personality: preset.personality,
      voiceProvider: preset.voiceProvider,
      voiceId: preset.voiceId,
      voicePitch: preset.voicePitch,
      voiceSpeed: preset.voiceSpeed,
      voiceEffect: preset.voiceEffect,
      videoStyle: preset.videoStyle,
      avatarStyle: preset.avatarStyle,
    });
  }

  async update(userId: string, id: string, dto: Partial<CreateCharacterDto>) {
    await this.findOne(userId, id);
    return this.prisma.character.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.character.delete({ where: { id } });
  }

  getDiceBearUrl(avatarStyle: string, seed: string, size = 128): string {
    const cleanSeed = encodeURIComponent(seed.replace(/s+/g, '-').toLowerCase());
    return `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${cleanSeed}&size=${size}`;
  }
}
