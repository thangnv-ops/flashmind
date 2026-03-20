-- ============================================================
-- Phase 7 Migration — Mastery Level (1–10) & Spaced Repetition
-- Run in: Supabase Dashboard → SQL Editor
-- Depends on: Phase 6 migration (progress table must exist)
-- ============================================================

-- Step 1: Scale existing mastery_level from 0–5 range to 1–10 range
-- (multiply by 2, floor at 1, cap at 10)

-- Drop old inline CHECK constraint from Phase 1 (auto-named by Postgres)
-- before updating values that would exceed the old 0–5 range.
ALTER TABLE progress DROP CONSTRAINT IF EXISTS progress_mastery_level_check;
ALTER TABLE progress DROP CONSTRAINT IF EXISTS progress_mastery_level_range;

UPDATE progress
SET mastery_level = LEAST(10, GREATEST(1, mastery_level * 2))
WHERE mastery_level IS NOT NULL AND mastery_level > 0;

-- Any row that was 0 (never studied) defaults to 1
UPDATE progress
SET mastery_level = 1
WHERE mastery_level IS NULL OR mastery_level = 0;

-- Step 2: Add Spaced Repetition columns to progress table
ALTER TABLE progress
  ADD COLUMN IF NOT EXISTS consecutive_correct  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_review_at       TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ease_factor          FLOAT       NOT NULL DEFAULT 2.5;

-- Step 3: Backfill next_review_at for existing rows based on current mastery_level
-- Intervals match REVIEW_INTERVALS_MS in src/lib/masteryEngine.ts
UPDATE progress SET next_review_at =
  CASE
    WHEN mastery_level = 1  THEN updated_at + INTERVAL '10 minutes'
    WHEN mastery_level = 2  THEN updated_at + INTERVAL '30 minutes'
    WHEN mastery_level <= 4 THEN updated_at + INTERVAL '1 day'
    WHEN mastery_level = 5  THEN updated_at + INTERVAL '3 days'
    WHEN mastery_level = 6  THEN updated_at + INTERVAL '7 days'
    WHEN mastery_level = 7  THEN updated_at + INTERVAL '14 days'
    WHEN mastery_level = 8  THEN updated_at + INTERVAL '30 days'
    WHEN mastery_level = 9  THEN updated_at + INTERVAL '90 days'
    ELSE                         updated_at + INTERVAL '180 days'  -- level 10
  END
WHERE updated_at IS NOT NULL;

-- Step 4: Performance index for Review Queue query
CREATE INDEX IF NOT EXISTS progress_review_queue
  ON progress(user_id, next_review_at, mastery_level);

-- Step 5: Enforce mastery_level constraint (1–10 only)
ALTER TABLE progress
  DROP CONSTRAINT IF EXISTS progress_mastery_level_range;

ALTER TABLE progress
  ADD CONSTRAINT progress_mastery_level_range
  CHECK (mastery_level >= 1 AND mastery_level <= 10);

-- Step 6: Add Leech Card detection columns
ALTER TABLE progress
  ADD COLUMN IF NOT EXISTS penalty_count       INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_leech            BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS leech_detected_at   TIMESTAMPTZ DEFAULT NULL;

-- Partial index for efficient leech card queries
CREATE INDEX IF NOT EXISTS progress_leech
  ON progress(user_id, is_leech)
  WHERE is_leech = TRUE;
