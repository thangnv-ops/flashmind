import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface UseWriteQueueReturn {
  writeCount: number;
  loading: boolean;
  refetch: () => void;
}

/**
 * Counts cards in a set that are due for Write mode today.
 * A card is "due for writing" when:
 *   - It has no progress row yet (never written)
 *   - OR its writer_next_review_at <= now()
 */
export function useWriteQueue(setId: string | undefined): UseWriteQueueReturn {
  const { user } = useAuth();
  const [writeCount, setWriteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!setId || !user?.id) {
      setLoading(false);
      return;
    }

    if (isMockMode) {
      setWriteCount(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const now = new Date().toISOString();

      // 1. All flashcard IDs in this set
      const { data: cardRows } = await supabase
        .from('flashcards')
        .select('id')
        .eq('set_id', setId);

      if (cancelled) return;
      if (!cardRows || cardRows.length === 0) {
        setWriteCount(0);
        setLoading(false);
        return;
      }

      const allCardIds: string[] = cardRows.map((r: any) => r.id);

      // 2. Progress rows that have writer_next_review_at > now (NOT yet due)
      const { data: notDueRows } = await supabase
        .from('progress')
        .select('card_id')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .not('writer_next_review_at', 'is', null)
        .gt('writer_next_review_at', now);

      if (cancelled) return;

      const notDueIds = new Set((notDueRows ?? []).map((r: any) => r.card_id));
      const dueCount = allCardIds.filter(id => !notDueIds.has(id)).length;

      setWriteCount(dueCount);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id, setId, tick]);

  return { writeCount, loading, refetch };
}
