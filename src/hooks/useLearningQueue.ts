import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { todayVN } from '../utils/time';
import type { Flashcard } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────
export const DEFAULT_DAILY_NEW_LIMIT = 10;

// ─── Types ────────────────────────────────────────────────────────────────────
/**
 * Which "bucket" a card came from when the session was built:
 *   urgent  = Bucket A (mastery 1-2, overdue) — shown in red
 *   review  = Bucket B (mastery ≥ 3, overdue) — shown in blue
 *   new     = Bucket C (no progress row yet)  — shown in green
 *
 * When a user answers a card *wrong* during the intensive loop, its bucket
 * is re-labelled 'urgent' so the queue indicator reflects the extra red cards.
 */
export type CardBucket = 'urgent' | 'review' | 'new';

export interface QueuedCard extends Flashcard {
  bucket: CardBucket;
  mastery_level: number;
}

export interface QueueCounts {
  urgent: number;
  review: number;
  new: number;
}

export interface UseLearningQueueReturn {
  /** Ordered queue for this session (shrinks as correct answers accumulate). */
  queue: QueuedCard[];
  /** Convenience: queue[0] — the card the user should answer right now. */
  currentCard: QueuedCard | null;
  /** Live bucket counts for the QueueIndicator component. */
  counts: QueueCounts;
  /** IDs of cards answered correctly at least once this session. */
  correctCardIds: Set<string>;
  /** Overdue cards only (urgent + review), excludes new cards. Used for "Ôn tập hôm nay" display. */
  reviewTotal: number;
  /** Total cards in the session: overdue + new. Used for Learn/Write button counts. */
  sessionTotal: number;
  /**
   * True once every card in the original session has been answered correctly
   * at least once — signals the end of the intensive loop.
   */
  isComplete: boolean;
  loading: boolean;
  /**
   * Call when the user answers CORRECTLY.
   * Removes the card from the queue; adds its ID to correctCardIds.
   */
  answerCorrect: (cardId: string) => void;
  /**
   * Call when the user answers WRONGLY.
   * Pushes the card to the END of the queue and re-labels it 'urgent'
   * so it gets another chance (intensive loop).
   */
  answerWrong: (cardId: string) => void;
  /** Reload the queue from the DB (e.g. after finishing a session). */
  refetch: () => void;
  /** Number of new cards already studied today (for Settings display). */
  newCardsToday: number;
  /** The daily new-card cap passed to the hook. */
  dailyNewLimit: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLearningQueue(
  setId: string | undefined,
  dailyNewLimit = DEFAULT_DAILY_NEW_LIMIT,
): UseLearningQueueReturn {
  const { user } = useAuth();

  const [queue, setQueue]                 = useState<QueuedCard[]>([]);
  const [correctCardIds, setCorrectCardIds] = useState<Set<string>>(new Set());
  const [originalCardIds, setOriginalCardIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]             = useState(true);
  const [newCardsToday, setNewCardsToday] = useState(0);
  const [tick, setTick]                   = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!setId || !user?.id) {
      setLoading(false);
      return;
    }

