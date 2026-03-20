# Giai đoạn 7: Hệ thống Đánh điểm Thành thạo & Thuật toán Nhắc lại Ngắt quãng

## Tổng quan

Xây dựng hệ thống học thông minh dựa trên hai cơ chế cốt lõi:
- **Mastery Level (1–10):** Điểm thành thạo từng thẻ, tăng/giảm theo kết quả trả lời và chế độ học.
- **Spaced Repetition:** Tự động lên lịch ôn tập (`next_review_at`) — điểm cao → ôn xa hơn, điểm thấp → ôn sớm hơn.

**Phụ thuộc:** Phase 1–6 hoàn chỉnh. Bảng `progress` đã tồn tại với `mastery_level (0–5)`, `last_result`, `session_id`. Cần migration để mở rộng schema và thêm các trường Spaced Repetition.

### Kết quả kỳ vọng

- Mỗi thẻ flashcard có điểm thành thạo riêng (1–10), phản ánh chính xác mức độ ghi nhớ của người dùng.
- Hệ thống tự động lên lịch ôn tập — người dùng không cần nhớ phải học lại bài nào, ứng dụng sẽ nhắc đúng lúc.
- Chế độ Write được ghi nhận công sức hơn (tăng 2 điểm) so với Flashcard/MCQ (tăng 1 điểm).
- Thẻ trả lời sai bị phạt theo **mốc milestone**: điểm cao bị kéo về đầu phân đoạn trước (không chỉ trừ 1), khoảng cách ôn lại từ 10 phút đến 1 ngày tuỳ mức độ.
- **Leech Card:** Thẻ bị phạt ≥ 3 lần tự động được đánh dấu "⚠️ Thẻ khó" — tách vào danh sách Deep Study và nhắc người dùng thay đổi cách ghi nhớ.
- Dashboard hiển thị pie chart phân bổ 4 cấp độ (Newbie / Learning / Mastered / Legendary), giúp người dùng thấy rõ tiến trình tổng thể.
- Review Queue trên `SetOverview` cho biết hôm nay có bao nhiêu thẻ đến hạn, ưu tiên thẻ yếu nhất lên đầu.
- `masteryEngine.ts` là pure function — toàn bộ logic có thể unit test mà không cần kết nối DB.
- Các component UI (MasteryBadge, MasteryDots) trực quan hóa tiến trình thành thạo, tạo động lực cho người dùng.
- Mỗi từ bắt buộc phải học qua learn và write để đạt điểm cao — đảm bảo người dùng không chỉ nhận biết mà còn có thể nhớ và viết được.
---

## Thiết kế dữ liệu

### 1.1 Migration bảng `progress` (mở rộng từ Phase 6)

```sql
-- ============================================================
-- Phase 7 Migration — Mastery & Spaced Repetition
-- ============================================================
Nhớ update file migrate.ts để chạy script này khi deploy!
-- Bước 1: Scale mastery_level từ thang 0–5 lên 1–10
-- (nhân đôi, tối thiểu 1, tối đa 10)
UPDATE progress
SET mastery_level = LEAST(10, GREATEST(1, mastery_level * 2))
WHERE mastery_level IS NOT NULL;

-- Đảm bảo row chưa học đặt về 1 (không còn giá trị 0)
UPDATE progress SET mastery_level = 1 WHERE mastery_level = 0 OR mastery_level IS NULL;

-- Bước 2: Thêm các cột Spaced Repetition
ALTER TABLE progress
  ADD COLUMN IF NOT EXISTS consecutive_correct  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_review_at       TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ease_factor          FLOAT       NOT NULL DEFAULT 2.5;

-- Bước 3: Index để query Review Queue nhanh
CREATE INDEX IF NOT EXISTS progress_review_queue
  ON progress(user_id, next_review_at, mastery_level);
```

### 1.2 Ý nghĩa các trường mới

