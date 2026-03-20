import { describe, it, expect } from 'vitest';
import {
  computeProgressUpdate,
  calculatePenalty,
  getPenaltyIntervalMs,
  getReviewIntervalMs,
  getMasteryBadge,
  isLeechCard,
  REVIEW_INTERVALS_MS,
  type ProgressSnapshot,
} from '../lib/masteryEngine';

const base: ProgressSnapshot = {
  mastery_level: 5,
  consecutive_correct: 2,
  ease_factor: 2.5,
  penalty_count: 0,
  is_leech: false,
  leech_detected_at: null,
};

// ---------------------------------------------------------------------------
// computeProgressUpdate — correct answers
// ---------------------------------------------------------------------------
describe('computeProgressUpdate — đúng', () => {
  it('flashcard correct: tăng 1 điểm', () => {
    const result = computeProgressUpdate(base, true, 'flashcard');
    expect(result.mastery_level).toBe(6);
    expect(result.last_result).toBe('correct');
    expect(result.consecutive_correct).toBe(3);
  });

  it('write correct: tăng 2 điểm', () => {
    const result = computeProgressUpdate(base, true, 'write');
    expect(result.mastery_level).toBe(7);
  });

  it('capped tại 10', () => {
    const high = { ...base, mastery_level: 10 };
    const result = computeProgressUpdate(high, true, 'write');
    expect(result.mastery_level).toBe(10);
  });

  it('đúng reset penalty_count về 0', () => {
    const withPenalty = { ...base, penalty_count: 2 };
    const result = computeProgressUpdate(withPenalty, true, 'flashcard');
    expect(result.penalty_count).toBe(0);
  });

  it('level 1 đúng: level tăng lên 2 → next_review_at là 30 phút sau', () => {
    const l1 = { ...base, mastery_level: 1 };
    const now = new Date('2026-03-20T00:00:00Z');
    const result = computeProgressUpdate(l1, true, 'flashcard', now);
    expect(result.mastery_level).toBe(2);
    const diffMin = (new Date(result.next_review_at).getTime() - now.getTime()) / 60000;
    expect(diffMin).toBe(30);
  });

  it('level 2 đúng: level tăng lên 3 → next_review_at là 24 giờ sau', () => {
    const l2 = { ...base, mastery_level: 2 };
    const now = new Date('2026-03-20T00:00:00Z');
    const result = computeProgressUpdate(l2, true, 'flashcard', now);
    expect(result.mastery_level).toBe(3);
    const diffHours = (new Date(result.next_review_at).getTime() - now.getTime()) / 3600000;
    expect(diffHours).toBe(24);
  });

  it('level 8 đúng: level tăng lên 9 → next_review_at là 90 ngày sau', () => {
    const l8 = { ...base, mastery_level: 8 };
    const now = new Date('2026-03-20T00:00:00Z');
    const result = computeProgressUpdate(l8, true, 'flashcard', now);
    expect(result.mastery_level).toBe(9);
    const diffDays = (new Date(result.next_review_at).getTime() - now.getTime()) / 86400000;
    expect(diffDays).toBe(90);
  });

  it('level 9 đúng: level tăng lên 10 → next_review_at là 180 ngày sau', () => {
    const l9 = { ...base, mastery_level: 9 };
    const now = new Date('2026-03-20T00:00:00Z');
    const result = computeProgressUpdate(l9, true, 'flashcard', now);
    expect(result.mastery_level).toBe(10);
    const diffDays = (new Date(result.next_review_at).getTime() - now.getTime()) / 86400000;
    expect(diffDays).toBe(180);
  });
});

