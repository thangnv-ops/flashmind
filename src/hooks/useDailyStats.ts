import { useState, useEffect, useMemo } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface DayStat {
  date: string;     // "YYYY-MM-DD"
  learned: number;  // event_type = 'learned'
  forgotten: number;// event_type = 'forgotten'
}

function generateMockStats(days: number): DayStat[] {
  const result: DayStat[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const seed = d.getDate() + d.getMonth() * 31;
    result.push({
      date: d.toISOString().split('T')[0],
      learned: ((seed * 7) % 9) + (i < 5 ? 3 : 0),
      forgotten: (seed * 3) % 4,
    });
  }
  return result;
}

/**
 * Aggregates daily_log events for the past N days.
 * Optionally scoped to a specific set (setId).
 */
export function useDailyStats(days: 7 | 14 | 30, setId?: string) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    if (isMockMode) {
      setStats(generateMockStats(days));
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // Compute date range
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - (days - 1));
      const since = sinceDate.toISOString().split('T')[0];

      let query = supabase
        .from('daily_log')
        .select('logged_at, event_type')
        .eq('user_id', user.id)
        .gte('logged_at', since);

      if (setId) query = query.eq('set_id', setId);

      const { data } = await query;

      // Build a map pre-filled with zeros for every day in range
      const statsMap = new Map<string, { learned: number; forgotten: number }>();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        statsMap.set(d.toISOString().split('T')[0], { learned: 0, forgotten: 0 });
      }

      (data ?? []).forEach((row: any) => {
        const existing = statsMap.get(row.logged_at) ?? { learned: 0, forgotten: 0 };
        if (row.event_type === 'learned') existing.learned++;
        else existing.forgotten++;
        statsMap.set(row.logged_at, existing);
      });

      const result: DayStat[] = [];
      statsMap.forEach((value, date) => result.push({ date, ...value }));
      result.sort((a, b) => a.date.localeCompare(b.date));

      setStats(result);
      setLoading(false);
    };

    fetchData();
  }, [days, setId, user?.id]);

  const totalLearned = useMemo(() => stats.reduce((s, d) => s + d.learned, 0), [stats]);
  const totalForgotten = useMemo(() => stats.reduce((s, d) => s + d.forgotten, 0), [stats]);

  // Streak: consecutive days from today going backwards with ≥1 learned
  const streak = useMemo(() => {
    const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date));
    const today = new Date().toISOString().split('T')[0];
    let count = 0;
    for (const s of sorted) {
      if (s.date > today) continue;
      if (s.learned > 0) count++;
      else break;
    }
    return count;
  }, [stats]);

  return { stats, totalLearned, totalForgotten, streak, loading };
}
