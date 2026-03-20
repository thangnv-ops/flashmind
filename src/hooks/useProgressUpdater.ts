import { useState, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  computeProgressUpdate,
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
            'mastery_level, consecutive_correct, ease_factor, penalty_count, is_leech, leech_detected_at',
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

        // 4. Write daily_log events
        //    'learned'  = first correct answer (prev mastery was 1, default start)
        //    'forgotten' = wrong answer on a well-mastered card (prev mastery >= 7)
        const today = now.toISOString().split('T')[0];

        if (isCorrect && snapshot.mastery_level <= 1) {
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
        } else if (!isCorrect && snapshot.mastery_level >= 7) {
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

  return { submitAnswer, isUpdating };
}
