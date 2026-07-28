-- CreateTable
CREATE TABLE "user_provider_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEnc" TEXT,
    "model" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "streaming" BOOLEAN NOT NULL DEFAULT true,
    "visionSupport" BOOLEAN NOT NULL DEFAULT false,
    "functionCalling" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_provider_configs_userId_provider_idx" ON "user_provider_configs"("userId", "provider");

-- AddForeignKey
ALTER TABLE "user_provider_configs" ADD CONSTRAINT "user_provider_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
