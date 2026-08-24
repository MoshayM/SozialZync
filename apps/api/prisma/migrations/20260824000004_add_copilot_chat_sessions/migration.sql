-- CreateTable
CREATE TABLE "copilot_chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copilot_chat_sessions_userId_updatedAt_idx" ON "copilot_chat_sessions"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "copilot_chat_sessions_userId_sessionId_key" ON "copilot_chat_sessions"("userId", "sessionId");