| Trường | Kiểu | Mặc định | Mô tả |
|--------|------|----------|-------|
| `mastery_level` | `INT` | `1` | Điểm thành thạo từ **1 đến 10** |
| `consecutive_correct` | `INT` | `0` | Số lần đúng liên tiếp — reset về 0 khi trả lời sai |
| `last_reviewed_at` | `TIMESTAMPTZ` | `NULL` | Lần cuối người dùng tương tác với thẻ này |
| `next_review_at` | `TIMESTAMPTZ` | `NOW()` | Thời điểm hệ thống đẩy thẻ ra ôn lại |
| `ease_factor` | `FLOAT` | `2.5` | Hệ số độ khó SM-2 — điều chỉnh khoảng cách ôn tập linh hoạt |

### 1.3 Thang điểm Mastery và Badge tương ứng

| mastery_level | Badge | Nhãn | Màu |
|---|---|---|---|
| 1–3 | 🐣 **Newbie** | Đang làm quen | `#94a3b8` (xám xanh) |
| 4–6 | 📖 **Learning** | Đang ghi nhớ | `#f59e0b` (cam vàng) |
| 7–9 | ⚡ **Mastered** | Thành thạo | `#22c55e` (xanh lá) |
| 10 | 🏆 **Legendary** | Ký ức vĩnh cửu | `#a855f7` (tím) |

### 1.4 Bảng Mốc Điểm Ôn Tập (Spaced Repetition Schedule)

| Mốc điểm | Khoảng cách nhắc lại |ằng | Mục tiêu |
|---|---|---|---|
| **1** | 10 phút | `10 * 60 * 1000` ms | Kiểm tra trí nhớ tức thời |
| **2** | 30 phút | `30 * 60 * 1000` ms | Kiểm tra trí nhớ tức thời |
| **3** | 24 giờ | `1 * DAY_MS` | Vượt qua ngưỡng quên sau một giấc ngủ |
| **4** | 24 giờ | `1 * DAY_MS` | Vượt qua ngưỡng quên sau một giấc ngủ |
| **5** | 3 ngày | `3 * DAY_MS` | Củng cố trí nhớ trung hạn |
| **6** | 7 ngày | `7 * DAY_MS` | Bắt đầu chuyển vào trí nhớ dài hạn |
| **7** | 14 ngày | `14 * DAY_MS` | Duy trì sự ổn định |
| **8** | 30 ngày | `30 * DAY_MS` | Kiểm tra độ bền ký ức |
| **9** | 90 ngày | `90 * DAY_MS` | Khóa kiến thức vào bộ nhớ vĩnh viễn |
| **10** | 180 ngày | `180 * DAY_MS` | Kiểm tra định kỳ |

> **Lưu ý:** Khi trả lời **sai**, `next_review_at` được tính theo level **sau khi áp phạt** (không phải level gốc) — từ 10 phút đến 1 ngày tuỳ mức. Chi tiết tại hàm `calculatePenalty` / `getPenaltyIntervalMs` ở mục 2.1.

### 1.5 Leech Card — Schema bổ sung

Khi một thẻ bị phạt quá nhiều lần, hệ thống tự động đánh dấu "⚠️ Thẻ khó" để người dùng tập trung ôn kỹ riêng.

```sql
ALTER TABLE progress
  ADD COLUMN IF NOT EXISTS penalty_count       INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_leech            BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS leech_detected_at   TIMESTAMPTZ DEFAULT NULL;

-- Partial index để query thẻ khó nhanh
CREATE INDEX IF NOT EXISTS progress_leech
  ON progress(user_id, is_leech)
  WHERE is_leech = TRUE;
```

| Trường | Mô tả |
|--------|-------|
| `penalty_count` | Số lần bị phạt tích lũy — reset về 0 khi trả lời đúng liên tiếp |
| `is_leech` | `true` khi thẻ bị phạt ≥ 3 lần — đánh dấu "Thẻ khó" |
| `leech_detected_at` | Thời điểm phát hiện leech lần đầu |

---

## Logic Thuật toán (Business Logic)

### 2.1 Hàm `updateProgress`

**File:** `src/lib/masteryEngine.ts`

