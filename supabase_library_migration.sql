-- Add session-state columns to the existing vg_videos table
ALTER TABLE vg_videos
  ADD COLUMN IF NOT EXISTS video_url      text,
  ADD COLUMN IF NOT EXISTS video_duration numeric,
  ADD COLUMN IF NOT EXISTS segments       jsonb,
  ADD COLUMN IF NOT EXISTS sync_manifest  jsonb,
  ADD COLUMN IF NOT EXISTS video_context  jsonb,
  ADD COLUMN IF NOT EXISTS download_url   text;
