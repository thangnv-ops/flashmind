import { useEffect } from 'react';
import { supabase, isMockMode } from '../lib/supabase';

/**
 * Fires a single background update to `last_accessed` for the given set
 * when the component mounts. Safe to call in every study page.
 */
export function useUpdateLastAccessed(setId: string | undefined) {
  useEffect(() => {
    if (!setId || isMockMode) return;
    supabase
      .from('study_sets')
      .update({ last_accessed: new Date().toISOString() })
      .eq('id', setId)
      .then(() => { /* fire-and-forget */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);
}
