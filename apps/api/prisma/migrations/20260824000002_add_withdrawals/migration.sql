-- Add withdrawnCredits to wallets (tracks total credits ever converted to cash)
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "withdrawnCredits" INTEGER NOT NULL DEFAULT 0;

-- WithdrawalStatus enum
DO $$ BEGIN
  CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Withdrawals table
CREATE TABLE IF NOT EXISTS "withdrawals" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "creditsRequested"   INTEGER NOT NULL,
  "platformFeeCredits" INTEGER NOT NULL,
  "creatorCredits"     INTEGER NOT NULL,
  "creditsPerUsd"      INTEGER NOT NULL,
  "amountUsd"          DOUBLE PRECISION NOT NULL,
  "platformFeeUsd"     DOUBLE PRECISION NOT NULL,
  "creatorAmountUsd"   DOUBLE PRECISION NOT NULL,
  "status"             "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "payoutEmail"        TEXT,
  "stripeTransferId"   TEXT,
  "adminNotes"         TEXT,
  "processedAt"        TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "withdrawals_userId_idx" ON "withdrawals"("userId");
CREATE INDEX IF NOT EXISTS "withdrawals_status_idx"  ON "withdrawals"("status");

-- FK to users
ALTER TABLE "withdrawals"
  ADD CONSTRAINT "withdrawals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
