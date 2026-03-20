-- Phase 8 Patch: add 'reviewed' event type to daily_log
-- Allows tracking cards that are actively being practiced in the "đang học" state.

-- Drop the old CHECK constraint (auto-named by Postgres)
ALTER TABLE daily_log DROP CONSTRAINT IF EXISTS daily_log_event_type_check;

-- Re-add it with the extended set of allowed values
ALTER TABLE daily_log
  ADD CONSTRAINT daily_log_event_type_check
  CHECK (event_type IN ('learned', 'forgotten', 'reviewed'));
