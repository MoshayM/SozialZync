-- Add readOnly flag to PlatformConnection for watch-only accounts
ALTER TABLE "platform_connections" ADD COLUMN IF NOT EXISTS "readOnly" BOOLEAN NOT NULL DEFAULT false;

-- Drop old unique index [userId, platformId] and add [userId, platformId, accountId]
DROP INDEX IF EXISTS "platform_connections_userId_platformId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "platform_connections_userId_platformId_accountId_key" ON "platform_connections"("userId", "platformId", "accountId");
