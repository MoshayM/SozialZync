-- Add canvas configuration to shorts_timelines
ALTER TABLE "shorts_timelines" ADD COLUMN IF NOT EXISTS "canvas_config" JSONB;