// ---------------------------------------------------------------------------
// computeProgressUpdate — wrong answers (penalty)
// ---------------------------------------------------------------------------
describe('computeProgressUpdate — sai (penalty)', () => {
  it('sai level 2: penalty về 1 — reset hoàn toàn', () => {
    const l2 = { ...base, mastery_level: 2 };
    const result = computeProgressUpdate(l2, false, 'flashcard');
    expect(result.mastery_level).toBe(1);
    expect(result.consecutive_correct).toBe(0);
    expect(result.last_result).toBe('wrong');
  });

  it('sai level 5: penalty về 4 (rớt khỏi Ổn định)', () => {
    const l5 = { ...base, mastery_level: 5 };
    const result = computeProgressUpdate(l5, false, 'flashcard');
    expect(result.mastery_level).toBe(4);
  });

  it('sai level 8: penalty về 5 (về Ngắn hạn cao nhất)', () => {
    const l8snap = { ...base, mastery_level: 8 };
    const result = computeProgressUpdate(l8snap, false, 'flashcard');
    expect(result.mastery_level).toBe(5);
  });

  it('sai level 10: penalty về 7 (Legendary → Mastered)', () => {
    const l10 = { ...base, mastery_level: 10 };
    const result = computeProgressUpdate(l10, false, 'flashcard');
    expect(result.mastery_level).toBe(7);
  });

  it('sai level 1: next_review_at là 10 phút (penalty=1)', () => {
    const now = new Date('2026-03-20T10:00:00Z');
    const l1 = { ...base, mastery_level: 1 };
    const result = computeProgressUpdate(l1, false, 'flashcard', now);
    const diffMin = (new Date(result.next_review_at).getTime() - now.getTime()) / 60000;
    expect(diffMin).toBe(10);
  });

  it('sai level 5: next_review_at là 12 giờ (penalty=4, ≤5)', () => {
    const now = new Date('2026-03-20T10:00:00Z');
    const l5 = { ...base, mastery_level: 5 };
    const result = computeProgressUpdate(l5, false, 'flashcard', now);
    const diffHours = (new Date(result.next_review_at).getTime() - now.getTime()) / 3600000;
    expect(diffHours).toBe(12);
  });

  it('sai level 9: next_review_at là 1 ngày (penalty=7, range 6–7)', () => {
    const now = new Date('2026-03-20T10:00:00Z');
    const l9 = { ...base, mastery_level: 9 };
    const result = computeProgressUpdate(l9, false, 'flashcard', now);
    const diffHours = (new Date(result.next_review_at).getTime() - now.getTime()) / 3600000;
    expect(diffHours).toBe(24);
  });

  it('penalty_count tăng dần khi sai liên tiếp', () => {
    const r1 = computeProgressUpdate(base, false, 'flashcard');
    expect(r1.penalty_count).toBe(1);
    const snap2: ProgressSnapshot = { ...base, penalty_count: 1, mastery_level: r1.mastery_level };
    const r2 = computeProgressUpdate(snap2, false, 'flashcard');
    expect(r2.penalty_count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Leech Card detection
// ---------------------------------------------------------------------------
describe('Leech Card detection', () => {
  it('chưa leech khi penalty_count sau call vẫn < 3', () => {
    // penalty_count: 1 → sau khi sai thêm = 2 → chưa đủ ngưỡng 3
    const snap: ProgressSnapshot = { ...base, penalty_count: 1 };
    const result = computeProgressUpdate(snap, false, 'flashcard');
    expect(result.penalty_count).toBe(2);
    expect(result.is_leech).toBe(false);
    expect(result.leech_detected_at).toBeNull();
  });

  it('trở thành leech khi penalty_count đạt 3', () => {
    const now = new Date('2026-03-20T10:00:00Z');
    const snap: ProgressSnapshot = { ...base, penalty_count: 2 };
    const result = computeProgressUpdate(snap, false, 'flashcard', now);
    expect(result.penalty_count).toBe(3);
    expect(result.is_leech).toBe(true);
    expect(result.leech_detected_at).toBe(now.toISOString());
  });

  it('is_leech giữ nguyên khi trả lời đúng (user xử lý thủ công)', () => {
    const snap: ProgressSnapshot = { ...base, is_leech: true, leech_detected_at: '2026-03-01T00:00:00Z' };
    const result = computeProgressUpdate(snap, true, 'flashcard');
    expect(result.is_leech).toBe(true);
    expect(result.leech_detected_at).toBe('2026-03-01T00:00:00Z');
  });
});

// ---------------------------------------------------------------------------
// calculatePenalty
// ---------------------------------------------------------------------------
describe('calculatePenalty', () => {
  it.each([
    [1, 1], [2, 1],
    [3, 2], [4, 2],
    [5, 4], [6, 4],
    [7, 5], [8, 5],
    [9, 7], [10, 7],
  ])('level %i → penalty %i', (level, expected) => {
    expect(calculatePenalty(level)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getPenaltyIntervalMs
// ---------------------------------------------------------------------------
describe('getPenaltyIntervalMs', () => {
  it('level 1 → 10 phút', () => {
    expect(getPenaltyIntervalMs(1)).toBe(10 * 60 * 1000);
  });
  it('level 2–5 → 12 giờ', () => {
    expect(getPenaltyIntervalMs(2)).toBe(12 * 60 * 60 * 1000);
    expect(getPenaltyIntervalMs(5)).toBe(12 * 60 * 60 * 1000);
  });
  it('level 6–7 → 1 ngày', () => {
    expect(getPenaltyIntervalMs(6)).toBe(24 * 60 * 60 * 1000);
    expect(getPenaltyIntervalMs(7)).toBe(24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// REVIEW_INTERVALS_MS — full table
// ---------------------------------------------------------------------------
describe('REVIEW_INTERVALS_MS', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const MIN = 60 * 1000;

  it('kiểm tra toàn bộ bảng', () => {
    expect(REVIEW_INTERVALS_MS[1]).toBe(10 * MIN);
    expect(REVIEW_INTERVALS_MS[2]).toBe(30 * MIN);
    expect(REVIEW_INTERVALS_MS[3]).toBe(1  * DAY);
    expect(REVIEW_INTERVALS_MS[4]).toBe(1  * DAY);
    expect(REVIEW_INTERVALS_MS[5]).toBe(3  * DAY);
    expect(REVIEW_INTERVALS_MS[6]).toBe(7  * DAY);
    expect(REVIEW_INTERVALS_MS[7]).toBe(14 * DAY);
    expect(REVIEW_INTERVALS_MS[8]).toBe(30 * DAY);
    expect(REVIEW_INTERVALS_MS[9]).toBe(90 * DAY);
    expect(REVIEW_INTERVALS_MS[10]).toBe(180 * DAY);
  });
});

// ---------------------------------------------------------------------------
// getReviewIntervalMs
// ---------------------------------------------------------------------------
describe('getReviewIntervalMs', () => {
  it('clamps level < 1 về 1', () => {
    expect(getReviewIntervalMs(0)).toBe(REVIEW_INTERVALS_MS[1]);
  });
  it('clamps level > 10 về 10', () => {
    expect(getReviewIntervalMs(11)).toBe(REVIEW_INTERVALS_MS[10]);
  });
});

// ---------------------------------------------------------------------------
// getMasteryBadge
// ---------------------------------------------------------------------------
describe('getMasteryBadge', () => {
  it.each([
    [1, 'Newbie'], [2, 'Newbie'], [3, 'Newbie'],
    [4, 'Learning'], [5, 'Learning'], [6, 'Learning'],
    [7, 'Mastered'], [8, 'Mastered'], [9, 'Mastered'],
    [10, 'Legendary'],
  ])('level %i → %s', (level, badge) => {
    expect(getMasteryBadge(level)).toBe(badge);
  });
});

// ---------------------------------------------------------------------------
// isLeechCard
// ---------------------------------------------------------------------------
describe('isLeechCard', () => {
  it('false khi count < 3', () => {
    expect(isLeechCard(0)).toBe(false);
    expect(isLeechCard(2)).toBe(false);
  });
  it('true khi count >= 3', () => {
    expect(isLeechCard(3)).toBe(true);
    expect(isLeechCard(10)).toBe(true);
  });
});
