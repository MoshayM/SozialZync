-- CreateTable
CREATE TABLE "music_tracks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "album" TEXT,
    "duration" INTEGER NOT NULL,
    "bpm" INTEGER,
    "key" TEXT,
    "mood" TEXT[],
    "genre" TEXT[],
    "tags" TEXT[],
    "license" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "source" TEXT,
    "attribution" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "waveformData" TEXT,
    "previewUrl" TEXT,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "music_tracks_userId_license_idx" ON "music_tracks"("userId", "license");
CREATE INDEX "music_tracks_userId_mood_idx" ON "music_tracks"("userId", "mood");

ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