```ts
type StudyMode = 'flashcard' | 'learn' | 'write' | 'test' | 'match';

interface ProgressSnapshot {
  mastery_level: number;        // 1–10
  consecutive_correct: number;
  ease_factor: number;
}

interface ProgressUpdate {
  mastery_level: number;
  consecutive_correct: number;
  ease_factor: number;
  last_reviewed_at: string;   // ISO timestamp
  next_review_at: string;     // ISO timestamp
  last_result: 'correct' | 'wrong';
}

/**
 * Tính toán trạng thái mới cho một thẻ sau một lần trả lời.
 * Hàm này là pure function — không gọi DB trực tiếp, dễ unit test.
 */
export function computeProgressUpdate(
  current: ProgressSnapshot,
  isCorrect: boolean,
  mode: StudyMode,
  now: Date = new Date()
): ProgressUpdate {
  let { mastery_level, consecutive_correct, ease_factor } = current;

  if (isCorrect) {
    // --- TRƯỜNG HỢP ĐÚNG ---
    const increment = mode === 'write' ? 2 : 1;
    mastery_level = Math.min(10, mastery_level + increment);
    consecutive_correct += 1;

    // Điều chỉnh ease_factor theo SM-2 (tăng nhẹ khi đúng liên tiếp)
    ease_factor = Math.min(3.0, ease_factor + 0.1);

    const intervalMs = getReviewIntervalMs(mastery_level);
    const next = new Date(now.getTime() + intervalMs);

    return {
      mastery_level,
      consecutive_correct,
      ease_factor,
      last_reviewed_at: now.toISOString(),
      next_review_at: next.toISOString(),
      last_result: 'correct',
    };
  } else {
    // --- TRƯỜNG HỢP SAI — Milestone-based Penalty ---
    mastery_level = calculatePenalty(mastery_level);   // đưa về đầu phân đoạn trước
    consecutive_correct = 0;

    // Giảm ease_factor khi trả lời sai (không thấp hơn 1.3 — ngưỡng SM-2)
    ease_factor = Math.max(1.3, ease_factor - 0.2);

    // Khoảng cách nhắc lại tính theo level SAU KHI PHẠT (tiered, không phẳng)
    const next = new Date(now.getTime() + getPenaltyIntervalMs(mastery_level));

    return {
      mastery_level,
      consecutive_correct,
      ease_factor,
      last_reviewed_at: now.toISOString(),
      next_review_at: next.toISOString(),
      last_result: 'wrong',
    };
  }
}

const MINUTE_MS = 60 * 1000;
const DAY_MS    = 24 * 60 * MINUTE_MS;

/**
 * Bảng khoảng cách ôn tập theo mốc điểm (milliseconds).
 * Tra trực tiếp — không có nhánh if, dễ kiểm chứng với spec.
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

/**
 * Trả về khoảng cách ôn tập (ms) cho một level.
 */
export function getReviewIntervalMs(level: number): number {
  const clamped = Math.max(1, Math.min(10, level));
  return REVIEW_INTERVALS_MS[clamped];
}

/**
 * Tính điểm sau khi phạt (Milestone-based Penalty).
 * Đưa người dùng về đầu phân đoạn trước — không chỉ trừ 1.
 *
 * | Điểm hiện tại | Điểm sau phạt | Ý nghĩa                               |
 * |---------------|---------------|---------------------------------------|
 * |      1 – 2    |       1       | Reset hoàn toàn, học lại ngay          |
 * |      3 – 4    |       2       | Về mức "Lờ mờ" — ôn lại sau 30 phút  |
 * |      5 – 6    |       4       | Rớt khỏi nhóm Ổn định                 |
 * |      7 – 8    |       5       | Về Ngắn hạn cao nhất                  |
 * |      9 – 10   |       7       | Rớt xuống Vững chắc                   |
 */
export function calculatePenalty(currentLevel: number): number {
  if (currentLevel <= 2) return 1;
  if (currentLevel <= 4) return 2;
  if (currentLevel <= 6) return 4;
  if (currentLevel <= 8) return 5;
  return 7;   // level 9–10
}

/**
 * Khoảng cách nhắc lại khi bị phạt, tính theo level SAU KHI PHẠT.
 * Ngắn hơn nhiều so với REVIEW_INTERVALS_MS — cần gặp lại thẻ sớm.
 *
 * | Level sau phạt | Nhắc lại sau |
 * |----------------|---------------|
 * |       1        | 10 phút       |
 * |      2 – 5     | 12 giờ        |
 * |      6 – 7     | 1 ngày        |
 */
export function getPenaltyIntervalMs(penaltyLevel: number): number {
  if (penaltyLevel === 1) return 10 * 60 * 1000;        // 10 phút — ôn lại ngay
  if (penaltyLevel <= 5)  return 12 * 60 * 60 * 1000;   // 12 giờ  — buổi học tiếp
  return 24 * 60 * 60 * 1000;                            // 1 ngày  — level 6–7
}

const LEECH_THRESHOLD = 3;

/**
 * Trả về true nếu thẻ nên được đánh dấu là Leech Card.
 * Điều kiện: bị phạt tích lũy >= 3 lần.
 */
export function isLeechCard(penaltyCount: number): boolean {
  return penaltyCount >= LEECH_THRESHOLD;
}

/**
 * Xác định badge dựa trên mastery_level.
 */
export type MasteryBadge = 'Newbie' | 'Learning' | 'Mastered' | 'Legendary';

export function getMasteryBadge(level: number): MasteryBadge {
  if (level <= 3) return 'Newbie';
  if (level <= 6) return 'Learning';
  if (level <= 9) return 'Mastered';
  return 'Legendary';
}
```

