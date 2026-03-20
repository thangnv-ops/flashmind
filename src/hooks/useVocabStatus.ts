import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_SETS } from '../mockData';
import type { Flashcard } from '../types';

export interface VocabGroup {
  mastered: Flashcard[];    // mastery_level >= 8: đã thành thạo
  inProgress: Flashcard[];  // có row trong progress AND mastery_level < 8: đang học
  notStarted: Flashcard[];  // KHÔNG có row trong progress: chưa từng học qua bất kỳ hình thức nào
}

/**
 * Loads all flashcards for a set and joins with the user's progress
 * to bucket them into mastered / in-progress / not-started.
 */
export function useVocabStatus(setId: string | undefined) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<VocabGroup>({
    mastered: [],
    inProgress: [],
    notStarted: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!setId) {
      setLoading(false);
      return;
    }

    if (isMockMode) {
      const set = MOCK_SETS.find(s => s.id === setId);
      const cards = (set?.flashcards ?? []) as Flashcard[];
      setGroups({ mastered: [], inProgress: [], notStarted: cards });
      setLoading(false);
      return;
    }

    if (!user?.id) return;
    setLoading(true);

    const { data: cards } = await supabase
      .from('flashcards')
      .select('*')
      .eq('set_id', setId)
      .order('position');

    if (!cards || cards.length === 0) {
      setGroups({ mastered: [], inProgress: [], notStarted: [] });
      setLoading(false);
      return;
    }

    const cardIds = cards.map((c: any) => c.id);

    const { data: progress } = await supabase
      .from('progress')
      .select('card_id, mastery_level')
      .eq('user_id', user.id)
      .in('card_id', cardIds);

    const masteryMap = new Map<string, number>();
    (progress ?? []).forEach((p: any) => masteryMap.set(p.card_id, p.mastery_level));

    const mastered: Flashcard[] = [];
    const inProgress: Flashcard[] = [];
    const notStarted: Flashcard[] = [];

    cards.forEach((card: any) => {
      const flashcard = card as Flashcard;
      if (!masteryMap.has(card.id)) {
        notStarted.push(flashcard);
      } else {
        const mastery = masteryMap.get(card.id)!;
        if (mastery >= 8) mastered.push(flashcard);
        else inProgress.push(flashcard);
      }
    });

    setGroups({ mastered, inProgress, notStarted });
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, user?.id]);

  // Fetch on mount / when setId or user changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch when user returns to this tab/page (handles tab switch + bfcache restore).
  // visibilitychange is more reliable than window.focus for SPA + browser tab switching.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchData]);

  return { groups, loading, refetch: fetchData };
}
