-- ============================================================
-- Phase 9 Patch — Add set_id to progress table
-- Root cause fix: useProgressUpdater inserts set_id on every upsert,
-- but the column was never added to the schema, causing every progress
-- write to fail silently (PGRST204). This leaves inProgress + mastered = 0.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add set_id column (nullable first so existing rows don't fail)
ALTER TABLE progress
  ADD COLUMN IF NOT EXISTS set_id UUID REFERENCES study_sets(id) ON DELETE CASCADE;

-- 2. Backfill set_id for any existing rows by joining through flashcards
UPDATE progress p
SET set_id = f.set_id
FROM flashcards f
WHERE p.card_id = f.id
  AND p.set_id IS NULL;

-- 3. Index for useReviewQueue / useVocabStatus filters on (user_id, set_id)
CREATE INDEX IF NOT EXISTS idx_progress_user_set ON progress(user_id, set_id);
