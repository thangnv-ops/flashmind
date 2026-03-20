import { useState, useEffect } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_SETS } from '../mockData';
import type { Flashcard } from '../types';

export interface VocabGroup {
  mastered: Flashcard[];    // mastery_level >= 3
  inProgress: Flashcard[];  // mastery_level 1–2
  notStarted: Flashcard[];  // mastery_level = 0 or no row in progress
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

  useEffect(() => {
    if (!setId) return;

    if (isMockMode) {
      const set = MOCK_SETS.find(s => s.id === setId);
      const cards = (set?.flashcards ?? []) as Flashcard[];
      setGroups({ mastered: [], inProgress: [], notStarted: cards });
      setLoading(false);
      return;
    }

    const fetchData = async () => {
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
        .eq('user_id', user!.id)
        .in('card_id', cardIds);

      const masteryMap = new Map<string, number>();
      (progress ?? []).forEach((p: any) => masteryMap.set(p.card_id, p.mastery_level));

      const mastered: Flashcard[] = [];
      const inProgress: Flashcard[] = [];
      const notStarted: Flashcard[] = [];

      cards.forEach((card: any) => {
        const mastery = masteryMap.get(card.id) ?? 0;
        const flashcard = card as Flashcard;
        if (mastery >= 3) mastered.push(flashcard);
        else if (mastery >= 1) inProgress.push(flashcard);
        else notStarted.push(flashcard);
      });

      setGroups({ mastered, inProgress, notStarted });
      setLoading(false);
    };

    fetchData();
  }, [setId, user?.id]);

  return { groups, loading };
}
