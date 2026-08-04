export type VideoStyle = 'realistic' | 'cartoon' | 'animation' | 'anime' | 'movie' | 'pixel';
export type VoiceEffect = 'none' | 'robot' | 'cartoon' | 'villain' | 'whisper' | 'chipmunk' | 'giant' | 'echo';
export type AvatarStyle =
  | 'avataaars' | 'bottts' | 'fun-emoji' | 'pixel-art'
  | 'adventurer' | 'lorelei' | 'micah' | 'open-peeps'
  | 'thumbs' | 'notionists' | 'croodles' | 'big-ears';

export interface CharacterPreset {
  id: string;
  name: string;
  description: string;
  personality: string;
  voiceProvider: 'elevenlabs' | 'openai';
  voiceId: string;          // openai: 'nova', 'echo', etc. elevenlabs: voice_id
  voicePitch: number;       // 0.5 – 2.0
  voiceSpeed: number;       // 0.5 – 2.0
  voiceEffect: VoiceEffect;
  videoStyle: VideoStyle;
  avatarStyle: AvatarStyle;
  emoji: string;
  tags: string[];
}

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'cartoon-hero',
    name: 'Cartoon Hero',
    description: 'Energetic, upbeat cartoon character — perfect for kids content and fun tutorials',
    personality: 'Enthusiastic, friendly, and upbeat. Uses simple language. Very expressive.',
    voiceProvider: 'openai', voiceId: 'nova',
    voicePitch: 1.3, voiceSpeed: 1.1, voiceEffect: 'cartoon',
    videoStyle: 'cartoon', avatarStyle: 'avataaars',
    emoji: '🦸', tags: ['kids', 'fun', 'tutorial'],
  },
  {
    id: 'evil-villain',
    name: 'Evil Villain',
    description: 'Deep, menacing voice for dramatic storytelling or comedy villain roles',
    personality: 'Dramatic, pompous, and theatrical. Speaks slowly with gravitas. Often monologues.',
    voiceProvider: 'openai', voiceId: 'onyx',
    voicePitch: 0.65, voiceSpeed: 0.85, voiceEffect: 'villain',
    videoStyle: 'movie', avatarStyle: 'notionists',
    emoji: '😈', tags: ['drama', 'comedy', 'storytelling'],
  },
  {
    id: 'funny-robot',
    name: 'Funny Robot',
    description: 'Mechanical AI with a sense of humor — great for tech content',
    personality: 'Logical but accidentally funny. Uses technical jargon incorrectly. Very literal.',
    voiceProvider: 'openai', voiceId: 'alloy',
    voicePitch: 1.0, voiceSpeed: 0.95, voiceEffect: 'robot',
    videoStyle: 'animation', avatarStyle: 'bottts',
    emoji: '🤖', tags: ['tech', 'comedy', 'sci-fi'],
  },
  {
    id: 'wise-elder',
    name: 'Wise Elder',
    description: 'Calm, authoritative narrator for educational and documentary content',
    personality: 'Patient, measured, and wise. Tells stories with rich detail. Very trustworthy.',
    voiceProvider: 'openai', voiceId: 'fable',
    voicePitch: 0.9, voiceSpeed: 0.9, voiceEffect: 'none',
    videoStyle: 'realistic', avatarStyle: 'lorelei',
    emoji: '🧙', tags: ['education', 'documentary', 'history'],
  },
  {
    id: 'anime-character',
    name: 'Anime Star',
    description: 'Expressive, high-energy character inspired by anime protagonists',
    personality: 'Passionate, emotional, and determined. Speaks with strong feelings. Never gives up.',
    voiceProvider: 'openai', voiceId: 'shimmer',
    voicePitch: 1.2, voiceSpeed: 1.15, voiceEffect: 'cartoon',
    videoStyle: 'anime', avatarStyle: 'adventurer',
    emoji: '⚡', tags: ['anime', 'gaming', 'energy'],
  },
  {
    id: 'mysterious-narrator',
    name: 'Mysterious Voice',
    description: 'Whisper-soft narrator for horror, mystery, and suspense content',
    personality: 'Cryptic, slow, and unsettling. Pauses dramatically. Speaks in riddles.',
    voiceProvider: 'openai', voiceId: 'echo',
    voicePitch: 0.85, voiceSpeed: 0.8, voiceEffect: 'whisper',
    videoStyle: 'movie', avatarStyle: 'croodles',
    emoji: '👻', tags: ['horror', 'mystery', 'suspense'],
  },
  {
    id: 'chipmunk',
    name: 'Chipmunk Charlie',
    description: 'Super high-pitched funny voice — comedy skits and reaction content',
    personality: 'Hyperactive, chaotic, and unpredictable. Says random things at high speed.',
    voiceProvider: 'openai', voiceId: 'nova',
    voicePitch: 1.8, voiceSpeed: 1.25, voiceEffect: 'chipmunk',
    videoStyle: 'cartoon', avatarStyle: 'fun-emoji',
    emoji: '🐿️', tags: ['comedy', 'reaction', 'meme'],
  },
  {
    id: 'pixel-gamer',
    name: 'Pixel Gamer',
    description: 'Retro gaming personality for gaming content and speedruns',
    personality: 'Competitive, uses gaming slang, references classic games. Very enthusiastic about achievements.',
    voiceProvider: 'openai', voiceId: 'echo',
    voicePitch: 1.05, voiceSpeed: 1.1, voiceEffect: 'none',
    videoStyle: 'pixel', avatarStyle: 'pixel-art',
    emoji: '🎮', tags: ['gaming', 'retro', 'esports'],
  },
];

