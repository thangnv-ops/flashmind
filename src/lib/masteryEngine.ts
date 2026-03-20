import type { StudyMode } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressSnapshot {
  mastery_level: number;       // 1–10
  consecutive_correct: number;
  ease_factor: number;
  penalty_count?: number;
  is_leech?: boolean;
  leech_detected_at?: string | null;
}

export interface ProgressUpdate {
  mastery_level: number;
  consecutive_correct: number;
  ease_factor: number;
  last_reviewed_at: string;  // ISO timestamp
  next_review_at: string;    // ISO timestamp
  last_result: 'correct' | 'wrong';
  penalty_count: number;
  is_leech: boolean;
  leech_detected_at: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const DAY_MS    = 24 * 60 * MINUTE_MS;
const LEECH_THRESHOLD = 3;

/**
 * Bảng khoảng cách ôn tập theo mốc điểm (ms).
 * Tra trực tiếp—không nhánh if, dễ kiểm chứng với spec.
 */
export const REVIEW_INTERVALS_MS: Record<number, number> = {
  1:  10  * MINUTE_MS,   // 10 phút  — kiểm tra tức thời
  2:  30  * MINUTE_MS,   // 30 phút  — kiểm tra tức thời
  3:  1   * DAY_MS,      // 24 giờ   — sau một giấc ngủ
  4:  1   * DAY_MS,      // 24 giờ   — sau một giấc ngủ
  5:  3   * DAY_MS,      // 3 ngày   — trí nhớ trung hạn
  6:  7   * DAY_MS,      // 7 ngày   — bắt đầu dài hạn
  7:  14  * DAY_MS,      // 14 ngày  — duy trì ổn định
  8:  30  * DAY_MS,      // 30 ngày  — kiểm tra độ bền
  9:  90  * DAY_MS,      // 90 ngày  — khóa vào bộ nhớ vĩnh viễn
  10: 180 * DAY_MS,      // 180 ngày — kiểm tra định kỳ
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Trả về khoảng cách ôn tập (ms) cho một level.
 */
export function getReviewIntervalMs(level: number): number {
  const clamped = Math.max(1, Math.min(10, level));
  return REVIEW_INTERVALS_MS[clamped];
}

/**
 * Tính điểm sau khi phạt (Milestone-based Penalty).
 * Đưa về đầu phân đoạn trước — không chỉ trừ 1.
 *
 * | Level hiện tại | Level sau phạt | Ý nghĩa                              |
 * |----------------|----------------|--------------------------------------|
 * |      1–2       |       1        | Reset hoàn toàn, học lại ngay         |
 * |      3–4       |       2        | Về mức "Lờ mờ" — ôn lại sau 30 phút |
 * |      5–6       |       4        | Rớt khỏi nhóm Ổn định                |
 * |      7–8       |       5        | Về Ngắn hạn cao nhất                 |
 * |      9–10      |       7        | Rớt xuống Vững chắc                  |
 */
export function calculatePenalty(currentLevel: number): number {
  if (currentLevel <= 2) return 1;
  if (currentLevel <= 4) return 2;
  if (currentLevel <= 6) return 4;
  if (currentLevel <= 8) return 5;
  return 7; // level 9–10
}

/**
 * Khoảng cách nhắc lại khi bị phạt, tính theo level SAU KHI PHẠT.
 *
 * | Level sau phạt | Nhắc lại sau |
 * |----------------|--------------|
 * |       1        |   10 phút    |
 * |      2–5       |   12 giờ     |
 * |      6–7       |   1 ngày     |
 */
export function getPenaltyIntervalMs(penaltyLevel: number): number {
  if (penaltyLevel === 1) return 10 * MINUTE_MS;
  if (penaltyLevel <= 5)  return 12 * 60 * MINUTE_MS;
  return 24 * 60 * MINUTE_MS; // level 6–7
}

/**
 * Trả về true nếu thẻ đủ điều kiện là Leech Card (bị phạt >= 3 lần).
 */
export function isLeechCard(penaltyCount: number): boolean {
  return penaltyCount >= LEECH_THRESHOLD;
}

export type MasteryBadge = 'Newbie' | 'Learning' | 'Mastered' | 'Legendary';

/**
 * Xác định badge dựa trên mastery_level.
 */
export function getMasteryBadge(level: number): MasteryBadge {
  if (level <= 3) return 'Newbie';
  if (level <= 6) return 'Learning';
  if (level <= 9) return 'Mastered';
  return 'Legendary';
}

// ---------------------------------------------------------------------------
// Main compute function (pure — no DB calls)
// ---------------------------------------------------------------------------

/**
 * Tính toán trạng thái mới cho một thẻ sau một lần trả lời.
 * Pure function — không gọi DB, dễ unit test.
 */
export function computeProgressUpdate(
  current: ProgressSnapshot,
  isCorrect: boolean,
  mode: StudyMode,
  now: Date = new Date(),
): ProgressUpdate {
  let { mastery_level, consecutive_correct, ease_factor } = current;
  const penalty_count = current.penalty_count ?? 0;
  const existingLeech = current.is_leech ?? false;
  const existingLeechAt = current.leech_detected_at ?? null;

  if (isCorrect) {
    // --- TRƯỜNG HỢP ĐÚNG ---
    const increment = mode === 'write' ? 2 : 1;
    mastery_level = Math.min(10, mastery_level + increment);
    consecutive_correct += 1;
    ease_factor = Math.min(3.0, ease_factor + 0.1);

    const next = new Date(now.getTime() + getReviewIntervalMs(mastery_level));

    return {
      mastery_level,
      consecutive_correct,
      ease_factor,
      last_reviewed_at: now.toISOString(),
      next_review_at: next.toISOString(),
      last_result: 'correct',
      // Đúng: reset penalty_count. Giữ is_leech để user xử lý thủ công qua Deep Study.
      penalty_count: 0,
      is_leech: existingLeech,
      leech_detected_at: existingLeechAt,
    };
  } else {
    // --- TRƯỜNG HỢP SAI — Milestone-based Penalty ---
    mastery_level = calculatePenalty(mastery_level);
    consecutive_correct = 0;
    ease_factor = Math.max(1.3, ease_factor - 0.2);

    const newPenaltyCount = penalty_count + 1;
    const becameLeech = isLeechCard(newPenaltyCount) && !existingLeech;
    const newIsLeech = isLeechCard(newPenaltyCount);
    const newLeechAt = becameLeech ? now.toISOString() : existingLeechAt;

    const next = new Date(now.getTime() + getPenaltyIntervalMs(mastery_level));

    return {
      mastery_level,
      consecutive_correct,
      ease_factor,
      last_reviewed_at: now.toISOString(),
      next_review_at: next.toISOString(),
      last_result: 'wrong',
      penalty_count: newPenaltyCount,
      is_leech: newIsLeech,
      leech_detected_at: newLeechAt,
    };
  }
}
