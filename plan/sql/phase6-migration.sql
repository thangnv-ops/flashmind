-- ============================================================
-- Phase 6 Migration — Study Sessions, Daily Log, Progress Update
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create study_sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  set_id        UUID        REFERENCES study_sets(id) ON DELETE CASCADE NOT NULL,
  mode          TEXT        NOT NULL CHECK (mode IN ('flashcard', 'learn', 'write', 'test', 'match')),
  cards_total   INTEGER     NOT NULL DEFAULT 0,
  cards_done    INTEGER     NOT NULL DEFAULT 0,
  cards_correct INTEGER     NOT NULL DEFAULT 0,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ DEFAULT NULL,   -- NULL = in-progress or abandoned
  is_complete   BOOLEAN     DEFAULT FALSE   -- TRUE only when all cards were answered
);

-- 2. Create daily_log table
CREATE TABLE IF NOT EXISTS daily_log (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id     UUID        REFERENCES flashcards(id) ON DELETE CASCADE NOT NULL,
  set_id      UUID        REFERENCES study_sets(id) ON DELETE CASCADE NOT NULL,
  event_type  TEXT        NOT NULL CHECK (event_type IN ('learned', 'forgotten')),
  -- 'learned'  = first correct answer (mastery was 0, now > 0)
  -- 'forgotten' = wrong answer on a mastered card (mastery was >= 3)
  logged_at   DATE        DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_id, logged_at, event_type)
);

CREATE INDEX IF NOT EXISTS daily_log_user_date ON daily_log(user_id, logged_at);
CREATE INDEX IF NOT EXISTS daily_log_set ON daily_log(set_id, logged_at);

-- 3. Add columns to progress table
ALTER TABLE progress ADD COLUMN IF NOT EXISTS last_result TEXT
  CHECK (last_result IN ('correct', 'wrong')) DEFAULT NULL;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS session_id UUID DEFAULT NULL;

-- 4. RLS: study_sessions
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own sessions"
  ON study_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON study_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON study_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. RLS: daily_log
ALTER TABLE daily_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own daily logs"
  ON daily_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily logs"
  ON daily_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