### 2.2 Hook `useProgressUpdater`

**File:** `src/hooks/useProgressUpdater.ts`

Hook này wrap `computeProgressUpdate` và thực hiện upsert vào Supabase. Dùng chung cho tất cả các chế độ học.

```ts
interface UseProgressUpdaterReturn {
  submitAnswer: (cardId: string, isCorrect: boolean, mode: StudyMode) => Promise<void>;
  isUpdating: boolean;
}

function useProgressUpdater(setId: string): UseProgressUpdaterReturn {
  // 1. Lấy snapshot hiện tại của card từ bảng progress (hoặc dùng default nếu chưa có row)
  // 2. Gọi computeProgressUpdate(snapshot, isCorrect, mode)
  // 3. Upsert vào bảng progress (conflict on user_id + card_id)
  // 4. Nếu isCorrect && snapshot.mastery_level === 0 → INSERT 'learned' vào daily_log
  //    Nếu !isCorrect && snapshot.mastery_level >= 7 → INSERT 'forgotten' vào daily_log
}
```

**Upsert query mẫu:**

```ts
await supabase.from('progress').upsert(
  {
    user_id:              userId,
    card_id:              cardId,
    set_id:               setId,
    mastery_level:        update.mastery_level,
    consecutive_correct:  update.consecutive_correct,
    ease_factor:          update.ease_factor,
    last_reviewed_at:     update.last_reviewed_at,
    next_review_at:       update.next_review_at,
    last_result:          update.last_result,
    updated_at:           update.last_reviewed_at,
  },
  { onConflict: 'user_id,card_id' }
);
```

### Xử lý Leech Card trong `useProgressUpdater`

Sau mỗi lần trả lời **sai**, kiểm tra thêm điều kiện leech và merge vào cùng payload upsert:

```ts
// Tăng penalty_count và kiểm tra leech
const newPenaltyCount = (snapshot.penalty_count ?? 0) + 1;
const becameLeech = isLeechCard(newPenaltyCount) && !snapshot.is_leech;

// Merge vào payload upsert
{
  ...update,
  penalty_count:      newPenaltyCount,
  is_leech:           isLeechCard(newPenaltyCount),
  leech_detected_at:  becameLeech ? now.toISOString() : snapshot.leech_detected_at,
}

// Khi trả lời đúng: reset penalty_count về 0
// (giữ nguyên is_leech — user phải xử lý thủ công qua Deep Study)
```

**Hành động khi `becameLeech = true`:**
1. Gắn badge **"⚠️ Thẻ khó"** trên card trong tất cả chế độ học.
2. Thêm thẻ vào tab **"Deep Study"** trong `SetOverview` — danh sách `is_leech = true`.
3. Hiện Toast: *"Từ này khó nhớ quá! Thử đổi ví dụ hoặc hình ảnh liên tưởng nhé."*

