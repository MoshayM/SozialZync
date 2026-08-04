-- CreateTable
CREATE TABLE "Character" (
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

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
