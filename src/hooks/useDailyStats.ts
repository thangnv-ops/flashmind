import { useState, useEffect, useMemo } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { todayVN, daysAgoVN } from '../utils/time';
import type { LearningTrendPoint } from '../types';

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

function generateMockTrend(days: number): LearningTrendPoint[] {
  const result: LearningTrendPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const seed = d.getDate() + d.getMonth() * 31;
    result.push({
      date: d.toISOString().split('T')[0],
      newlyLearned: ((seed * 7) % 9) + (i < 5 ? 3 : 0),
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
  const [learningTrend, setLearningTrend] = useState<LearningTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  // Distinct card counts (unique words) for the selected period
  const [uniqueLearnedCards, setUniqueLearnedCards] = useState(0);
  const [uniqueForgottenCards, setUniqueForgottenCards] = useState(0);
  const [uniqueReviewedCards, setUniqueReviewedCards] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    if (isMockMode) {
      const mockStats = generateMockStats(days);
      setStats(mockStats);
      setLearningTrend(generateMockTrend(days));
      setUniqueLearnedCards(mockStats.reduce((s, d) => s + d.learned, 0));
      setUniqueForgottenCards(mockStats.reduce((s, d) => s + d.forgotten, 0));
      setUniqueReviewedCards(Math.floor(mockStats.reduce((s, d) => s + d.learned, 0) * 1.5));
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setUniqueLearnedCards(0);
      setUniqueForgottenCards(0);
      setUniqueReviewedCards(0);
      // Compute date range in Vietnam timezone (UTC+7)
      const since = daysAgoVN(days - 1);

      let query = supabase
        .from('daily_log')
        .select('logged_at, event_type, card_id')
        .eq('user_id', user.id)
        .gte('logged_at', since);

      if (setId) query = query.eq('set_id', setId);

      const { data } = await query;

      // Build a map pre-filled with zeros for every day in range
      const statsMap = new Map<string, { learned: number; forgotten: number }>();
      for (let i = days - 1; i >= 0; i--) {
        statsMap.set(daysAgoVN(i), { learned: 0, forgotten: 0 });
      }

      // For per-day bars: count events per day (activity indicator)
      // For summary: count distinct card_ids (unique words) in the whole period
      const learnedCardIds = new Set<string>();
      const forgottenCardIds = new Set<string>();
      const reviewedCardIds = new Set<string>();

      // For learning trend: distinct cards per day
      const trendMap = new Map<string, { newlyLearned: Set<string>; forgotten: Set<string> }>();
      for (let i = days - 1; i >= 0; i--) {
        const date = daysAgoVN(i);
        trendMap.set(date, { newlyLearned: new Set<string>(), forgotten: new Set<string>() });
      }

      (data ?? []).forEach((row: any) => {
        const existing = statsMap.get(row.logged_at) ?? { learned: 0, forgotten: 0 };
        if (row.event_type === 'learned') {
          existing.learned++;
          learnedCardIds.add(row.card_id);
          trendMap.get(row.logged_at)?.newlyLearned.add(row.card_id);
        } else if (row.event_type === 'forgotten') {
          existing.forgotten++;
          forgottenCardIds.add(row.card_id);
          trendMap.get(row.logged_at)?.forgotten.add(row.card_id);
        } else if (row.event_type === 'reviewed') {
          reviewedCardIds.add(row.card_id);
        }
        statsMap.set(row.logged_at, existing);
      });

      setUniqueLearnedCards(learnedCardIds.size);
      setUniqueForgottenCards(forgottenCardIds.size);
      setUniqueReviewedCards(reviewedCardIds.size);

      const result: DayStat[] = [];
      statsMap.forEach((value, date) => result.push({ date, ...value }));
      result.sort((a, b) => a.date.localeCompare(b.date));

      // Build learning trend from per-day distinct card sets
      const trend: LearningTrendPoint[] = [];
      trendMap.forEach((value, date) => {
        trend.push({ date, newlyLearned: value.newlyLearned.size, forgotten: value.forgotten.size });
      });
      trend.sort((a, b) => a.date.localeCompare(b.date));

      setStats(result);
      setLearningTrend(trend);
      setLoading(false);
    };

    fetchData();
  }, [days, setId, user?.id]);

  const totalLearned = useMemo(() => stats.reduce((s, d) => s + d.learned, 0), [stats]);
  const totalForgotten = useMemo(() => stats.reduce((s, d) => s + d.forgotten, 0), [stats]);

  // Streak: consecutive days from today going backwards with ≥1 learned
  const streak = useMemo(() => {
    const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date));
    const today = todayVN();
    let count = 0;
    for (const s of sorted) {
      if (s.date > today) continue;
      if (s.learned > 0) count++;
      else break;
    }
    return count;
  }, [stats]);

  return { stats, learningTrend, totalLearned, totalForgotten, uniqueLearnedCards, uniqueForgottenCards, uniqueReviewedCards, streak, loading };
}