---

## Review Queue — Danh sách thẻ cần ôn hôm nay

### 3.1 Hook `useReviewQueue`

**File:** `src/hooks/useReviewQueue.ts`

```ts
interface ReviewCard {
  card_id: string;
  term: string;
  definition: string;
  mastery_level: number;
  next_review_at: string;
  ease_factor: number;
}

interface UseReviewQueueReturn {
  dueCards: ReviewCard[];     // Thẻ đến hạn (next_review_at <= NOW())
  totalDue: number;
  loading: boolean;
  refetch: () => void;
}

function useReviewQueue(setId?: string): UseReviewQueueReturn {
  // Query: lấy cards đến hạn, ưu tiên mastery_level thấp nhất trước
  // setId là optional — nếu không truyền, lấy tất cả sets của user
}
```

**Query SQL tương đương:**

```sql
SELECT
  p.card_id,
  f.term,
  f.definition,
  p.mastery_level,
  p.next_review_at,
  p.ease_factor
FROM progress p
JOIN flashcards f ON f.id = p.card_id
WHERE p.user_id   = auth.uid()
  AND p.next_review_at <= NOW()
  -- Lọc theo set nếu có setId
  AND (p.set_id = $setId OR $setId IS NULL)
ORDER BY
  p.mastery_level ASC,       -- Thẻ yếu nhất trước
  p.next_review_at ASC       -- Quá hạn lâu nhất lên đầu
LIMIT 50;
```

### 3.2 Tích hợp vào SetOverview

Hiển thị **Review Queue badge** ở `SetOverview.tsx`:

```
┌─────────────────────────────────────────────┐
│  📬 Ôn tập hôm nay: 12 thẻ đến hạn         │
│  [▶ Bắt đầu ôn tập]                         │
└─────────────────────────────────────────────┘
```

- Nút "Bắt đầu ôn tập" → navigate `/sets/:setId/review` (chế độ Flashcard nhưng chỉ load `dueCards`)
- Nếu `dueCards.length === 0` → hiển thị: *"Bạn đã ôn hết hôm nay! Quay lại sau."*

---

## Giao diện Phản hồi (UI Components)

### 4.1 Component `MasteryBadge`

**File:** `src/components/progress/MasteryBadge.tsx`

Hiển thị badge tên danh hiệu với màu sắc tương ứng và chỉ số level số.

```tsx
interface MasteryBadgeProps {
  level: number;        // 1–10
  showLabel?: boolean;  // hiện tên "Mastered" hay chỉ hiện số
  size?: 'sm' | 'md' | 'lg';
}
```

**Visual:**

```
┌──────────────────────┐
│  ⚡ Mastered  Lv.8   │   ← màu xanh lá
└──────────────────────┘

┌────────────┐
│ 🏆 Lv.10  │   ← màu tím, có hiệu ứng glow
└────────────┘
```

**Màu sắc theo level:**

```ts
const LEVEL_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#94a3b8', 3: '#94a3b8',   // Newbie   — xám xanh
  4: '#f59e0b', 5: '#f59e0b', 6: '#f59e0b',   // Learning — cam vàng
  7: '#22c55e', 8: '#22c55e', 9: '#22c55e',   // Mastered — xanh lá
  10: '#a855f7',                               // Legendary — tím
};
```

---

### 4.2 Component `MasteryDots`

**File:** `src/components/progress/MasteryDots.tsx`

10 chấm nhỏ dưới mỗi thẻ Flashcard. Chấm sáng = đã đạt level đó. Animate khi tăng level.

```tsx
interface MasteryDotsProps {
  level: number;          // 1–10
  animate?: boolean;      // bật animation dot fill khi vừa tăng
}
```

**Visual:**

```
Level 6:  ● ● ● ● ● ● ○ ○ ○ ○
          [xám×3] [cam×3] [trống×4]

Level 10: ● ● ● ● ● ● ● ● ● ●
          [tím tất cả, animation glow pulse]
```

**Logic màu từng dot:**

