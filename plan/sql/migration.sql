-- ============================================================
-- Quizi App — Database Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- NOTE: Users are managed by Supabase Auth (auth.users).
-- No separate users table needed.

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

CREATE TABLE folders (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE study_sets (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id     UUID        REFERENCES folders(id) ON DELETE SET NULL,
  title         TEXT        NOT NULL,
  description   TEXT,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE flashcards (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id      UUID        REFERENCES study_sets(id) ON DELETE CASCADE NOT NULL,
  term        TEXT        NOT NULL,
  definition  TEXT        NOT NULL,
  image_url   TEXT,
  is_starred  BOOLEAN     DEFAULT FALSE,
  position    INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE progress (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id       UUID        REFERENCES flashcards(id) ON DELETE CASCADE NOT NULL,
  mastery_level INTEGER     DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

CREATE TABLE match_records (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  set_id       UUID        REFERENCES study_sets(id) ON DELETE CASCADE NOT NULL,
  best_time_ms INTEGER     NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, set_id)
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- IMPORTANT: Must enable RLS on every table so users can only
-- access their own data.
-- ------------------------------------------------------------

ALTER TABLE folders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_records ENABLE ROW LEVEL SECURITY;

-- Folders: user owns their own folders
CREATE POLICY "Users manage own folders"
  ON folders FOR ALL
  USING (auth.uid() = user_id);

-- Study Sets: user owns their own sets
CREATE POLICY "Users manage own study sets"
  ON study_sets FOR ALL
  USING (auth.uid() = user_id);

-- Flashcards: access via parent study_set ownership
CREATE POLICY "Users manage own flashcards"
  ON flashcards FOR ALL
  USING (
    set_id IN (
      SELECT id FROM study_sets WHERE user_id = auth.uid()
    )
  );

-- Progress: user owns their own progress records
CREATE POLICY "Users manage own progress"
  ON progress FOR ALL
  USING (auth.uid() = user_id);

-- Match Records: user owns their own personal bests
CREATE POLICY "Users manage own match records"
  ON match_records FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- INDEXES (performance)
-- ------------------------------------------------------------

CREATE INDEX idx_study_sets_user_id    ON study_sets(user_id);
CREATE INDEX idx_study_sets_last_acc   ON study_sets(last_accessed DESC);
CREATE INDEX idx_flashcards_set_id     ON flashcards(set_id);
CREATE INDEX idx_flashcards_position   ON flashcards(set_id, position);
CREATE INDEX idx_progress_user_card    ON progress(user_id, card_id);
CREATE INDEX idx_match_records_user    ON match_records(user_id, set_id);
