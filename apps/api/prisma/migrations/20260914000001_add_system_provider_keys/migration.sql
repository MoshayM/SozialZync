-- CreateTable
CREATE TABLE "system_provider_keys" (
    "id" TEXT NOT NULL,
    "envKey" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_provider_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_provider_keys_envKey_key" ON "system_provider_keys"("envKey");