```ts
function getDotColor(dotIndex: number, currentLevel: number): string {
  if (dotIndex >= currentLevel) return '#e2e8f0';  // chưa đạt — xám nhạt
  if (dotIndex < 3) return '#94a3b8';              // dot 1–3 (Newbie)
  if (dotIndex < 6) return '#f59e0b';              // dot 4–6 (Learning)
  if (dotIndex < 9) return '#22c55e';              // dot 7–9 (Mastered)
  return '#a855f7';                                  // dot 10 (Legendary)
}
```

---

### 4.3 Component `MasteryPieChart`

**File:** `src/components/progress/MasteryPieChart.tsx`

Biểu đồ tròn (Pie chart) phân bổ thẻ theo 4 nhóm badge. Dùng **Recharts** (đã cài ở Phase 6).

```tsx
interface MasteryPieChartProps {
  setId?: string;   // nếu undefined → hiển thị tất cả sets của user
}
```

**Data shape:**

```ts
// Query tổng hợp từ bảng progress
const pieData = [
  { name: 'Newbie (1–3)',    value: 45, color: '#94a3b8' },
  { name: 'Learning (4–6)',  value: 30, color: '#f59e0b' },
  { name: 'Mastered (7–9)', value: 18, color: '#22c55e' },
  { name: 'Legendary (10)', value: 7,  color: '#a855f7' },
];
```

**Visual:**

```
        ┌──────────────────────────────────────┐
        │          Phân bổ thành thạo          │
        │                                      │
        │       [Pie chart Recharts]            │
        │                                      │
        │  ■ Newbie (1–3)    45 thẻ • 45%     │
        │  ■ Learning (4–6)  30 thẻ • 30%     │
        │  ■ Mastered (7–9)  18 thẻ • 18%     │
        │  ■ Legendary (10)   7 thẻ •  7%     │
        └──────────────────────────────────────┘
```

- Hover vào từng mảnh → tooltip: *"20 thẻ ở cấp độ 10 (Legendary)"*
- Hiển thị tại: **Dashboard** (overview tất cả) + **SetOverview** (1 set)

---

### 4.4 Penalty UI Feedback

Khi người dùng trả lời **sai**, giao diện thể hiện sự "tiếc nuối" nhẹ nhàng nhưng không làm nản lòng.

**`MasteryDots` — animation phạt:**
```tsx
interface MasteryDotsProps {
  level: number;
  animate?: boolean;           // tăng level: bounce fill
  penaltyAnimation?: boolean;  // ← thêm mới: shake + fade-down các chấm bị mất
}
```
- `penaltyAnimation = true`: chấm bị tắt trượt từ phải → trái với `transition: opacity 300ms ease-out`.
- Tăng level: chấm mới sáng lên với `animate-bounce` (Tailwind).

**Toast thông báo hạ cấp:**
```
"Ối! Bạn quên từ này rồi. Đã hạ về [Badge] để ôn lại nhé!"
```

**Màu phản hồi nền card:**

| Tình huống | Màu flash | Thời gian |
|---|---|---|
| Đúng | `#dcfce7` (xanh nhạt) | 600ms fade |
| Sai | `#fee2e2` (đỏ nhạt) | 800ms fade |
| Leech card | Viền `#f97316` (cam) + badge ⚠️ | Thường trực |

---

## Tích hợp vào các trang Học

### 5.1 FlashcardView (`src/pages/FlashcardView.tsx`)

```
Thay đổi:
1. Gọi submitAnswer(cardId, isCorrect, 'flashcard') sau mỗi lần flip + đánh giá.
2. Hiển thị <MasteryDots level={card.mastery_level} animate={true} />
   bên dưới flip card.
3. Hiển thị <MasteryBadge level={card.mastery_level} size="sm" />
   ở góc trên phải của card.
```

### 5.2 LearnMode (`src/pages/LearnMode.tsx`)

```
Thay đổi:
1. Gọi submitAnswer(cardId, isCorrect, 'learn') sau mỗi câu trả lời MCQ.
2. Thêm MasteryDots vào result screen của từng câu.
3. Màn hình kết thúc session: hiển thị danh sách thẻ tăng level (confetti
   nhỏ nếu có thẻ nào đạt Legendary).
```

