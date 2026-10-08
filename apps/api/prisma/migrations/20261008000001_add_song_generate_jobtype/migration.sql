-- AlterEnum: add SONG_GENERATE for AI vocal song generation
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'SONG_GENERATE';
