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

      let results: CardResult[];
      try {
      results = [...resultsRef.current];

      // Note: mastery_level updates and daily_log writes are handled by
      // useProgressUpdater (Phase 7). This hook only records session stats.
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
        localStorage.removeItem(`quizi_session_${setId}`);
      } catch (err) {
        console.error('[useStudySession] saveToDB failed:', err);
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
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