export const VOICE_EFFECT_FFMPEG: Record<VoiceEffect, string> = {
  none: '',
  robot: 'aecho=0.8:0.88:60:0.4,acrusher=bits=12',
  cartoon: 'asetrate=44100*1.35,aresample=44100,atempo=0.78',
  villain: 'asetrate=44100*0.65,aresample=44100,bass=g=6',
  whisper: 'volume=0.35,aecho=0.4:0.4:50:0.4,lowpass=f=8000',
  chipmunk: 'asetrate=44100*1.75,aresample=44100,atempo=0.6',
  giant: 'asetrate=44100*0.5,aresample=44100,atempo=1.35,bass=g=8',
  echo: 'aecho=0.8:0.8:500:0.5,aecho=0.6:0.6:1000:0.3',
};

export const VIDEO_STYLE_METADATA: Record<VideoStyle, { label: string; description: string; promptKeywords: string; previewColor: string; emoji: string }> = {
  realistic: { label: 'Realistic', description: 'Photorealistic, cinematic quality', promptKeywords: 'photorealistic, 4K, cinematic lighting, detailed', previewColor: '#1e293b', emoji: '📷' },
  cartoon: { label: 'Cartoon', description: 'Classic 2D cartoon style', promptKeywords: '2D cartoon, flat colors, bold outlines, Disney-style', previewColor: '#f59e0b', emoji: '🎨' },
  animation: { label: 'Animation', description: '3D animation, Pixar-like', promptKeywords: '3D animated, Pixar style, smooth shading, vibrant colors', previewColor: '#8b5cf6', emoji: '✨' },
  anime: { label: 'Anime', description: 'Japanese animation style', promptKeywords: 'anime style, Studio Ghibli, cel-shaded, expressive eyes', previewColor: '#ec4899', emoji: '⛩️' },
  movie: { label: 'Movie', description: 'Cinematic, high production value', promptKeywords: 'cinematic, dramatic lighting, film grain, anamorphic', previewColor: '#dc2626', emoji: '🎬' },
  pixel: { label: 'Pixel Art', description: 'Retro pixel aesthetic', promptKeywords: 'pixel art, 8-bit style, retro game graphics, limited color palette', previewColor: '#10b981', emoji: '👾' },
};
