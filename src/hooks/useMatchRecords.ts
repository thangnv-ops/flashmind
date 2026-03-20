import { useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useMatchRecords() {
  const { user } = useAuth();

  const getPersonalBest = useCallback(
    async (setId: string): Promise<number | null> => {
      if (isMockMode || !user) return null;
      const { data } = await supabase
        .from('match_records')
        .select('best_time_ms')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .maybeSingle();
      return data?.best_time_ms ?? null;
    },
    [user],
  );

  /**
   * Returns true if `timeMs` is a new personal best (and was saved).
   * Returns false if there was already a better or equal time.
   */
  const updatePersonalBest = useCallback(
    async (setId: string, timeMs: number): Promise<boolean> => {
      if (isMockMode || !user) return false;
      const current = await getPersonalBest(setId);
      if (current !== null && timeMs >= current) return false;

      await supabase.from('match_records').upsert(
        {
          user_id: user.id,
          set_id: setId,
          best_time_ms: timeMs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,set_id' },
      );
      return true;
    },
    [user, getPersonalBest],
  );

  return { getPersonalBest, updatePersonalBest };
}