### 5.3 WriteMode (`src/pages/WriteMode.tsx`)

```
Thay đổi:
1. Gọi submitAnswer(cardId, isCorrect, 'write') — điểm tăng 2 nếu đúng.
2. Hiển thị MasteryDots dưới ô input sau khi submit.
```

### 5.4 MockTest (`src/pages/MockTest.tsx`)

```
Thay đổi:
1. Gọi submitAnswer(cardId, isCorrect, 'test') cho từng câu khi nộp bài.
2. Màn hình kết quả: bảng chi tiết có cột "Mastery" mỗi câu (MasteryBadge).
```

---

## Cấu trúc File Mới

```
src/
  lib/
    masteryEngine.ts           ← Pure functions: computeProgressUpdate, calculatePenalty,
                                  getPenaltyIntervalMs, getReviewIntervalMs, isLeechCard, getMasteryBadge
  hooks/
    useProgressUpdater.ts      ← Hook gọi DB (wrap masteryEngine, xử lý leech detection)
    useReviewQueue.ts          ← Hook lấy danh sách thẻ đến hạn
  components/
    progress/
      MasteryBadge.tsx         ← Badge tên + màu theo level (hỗ trợ Leech badge ⚠️)
      MasteryDots.tsx          ← 10 chấm animate (+ penaltyAnimation prop)
      MasteryPieChart.tsx      ← Pie chart phân bổ Recharts
plan/
  sql/
    phase7-migration.sql       ← Script SQL migration đầy đủ (bao gồm leech columns)
```

---

## Kiểm thử (Tests)

### 6.1 Unit test `masteryEngine.ts`

**File:** `src/test/masteryEngine.test.ts`

Vì `computeProgressUpdate` là pure function, tất cả case đều test được mà không cần mock DB.

