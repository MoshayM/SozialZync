-- CreateTable
CREATE TABLE "platform_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT,
    "encryptedTokens" TEXT NOT NULL,
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_connections_userId_idx" ON "platform_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_connections_userId_platformId_key" ON "platform_connections"("userId", "platformId");

-- AddForeignKey
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
