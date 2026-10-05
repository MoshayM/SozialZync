ALTER TABLE "content_calendar_entries" ADD COLUMN IF NOT EXISTS "titleVariants" TEXT[] NOT NULL DEFAULT '{}';
