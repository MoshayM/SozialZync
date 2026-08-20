-- CreateTable (idempotent: safe to re-run if previous attempt partially applied)
CREATE TABLE IF NOT EXISTS "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "personality" TEXT,
    "voiceProvider" TEXT NOT NULL DEFAULT 'openai',
    "voiceId" TEXT NOT NULL DEFAULT 'nova',
    "voicePitch" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "voiceSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "voiceEffect" TEXT NOT NULL DEFAULT 'none',
    "videoStyle" TEXT NOT NULL DEFAULT 'realistic',
    "avatarStyle" TEXT NOT NULL DEFAULT 'avataaars',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Character_userId_idx" ON "Character"("userId");

-- AddForeignKey (idempotent: skip if constraint already exists)
DO $$ BEGIN
  ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
