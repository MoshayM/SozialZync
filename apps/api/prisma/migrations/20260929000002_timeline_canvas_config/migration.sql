-- Add canvas configuration to shorts_timelines (camelCase column naming matches this project's convention)
ALTER TABLE "shorts_timelines" ADD COLUMN IF NOT EXISTS "canvasConfig" JSONB;
