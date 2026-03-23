import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { todayVN } from '../utils/time';

export interface UseWriteQueueReturn {
  /** Total cards due for writing today (review + capped new). */
  writeCount: number;
  /** Cards due for review (previously written, now overdue). No daily limit. */
  reviewWriteCount: number;
  /** New cards available today (capped by dailyNewLimit). */
  newWriteCount: number;
  loading: boolean;
  refetch: () => void;
}

/**
 * Counts cards in a set that are due for Write mode today.
 *
 * - Review cards: writer_next_review_at <= now()  → no limit
 * - New cards:    writer_next_review_at IS NULL    → capped at dailyNewLimit per day
 *
 * Daily new-write counter is tracked via daily_log event_type = 'write_new'.
 */
export function useWriteQueue(
  setId: string | undefined,
  dailyNewLimit = 10,
): UseWriteQueueReturn {
  const { user } = useAuth();
  const [reviewWriteCount, setReviewWriteCount] = useState(0);
  const [newWriteCount, setNewWriteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!setId || !user?.id) {
      setLoading(false);
      return;
    }

    if (isMockMode) {
      setReviewWriteCount(0);
      setNewWriteCount(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const now   = new Date().toISOString();
      const today = todayVN();

      // ── 1. All flashcard IDs in this set ─────────────────────────────────
      const { data: cardRows } = await supabase
        .from('flashcards')
        .select('id')
        .eq('set_id', setId);

      if (cancelled) return;
      if (!cardRows || cardRows.length === 0) {
        setReviewWriteCount(0);
        setNewWriteCount(0);
        setLoading(false);
        return;
      }

      const allCardIds: string[] = cardRows.map((r: any) => r.id);

      // ── 2. Progress rows with writer fields ───────────────────────────────
      const { data: progressRows } = await supabase
        .from('progress')
        .select('card_id, writer_next_review_at')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .in('card_id', allCardIds);

      if (cancelled) return;

      const progressMap = new Map<string, string | null>();
      (progressRows ?? []).forEach((r: any) => {
        progressMap.set(r.card_id, r.writer_next_review_at ?? null);
      });

      // ── 3. Categorise cards ───────────────────────────────────────────────
      let review = 0;
      let newTotal = 0;

      for (const id of allCardIds) {
        const writerReviewAt = progressMap.get(id); // undefined = no row; null = row exists but null
        if (writerReviewAt === undefined || writerReviewAt === null) {
          // Never written → new card
          newTotal++;
        } else if (writerReviewAt <= now) {
          // Previously written and overdue → review
          review++;
        }
        // writerReviewAt > now → not due yet, skip
      }

      // ── 4. How many new-write cards already done today? ───────────────────
      const { count: newWriteToday } = await supabase
        .from('daily_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id',    user.id)
        .eq('set_id',     setId)
        .eq('event_type', 'write_new')
        .eq('logged_at',  today);

      if (cancelled) return;

      const slotsLeft  = Math.max(0, dailyNewLimit - (newWriteToday ?? 0));
      const cappedNew  = Math.min(newTotal, slotsLeft);

      setReviewWriteCount(review);
      setNewWriteCount(cappedNew);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id, setId, dailyNewLimit, tick]);

  return {
    writeCount:       reviewWriteCount + newWriteCount,
    reviewWriteCount,
    newWriteCount,
    loading,
    refetch,
  };
}