```ts
describe('computeProgressUpdate', () => {
  const base: ProgressSnapshot = { mastery_level: 5, consecutive_correct: 2, ease_factor: 2.5 };

  it('flashcard correct: tăng 1 điểm', () => {
    const result = computeProgressUpdate(base, true, 'flashcard');
    expect(result.mastery_level).toBe(6);
    expect(result.last_result).toBe('correct');
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

  // --- PENALTY TESTS ---
  it('sai level 2: penalty về 1 — reset hoàn toàn', () => {
    const l2 = { ...base, mastery_level: 2 };
    const result = computeProgressUpdate(l2, false, 'flashcard');
    expect(result.mastery_level).toBe(1);
    expect(result.consecutive_correct).toBe(0);
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

  it('sai level 1: next_review_at là 10 phút (ôn lại ngay)', () => {
    const now = new Date('2026-03-20T10:00:00Z');
    const l1 = { ...base, mastery_level: 1 };
    const result = computeProgressUpdate(l1, false, 'flashcard', now);
    const diffMin = (new Date(result.next_review_at).getTime() - now.getTime()) / 60000;
    expect(diffMin).toBe(10);   // penalty = 1 → 10 phút
  });

  it('sai level 5: next_review_at là 12 giờ (buổi học tiếp)', () => {
    const now = new Date('2026-03-20T10:00:00Z');
    const l5 = { ...base, mastery_level: 5 };
    const result = computeProgressUpdate(l5, false, 'flashcard', now);
    const diffHours = (new Date(result.next_review_at).getTime() - now.getTime()) / 3600000;
    expect(diffHours).toBe(12);   // penalty = 4 (≤5) → 12 giờ
  });

  it('sai level 9: next_review_at là 1 ngày (về Mastered level 7)', () => {
    const now = new Date('2026-03-20T10:00:00Z');
    const l9 = { ...base, mastery_level: 9 };
    const result = computeProgressUpdate(l9, false, 'flashcard', now);
    const diffHours = (new Date(result.next_review_at).getTime() - now.getTime()) / 3600000;
    expect(diffHours).toBe(24);   // penalty = 7 (range 6–7) → 1 ngày
  });

  it('level 1 đúng: next_review_at là 10 phút sau', () => {
    const l1 = { ...base, mastery_level: 1 };
    const now = new Date('2026-03-20T00:00:00Z');
    // level 1 → tăng lên 2 → interval của level 2 = 30 phút
    const result = computeProgressUpdate(l1, true, 'flashcard', now);
    const diffMin = (new Date(result.next_review_at).getTime() - now.getTime()) / 60000;
    expect(diffMin).toBe(30);   // sau khi tăng lên level 2
  });

  it('level 2 đúng: next_review_at là 1 ngày sau', () => {
    const l2 = { ...base, mastery_level: 2 };
    const now = new Date('2026-03-20T00:00:00Z');
    // level 2 → tăng lên 3 → interval của level 3 = 24 giờ
    const result = computeProgressUpdate(l2, true, 'flashcard', now);
    const diffHours = (new Date(result.next_review_at).getTime() - now.getTime()) / 3600000;
    expect(diffHours).toBe(24);
  });

  it('level 8 đúng: next_review_at là 90 ngày sau', () => {
    const l8 = { ...base, mastery_level: 8 };
    const now = new Date('2026-03-20T00:00:00Z');
    // level 8 → tăng lên 9 → interval = 90 ngày
    const result = computeProgressUpdate(l8, true, 'flashcard', now);
    const diffDays = (new Date(result.next_review_at).getTime() - now.getTime()) / 86400000;
    expect(diffDays).toBe(90);
  });

  it('level 9 đúng: next_review_at là 180 ngày sau', () => {
    const l9 = { ...base, mastery_level: 9 };
    const now = new Date('2026-03-20T00:00:00Z');
    // level 9 → tăng lên 10 → interval = 180 ngày
    const result = computeProgressUpdate(l9, true, 'flashcard', now);
    const diffDays = (new Date(result.next_review_at).getTime() - now.getTime()) / 86400000;
    expect(diffDays).toBe(180);
  });

  it('REVIEW_INTERVALS_MS: kiểm tra toàn bộ bảng', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const MIN = 60 * 1000;
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

describe('getMasteryBadge', () => {
  it.each([
    [1, 'Newbie'], [3, 'Newbie'],
    [4, 'Learning'], [6, 'Learning'],
    [7, 'Mastered'], [9, 'Mastered'],
    [10, 'Legendary'],
  ])('level %i → %s', (level, badge) => {
    expect(getMasteryBadge(level)).toBe(badge);
  });
});
```

### 6.2 Integration test `useProgressUpdater`

**File:** `src/test/useProgressUpdater.test.ts`

Mock `supabase` client, kiểm tra upsert được gọi đúng payload sau `submitAnswer`.

---

## Thứ tự Triển khai

| Bước | Task | File |
|---|---|---|
| 1 | Chạy migration SQL | `plan/sql/phase7-migration.sql` |
| 2 | Viết pure engine | `src/lib/masteryEngine.ts` |
| 3 | Viết unit tests engine | `src/test/masteryEngine.test.ts` |
| 4 | Viết `useProgressUpdater` (với leech logic) | `src/hooks/useProgressUpdater.ts` |
| 5 | Viết `useReviewQueue` | `src/hooks/useReviewQueue.ts` |
| 6 | Xây `MasteryBadge` (hỗ trợ Leech badge ⚠️) | `src/components/progress/MasteryBadge.tsx` |
| 7 | Xây `MasteryDots` (+ `penaltyAnimation` prop) | `src/components/progress/MasteryDots.tsx` |
| 8 | Xây `MasteryPieChart` | `src/components/progress/MasteryPieChart.tsx` |
| 9 | Tích hợp FlashcardView | `src/pages/FlashcardView.tsx` |
| 10 | Tích hợp LearnMode | `src/pages/LearnMode.tsx` |
| 11 | Tích hợp WriteMode | `src/pages/WriteMode.tsx` |
| 12 | Tích hợp MockTest | `src/pages/MockTest.tsx` |
| 13 | Thêm Review Queue + tab Deep Study vào SetOverview | `src/pages/SetOverview.tsx` |
| 14 | Thêm MasteryPieChart vào Dashboard | `src/pages/Dashboard.tsx` |
