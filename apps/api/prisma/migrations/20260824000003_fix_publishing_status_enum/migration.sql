-- Fix: PublishingStatus was added as TEXT in 20260730000001 but Prisma
-- generates ::"PublishingStatus" casts which require a native PostgreSQL enum type.
-- Drops the TEXT default first (cannot auto-coerce TEXT default to enum),
-- creates the enum, converts the column, then restores the enum-typed default.

-- Step 1: Drop TEXT default so ALTER TYPE doesn't fail on default coercion
ALTER TABLE "projects" ALTER COLUMN "publishingStatus" DROP DEFAULT;

-- Step 2: Create enum type (idempotent: no-op if already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PublishingStatus') THEN
    CREATE TYPE "PublishingStatus" AS ENUM (
      'NOT_PUBLISHED',
      'DRAFT',
      'READY',
      'SCHEDULED',
      'PUBLISHED',
      'FAILED'
    );
  END IF;
END $$;

-- Step 3: Convert column from TEXT to enum (idempotent: skips if already enum)
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'projects'
    AND column_name = 'publishingStatus';

  IF col_type = 'text' THEN
    ALTER TABLE "projects"
      ALTER COLUMN "publishingStatus" TYPE "PublishingStatus"
      USING "publishingStatus"::"PublishingStatus";
  END IF;
END $$;

-- Step 4: Restore default using the enum type (safe if already set to this value)
ALTER TABLE "projects"
  ALTER COLUMN "publishingStatus" SET DEFAULT 'NOT_PUBLISHED'::"PublishingStatus";