    if (isMockMode) {
      setQueue([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const now   = new Date().toISOString();
      const today = todayVN();

      // ── How many NEW cards has the user already studied today (this set)? ─
      const { count: newTodayCount } = await supabase
        .from('daily_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id',    user.id)
        .eq('set_id',     setId)
        .eq('event_type', 'learned')
        .eq('logged_at',  today);

      const newCount     = newTodayCount ?? 0;
      const newSlotsLeft = Math.max(0, dailyNewLimit - newCount);

      // ── Bucket A: mastery 1-2 AND overdue (fetch ALL) ───────────────────
      const { data: urgentRows } = await supabase
        .from('progress')
        .select(`
          card_id,
          mastery_level,
          flashcards!inner ( id, set_id, term, definition, image_url, is_starred, position )
        `)
        .eq('user_id', user.id)
        .eq('set_id',  setId)
        .lt('mastery_level',   3)
        .lte('next_review_at', now)
        .order('mastery_level',   { ascending: true })
        .order('next_review_at',  { ascending: true });

      // ── Bucket B: mastery ≥ 3 AND overdue (fetch ALL) ───────────────────
      const { data: reviewRows } = await supabase
        .from('progress')
        .select(`
          card_id,
          mastery_level,
          flashcards!inner ( id, set_id, term, definition, image_url, is_starred, position )
        `)
        .eq('user_id', user.id)
        .eq('set_id',  setId)
        .gte('mastery_level',  3)
        .lte('next_review_at', now)
        .order('next_review_at', { ascending: true });

      // ── Bucket C: new cards fill remaining daily slots ───────────────────
      const newLimit = newSlotsLeft;

      let finalNew: QueuedCard[] = [];
      if (newLimit > 0) {
        const { data: seenProgress } = await supabase
          .from('progress')
          .select('card_id')
          .eq('user_id', user.id)
          .eq('set_id',  setId);

        const seenIds = new Set((seenProgress ?? []).map((p: any) => p.card_id as string));

        const { data: allFlashcards } = await supabase
          .from('flashcards')
          .select('id, set_id, term, definition, image_url, is_starred, position')
          .eq('set_id', setId)
          .order('position', { ascending: true })
          .limit(newLimit + seenIds.size + 20);

        finalNew = (allFlashcards ?? [])
          .filter((fc: any) => !seenIds.has(fc.id as string))
          .slice(0, newLimit)
          .map((fc: any): QueuedCard => ({
            id:          fc.id,
            set_id:      fc.set_id,
            term:        fc.term,
            definition:  fc.definition,
            image_url:   fc.image_url ?? null,
            is_starred:  fc.is_starred,
            position:    fc.position,
            bucket:      'new',
            mastery_level: 0,
          }));
      }

      if (cancelled) return;

      const mapProgress = (row: any, bucket: CardBucket): QueuedCard => ({
        id:           row.card_id,
        set_id:       row.flashcards.set_id,
        term:         row.flashcards.term,
        definition:   row.flashcards.definition,
        image_url:    row.flashcards.image_url ?? null,
        is_starred:   row.flashcards.is_starred,
        position:     row.flashcards.position,
        bucket,
        mastery_level: row.mastery_level,
      });

      const urgentCards: QueuedCard[] = (urgentRows ?? []).map(r => mapProgress(r, 'urgent'));
      const reviewCards: QueuedCard[] = (reviewRows ?? []).map(r => mapProgress(r, 'review'));

      const combined = [...urgentCards, ...reviewCards, ...finalNew];
      const ids       = new Set(combined.map(c => c.id));

      setQueue(combined);
      setOriginalCardIds(ids);
      setCorrectCardIds(new Set());
      setNewCardsToday(newCount);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id, setId, dailyNewLimit, tick]);

  // ── Derived state ────────────────────────────────────────────────────────────
  const counts: QueueCounts = {
    urgent: queue.filter(c => c.bucket === 'urgent').length,
    review: queue.filter(c => c.bucket === 'review').length,
    new:    queue.filter(c => c.bucket === 'new').length,
  };

  const isComplete =
    originalCardIds.size > 0 &&
    correctCardIds.size >= originalCardIds.size;

  // ── Intensive-loop actions ─────────────────────────────────────────────────
  /** Correct answer → remove from queue, record completion. */
  const answerCorrect = useCallback((cardId: string) => {
    setQueue(prev => prev.filter(c => c.id !== cardId));
    setCorrectCardIds(prev => new Set([...prev, cardId]));
  }, []);

  /**
   * Wrong answer → push card to END of queue with bucket = 'urgent'.
   * The card will be shown again until the user gets it right (intensive loop).
   */
  const answerWrong = useCallback((cardId: string) => {
    setQueue(prev => {
      const idx = prev.findIndex(c => c.id === cardId);
      if (idx === -1) return prev;
      const card: QueuedCard = { ...prev[idx], bucket: 'urgent' };
      // Remove from current position, append at end
      return [...prev.slice(0, idx), ...prev.slice(idx + 1), card];
    });
  }, []);

  return {
    queue,
    currentCard: queue[0] ?? null,
    counts,
    correctCardIds,
    reviewTotal: counts.urgent + counts.review,
    sessionTotal: originalCardIds.size,
    isComplete,
    loading,
    answerCorrect,
    answerWrong,
    refetch,
    newCardsToday,
    dailyNewLimit,
  };
}
