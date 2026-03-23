import { useState, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { todayVN } from '../utils/time';
import {
  computeProgressUpdate,
  computeWriterScoreUpdate,
  getMasteryBadge,
  type ProgressSnapshot,
} from '../lib/masteryEngine';
import type { StudyMode } from '../types';

export interface SubmitResult {
  /** New mastery level after this answer */
  newMasteryLevel: number;
  /** Badge label for the new level */
  badge: ReturnType<typeof getMasteryBadge>;
  /** True if the card just became a leech (triggered on this exact answer) */
  becameLeech: boolean;
}

export interface UseProgressUpdaterReturn {
  submitAnswer: (
    cardId: string,
    isCorrect: boolean,
    mode: StudyMode,
    setId: string,
  ) => Promise<SubmitResult>;
  /** Marks a card as "seen" for the first time (creates progress row + logs học mới). No-op if row already exists. */
  markAsSeen: (cardId: string, setId: string) => Promise<void>;
  isUpdating: boolean;
}

const DEFAULT_SNAPSHOT: ProgressSnapshot = {
  mastery_level: 1,
  consecutive_correct: 0,
  ease_factor: 2.5,
  penalty_count: 0,
  is_leech: false,
  leech_detected_at: null,
};

export function useProgressUpdater(): UseProgressUpdaterReturn {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const submitAnswer = useCallback(
    async (
      cardId: string,
      isCorrect: boolean,
      mode: StudyMode,
      setId: string,
    ): Promise<SubmitResult> => {
      const now = new Date();

      if (!user?.id || isMockMode) {
        // Mock mode: compute locally without DB
        const update = computeProgressUpdate(DEFAULT_SNAPSHOT, isCorrect, mode, now);
        return {
          newMasteryLevel: update.mastery_level,
          badge: getMasteryBadge(update.mastery_level),
          becameLeech: update.is_leech && !DEFAULT_SNAPSHOT.is_leech,
        };
      }

      setIsUpdating(true);
      try {
        // 1. Fetch current snapshot from DB
        const { data: existing } = await supabase
          .from('progress')
          .select(
            'mastery_level, consecutive_correct, ease_factor, penalty_count, is_leech, leech_detected_at, writer_score, writer_next_review_at',
          )
          .eq('user_id', user.id)
          .eq('card_id', cardId)
          .maybeSingle();

        const snapshot: ProgressSnapshot = existing
          ? {
              mastery_level:      existing.mastery_level      ?? 1,
              consecutive_correct: existing.consecutive_correct ?? 0,
              ease_factor:        existing.ease_factor        ?? 2.5,
              penalty_count:      existing.penalty_count      ?? 0,
              is_leech:           existing.is_leech           ?? false,
              leech_detected_at:  existing.leech_detected_at  ?? null,
            }
          : { ...DEFAULT_SNAPSHOT };

        // 2. Compute new state (pure — no side effects)
        const update = computeProgressUpdate(snapshot, isCorrect, mode, now);
        const becameLeech = update.is_leech && !snapshot.is_leech;

        // 3. Upsert progress
        await supabase.from('progress').upsert(
          {
            user_id:              user.id,
            card_id:              cardId,
            set_id:               setId,
            mastery_level:        update.mastery_level,
            consecutive_correct:  update.consecutive_correct,
            ease_factor:          update.ease_factor,
            last_reviewed_at:     update.last_reviewed_at,
            next_review_at:       update.next_review_at,
            last_result:          update.last_result,
            penalty_count:        update.penalty_count,
            is_leech:             update.is_leech,
            leech_detected_at:    update.leech_detected_at,
            updated_at:           update.last_reviewed_at,
          },
          { onConflict: 'user_id,card_id' },
        );

        // 3b. Update writer_score when mode is 'write'
        if (mode === 'write') {
          const prevWriterScore = existing?.writer_score ?? 0;
          const isFirstWrite = prevWriterScore === 0 && !existing?.writer_next_review_at;
          const writerUpdate = computeWriterScoreUpdate(
            prevWriterScore,
            isCorrect,
            now,
          );
          await supabase.from('progress').upsert(
            {
              user_id:                user.id,
              card_id:                cardId,
              set_id:                 setId,
              writer_score:           writerUpdate.writer_score,
              writer_next_review_at:  writerUpdate.writer_next_review_at,
            },
            { onConflict: 'user_id,card_id' },
          );
          // Log write_new once per card per day (first-time write only)
          if (isFirstWrite) {
            const today = todayVN();
            await supabase.from('daily_log').upsert(
              {
                user_id:    user.id,
                card_id:    cardId,
                set_id:     setId,
                event_type: 'write_new',
                logged_at:  today,
              },
              { onConflict: 'user_id,card_id,logged_at,event_type', ignoreDuplicates: true },
            );
          }
        }

        // 4. Write daily_log events
        //    'learned'   = card seen for the first time (no prior progress row)
        //    'forgotten' = any wrong answer on an existing card (deduped to once per card per day)
        //    'reviewed'  = correct answer on an existing card (deduped to once per card per day)
        const today = todayVN();

        if (!existing) {
          // First interaction ever — card transitions from "chưa học" → "đang học"
          await supabase.from('daily_log').upsert(
            {
              user_id:    user.id,
              card_id:    cardId,
              set_id:     setId,
              event_type: 'learned',
              logged_at:  today,
            },
            { onConflict: 'user_id,card_id,logged_at,event_type', ignoreDuplicates: true },
          );
        } else if (!isCorrect) {
          // Any wrong answer on an existing card → "đã quên"
          // ignoreDuplicates ensures each card is only counted as forgotten once per day,
          // even when the intensive loop re-queues it and the user answers wrong again.
          await supabase.from('daily_log').upsert(
            {
              user_id:    user.id,
              card_id:    cardId,
              set_id:     setId,
              event_type: 'forgotten',
              logged_at:  today,
            },
            { onConflict: 'user_id,card_id,logged_at,event_type', ignoreDuplicates: true },
          );
        } else {
          // Correct answer on an existing card — log 'reviewed' once per card per day
          await supabase.from('daily_log').upsert(
            {
              user_id:    user.id,
              card_id:    cardId,
              set_id:     setId,
              event_type: 'reviewed',
              logged_at:  today,
            },
            { onConflict: 'user_id,card_id,logged_at,event_type', ignoreDuplicates: true },
          );
        }

        return {
          newMasteryLevel: update.mastery_level,
          badge: getMasteryBadge(update.mastery_level),
          becameLeech,
        };
      } finally {
        setIsUpdating(false);
      }
    },
    [user?.id],
  );

  const markAsSeen = useCallback(
    async (cardId: string, setId: string): Promise<void> => {
      if (!user?.id || isMockMode) return;
      const now = new Date();
      const today = todayVN();

      // DB-level guard: if a progress row already exists, do nothing.
      // This prevents stale 'learned' events caused by any race condition.
      const { data: existing } = await supabase
        .from('progress')
        .select('card_id')
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .maybeSingle();

      if (existing) return;

      // Truly first time — create progress row
      await supabase.from('progress').upsert(
        {
          user_id:             user.id,
          card_id:             cardId,
          set_id:              setId,
          mastery_level:       1,
          consecutive_correct: 0,
          ease_factor:         2.5,
          penalty_count:       0,
          is_leech:            false,
          last_reviewed_at:    now.toISOString(),
          next_review_at:      new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
          last_result:         'correct',
          updated_at:          now.toISOString(),
        },
        { onConflict: 'user_id,card_id', ignoreDuplicates: true },
      );

      // Log 'học mới' for today — deduplicated by unique constraint
      await supabase.from('daily_log').upsert(
        {
          user_id:    user.id,
          card_id:    cardId,
          set_id:     setId,
          event_type: 'learned',
          logged_at:  today,
        },
        { onConflict: 'user_id,card_id,logged_at,event_type', ignoreDuplicates: true },
      );
    },
    [user?.id],
  );

  return { submitAnswer, markAsSeen, isUpdating };
}
