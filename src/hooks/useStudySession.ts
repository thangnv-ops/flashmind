import { useRef, useEffect, useCallback, useState } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { StudyMode } from '../types';

interface CardResult {
  cardId: string;
  isCorrect: boolean;
}

/**
 * Manages a study session: creates a DB row on mount, records per-card
 * results in memory, and flushes everything (progress upsert + daily_log +
 * session update) on explicit pauseSession() / finishSession() calls.
 *
 * Also saves a localStorage backup on `beforeunload` so results aren't lost
 * if the user closes the tab without pressing "Pause & Save".
 */
export function useStudySession(setId: string | undefined, mode: StudyMode) {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const resultsRef = useRef<CardResult[]>([]);
  const isSavingRef = useRef(false);
  const [resultsCount, setResultsCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Create session row + register beforeunload handler
  useEffect(() => {
    if (!setId || !user?.id || isMockMode) {
      if (isMockMode) sessionIdRef.current = `mock-${Date.now()}`;
      return;
    }

    supabase
      .from('study_sessions')
      .insert({ user_id: user.id, set_id: setId, mode, cards_total: 0 })
      .select('id')
      .single()
      .then(({ data }) => {
        if (data) sessionIdRef.current = data.id;
      });

    const handleBeforeUnload = () => {
      if (resultsRef.current.length === 0) return;
      try {
        localStorage.setItem(
          `quizi_session_${setId}`,
          JSON.stringify({
            sessionId: sessionIdRef.current,
            results: resultsRef.current,
            mode,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // storage quota — ignore
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      localStorage.removeItem(`quizi_session_${setId}`);
    };
  }, [setId, user?.id, mode]);

  /** Call after each question answered. */
  const recordResult = useCallback((cardId: string, isCorrect: boolean) => {
    resultsRef.current.push({ cardId, isCorrect });
    setResultsCount(c => c + 1);
  }, []);

  const saveToDB = useCallback(
    async (isComplete: boolean, cardsTotal: number) => {
      if (!setId || !user?.id || isMockMode) return;
      if (isSavingRef.current || resultsRef.current.length === 0) return;

      isSavingRef.current = true;
      setIsSaving(true);

      const results = [...resultsRef.current];

      // Keep only the last result per card (card may appear multiple times)
      const lastResultMap = new Map<string, boolean>();
      results.forEach(r => lastResultMap.set(r.cardId, r.isCorrect));
      const cardIds = [...lastResultMap.keys()];

      // Fetch current mastery levels so we can compute deltas
      const { data: currentProgress } = await supabase
        .from('progress')
        .select('card_id, mastery_level')
        .eq('user_id', user.id)
        .in('card_id', cardIds);

      const masteryMap = new Map<string, number>();
      (currentProgress ?? []).forEach((p: any) => masteryMap.set(p.card_id, p.mastery_level));

      const progressUpserts: any[] = [];
      const dailyLogInserts: any[] = [];
      const today = new Date().toISOString().split('T')[0];

      lastResultMap.forEach((isCorrect, cardId) => {
        const prevMastery = masteryMap.get(cardId) ?? 0;
        const newMastery = isCorrect
          ? Math.min(prevMastery + 1, 5)
          : Math.max(prevMastery - 1, 0);

        progressUpserts.push({
          user_id: user.id,
          card_id: cardId,
          mastery_level: newMastery,
          last_result: isCorrect ? 'correct' : 'wrong',
          session_id: sessionIdRef.current,
          updated_at: new Date().toISOString(),
        });

        // 'learned': first time answering this card correctly
        if (isCorrect && prevMastery === 0) {
          dailyLogInserts.push({
            user_id: user.id,
            card_id: cardId,
            set_id: setId,
            event_type: 'learned',
            logged_at: today,
          });
        }
        // 'forgotten': was mastered (≥3), now answered wrong
        if (!isCorrect && prevMastery >= 3) {
          dailyLogInserts.push({
            user_id: user.id,
            card_id: cardId,
            set_id: setId,
            event_type: 'forgotten',
            logged_at: today,
          });
        }
      });

      await supabase
        .from('progress')
        .upsert(progressUpserts, { onConflict: 'user_id,card_id' });

      if (dailyLogInserts.length > 0) {
        await supabase
          .from('daily_log')
          .upsert(dailyLogInserts, {
            onConflict: 'user_id,card_id,logged_at,event_type',
            ignoreDuplicates: true,
          });
      }

      if (sessionIdRef.current) {
        await supabase
          .from('study_sessions')
          .update({
            cards_total: cardsTotal,
            cards_done: results.length,
            cards_correct: results.filter(r => r.isCorrect).length,
            ended_at: new Date().toISOString(),
            is_complete: isComplete,
          })
          .eq('id', sessionIdRef.current);
      }

      resultsRef.current = [];
      setResultsCount(0);
      isSavingRef.current = false;
      setIsSaving(false);
      localStorage.removeItem(`quizi_session_${setId}`);
    },
    [setId, user?.id],
  );

  const pauseSession = useCallback(
    (cardsTotal: number) => saveToDB(false, cardsTotal),
    [saveToDB],
  );

  const finishSession = useCallback(
    (cardsTotal: number) => saveToDB(true, cardsTotal),
    [saveToDB],
  );

  return { recordResult, pauseSession, finishSession, resultsCount, isSaving };
}
