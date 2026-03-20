import { useState, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import type { StudySet, Flashcard } from '../types';
import { MOCK_SETS } from '../mockData';

export interface CardInput {
  id?: string;
  term: string;
  definition: string;
  image_url?: string | null;
  position: number;
}

export function useStudySets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStudySets = useCallback(async (): Promise<StudySet[]> => {
    if (isMockMode) {
      return MOCK_SETS;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('study_sets')
        .select(`
          *,
          flashcards(count)
        `)
        .order('last_accessed', { ascending: false })
        .limit(20);

      if (err) throw err;

      return (data ?? []).map((row: any) => ({
        ...row,
        // card_count comes from the aggregate
        flashcards: undefined,
      })) as StudySet[];
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getStudySet = useCallback(async (setId: string): Promise<StudySet | null> => {
    if (isMockMode) {
      return MOCK_SETS.find(s => s.id === setId) ?? null;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: setData, error: setErr } = await supabase
        .from('study_sets')
        .select('*')
        .eq('id', setId)
        .single();

      if (setErr) throw setErr;

      const { data: cards, error: cardsErr } = await supabase
        .from('flashcards')
        .select('*')
        .eq('set_id', setId)
        .order('position', { ascending: true });

      if (cardsErr) throw cardsErr;

      return { ...setData, flashcards: cards ?? [] } as StudySet;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createStudySet = useCallback(
    async (
      title: string,
      description: string,
      cards: CardInput[],
      userId: string,
      folderId?: string | null,
    ): Promise<StudySet | null> => {
      if (isMockMode) {
        const mock: StudySet = {
          id: Math.random().toString(36).substr(2, 9),
          user_id: userId,
          title,
          description,
          folder_id: folderId ?? null,
          last_accessed: new Date().toISOString(),
          created_at: new Date().toISOString(),
          flashcards: cards.map((c, i) => ({
            id: Math.random().toString(36).substr(2, 9),
            set_id: 'mock',
            term: c.term,
            definition: c.definition,
            image_url: c.image_url ?? null,
            is_starred: false,
            position: i,
          })),
        };
        return mock;
      }

      setLoading(true);
      setError(null);
      try {
        const { data: setData, error: setErr } = await supabase
          .from('study_sets')
          .insert({
            user_id: userId,
            title,
            description: description || null,
            folder_id: folderId ?? null,
            last_accessed: new Date().toISOString(),
          })
          .select()
          .single();

        if (setErr) throw setErr;

        const cardPayload: Omit<Flashcard, 'id'>[] = cards.map((c, i) => ({
          set_id: setData.id,
          term: c.term,
          definition: c.definition,
          image_url: c.image_url ?? null,
          is_starred: false,
          position: i,
        }));

        const { data: insertedCards, error: cardsErr } = await supabase
          .from('flashcards')
          .insert(cardPayload)
          .select();

        if (cardsErr) throw cardsErr;

        return { ...setData, flashcards: insertedCards ?? [] } as StudySet;
      } catch (e: any) {
        setError(e.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const updateStudySet = useCallback(
    async (
      setId: string,
      title: string,
      description: string,
      cards: CardInput[],
      deletedCardIds: string[],
    ): Promise<StudySet | null> => {
      if (isMockMode) {
        return null;
      }

      setLoading(true);
      setError(null);
      try {
        const { data: setData, error: setErr } = await supabase
          .from('study_sets')
          .update({
            title,
            description: description || null,
            last_accessed: new Date().toISOString(),
          })
          .eq('id', setId)
          .select()
          .single();

        if (setErr) throw setErr;

        // Delete removed cards
        if (deletedCardIds.length > 0) {
          const { error: delErr } = await supabase
            .from('flashcards')
            .delete()
            .in('id', deletedCardIds);
          if (delErr) throw delErr;
        }

        // Upsert remaining cards
        const cardPayload = cards.map((c, i) => ({
          ...(c.id && !c.id.startsWith('new-') ? { id: c.id } : {}),
          set_id: setId,
          term: c.term,
          definition: c.definition,
          image_url: c.image_url ?? null,
          is_starred: false,
          position: i,
        }));

        const { data: upsertedCards, error: upsertErr } = await supabase
          .from('flashcards')
          .upsert(cardPayload, { onConflict: 'id' })
          .select();

        if (upsertErr) throw upsertErr;

        return { ...setData, flashcards: upsertedCards ?? [] } as StudySet;
      } catch (e: any) {
        setError(e.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deleteStudySet = useCallback(async (setId: string): Promise<boolean> => {
    if (isMockMode) return true;

    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('study_sets')
        .delete()
        .eq('id', setId);

      if (err) throw err;
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getStudySets,
    getStudySet,
    createStudySet,
    updateStudySet,
    deleteStudySet,
  };
}
