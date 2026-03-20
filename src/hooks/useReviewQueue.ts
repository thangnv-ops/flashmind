import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ReviewCard {
  card_id: string;
  term: string;
  definition: string;
  mastery_level: number;
  next_review_at: string;
  ease_factor: number;
  is_leech: boolean;
}

export interface UseReviewQueueReturn {
  /** Cards with next_review_at <= NOW(), ordered by mastery ASC then overdue longest */
  dueCards: ReviewCard[];
  /** Total count of due cards */
  totalDue: number;
  loading: boolean;
  refetch: () => void;
}

/**
 * Fetches cards that are due for review.
 * @param setId optional — if provided, only returns cards from that set.
 */
export function useReviewQueue(setId?: string): UseReviewQueueReturn {
  const { user } = useAuth();
  const [dueCards, setDueCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    if (isMockMode) {
      setDueCards([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      let query = supabase
        .from('progress')
        .select(
          `
          card_id,
          mastery_level,
          next_review_at,
          ease_factor,
          is_leech,
          flashcards!inner ( term, definition )
        `,
        )
        .eq('user_id', user.id)
        .lte('next_review_at', new Date().toISOString())
        .order('mastery_level', { ascending: true })
        .order('next_review_at', { ascending: true })
        .limit(50);

      if (setId) {
        query = query.eq('set_id', setId);
      }

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        console.error('[useReviewQueue]', error.message);
        setDueCards([]);
      } else {
        const cards: ReviewCard[] = (data ?? []).map((row: any) => ({
          card_id:       row.card_id,
          term:          row.flashcards.term,
          definition:    row.flashcards.definition,
          mastery_level: row.mastery_level,
          next_review_at: row.next_review_at,
          ease_factor:   row.ease_factor ?? 2.5,
          is_leech:      row.is_leech ?? false,
        }));
        setDueCards(cards);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, setId, tick]);

  return { dueCards, totalDue: dueCards.length, loading, refetch };
}
