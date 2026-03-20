# Giai đoạn 6: Theo dõi tiến trình học & Thống kê từ vựng

## Tổng quan

Xây dựng hệ thống ghi nhận tiến trình học từng từ theo thời gian thực:
- **Tính năng 1** — Dừng học bất kỳ lúc nào vẫn lưu kết quả
- **Tính năng 2** — Bảng thống kê từ: Đã học / Đang học / Chưa học
- **Tính năng 3** — Biểu đồ hàng ngày: từ mới (xanh) + từ quên (đỏ)

**Phụ thuộc:** Phase 1-5 hoàn chỉnh.  
Bảng DB đã có: `progress(user_id, card_id, mastery_level, updated_at)`.  
Cần thêm bảng `daily_log` để ghi nhận từng sự kiện học theo ngày.

---

## Thiết kế dữ liệu

### Bảng mới: `daily_log`

```sql
CREATE TABLE daily_log (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id      UUID        REFERENCES flashcards(id) ON DELETE CASCADE NOT NULL,
  set_id       UUID        REFERENCES study_sets(id) ON DELETE CASCADE NOT NULL,
  event_type   TEXT        NOT NULL CHECK (event_type IN ('learned', 'forgotten')),
  -- 'learned'  = lần đầu trả lời đúng (mastery tăng từ 0→1 hoặc đạt ngưỡng mastered)
  -- 'forgotten' = trả lời sai một từ đã từng mastered (mastery giảm xuống)
  logged_at    DATE        DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index để query nhanh theo user + ngày
CREATE INDEX daily_log_user_date ON daily_log(user_id, logged_at);
```

### Cập nhật bảng `progress`

```sql
-- Thêm cột để phân biệt trạng thái rõ hơn (không đổi mastery_level logic cũ)
ALTER TABLE progress
  ADD COLUMN last_result TEXT CHECK (last_result IN ('correct', 'wrong')) DEFAULT NULL,
  ADD COLUMN session_id  UUID DEFAULT NULL; -- liên kết với phiên học cụ thể
```

### Bảng mới: `study_sessions`

```sql
CREATE TABLE study_sessions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  set_id      UUID        REFERENCES study_sets(id) ON DELETE CASCADE NOT NULL,
  mode        TEXT        NOT NULL CHECK (mode IN ('flashcard', 'learn', 'write', 'test', 'match')),
  cards_total INTEGER     NOT NULL DEFAULT 0,
  cards_done  INTEGER     NOT NULL DEFAULT 0,  -- số từ đã xét qua (kể cả khi dừng giữa chừng)
  cards_correct INTEGER   NOT NULL DEFAULT 0,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  ended_at    TIMESTAMPTZ DEFAULT NULL,         -- NULL = chưa kết thúc / bị dừng
  is_complete BOOLEAN     DEFAULT FALSE         -- TRUE chỉ khi học hết tất cả cards
);
```

### Định nghĩa trạng thái từ (dựa trên `mastery_level`)

| mastery_level | Trạng thái | Màu hiển thị |
|---|---|---|
| 0 | **Chưa học** (not_started) | Xám |
| 1–2 | **Đang học** (in_progress) | Vàng |
| 3–5 | **Đã học** (mastered) | Xanh lá |

---

## Tính năng 1 — Dừng học bất kỳ lúc nào, vẫn lưu kết quả

### Mục tiêu
Khi user đóng tab, nhấn "Back", hoặc điều hướng sang trang khác giữa chừng, hệ thống vẫn lưu lại tiến trình đã học đến lúc đó.

### Thiết kế

#### 1.1 Hook `useStudySession`

**File:** `src/hooks/useStudySession.ts`

```ts
interface SessionState {
  sessionId: string;
  mode: StudyMode;
  setId: string;
  results: CardResult[]; // { cardId, isCorrect, answeredAt }
}

function useStudySession(setId: string, mode: StudyMode): {
  sessionId: string;
  recordResult: (cardId: string, isCorrect: boolean) => void;
  finishSession: () => Promise<void>;  // gọi khi học xong bình thường
  pauseSession: () => Promise<void>;   // gọi khi dừng giữa chừng
}
```

#### 1.2 Cơ chế auto-save khi rời trang

Trong mỗi study page (LearnMode, WriteMode, MockTest), thêm:

```ts
// 1. useBeforeUnload — trình duyệt chuẩn bị đóng tab
useEffect(() => {
  const handler = () => pauseSession();
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, []);

// 2. React Router blocker — điều hướng sang route khác
useBlocker(() => {
  pauseSession();
  return false; // không chặn điều hướng
});
```

#### 1.3 `pauseSession` lưu gì vào DB

```ts
async function pauseSession() {
  // 1. Upsert progress cho tất cả cards đã có kết quả
  //    → cập nhật mastery_level theo kết quả
  // 2. Ghi daily_log events cho cards mới learned / forgotten
  // 3. Update study_sessions: cards_done, cards_correct, ended_at = NOW(), is_complete = false
}
```

#### 1.4 UI thay đổi nhỏ

- Thêm nút **"Pause & Save"** ở header các trang học (bên cạnh nút X)
- Khi nhấn → gọi `pauseSession()` → navigate về `/sets/:setId`
- Toast: *"Progress saved! You studied 7/20 cards."*

---

## Tính năng 2 — Bảng thống kê từ: Đã học / Đang học / Chưa học

### Mục tiêu
Hiển thị 3 nhóm từ cho một study set cụ thể, dễ nhìn và có thể drill-down xem từng từ.

### Vị trí hiển thị

**Tích hợp vào `SetOverview.tsx`** — thay thế stats row hiện tại bằng panel đầy đủ hơn.

### Data layer

#### Hook `useVocabStatus`

**File:** `src/hooks/useVocabStatus.ts`

```ts
interface VocabGroup {
  mastered:    Flashcard[]; // mastery >= 3
  inProgress:  Flashcard[]; // mastery 1-2
  notStarted:  Flashcard[]; // mastery = 0 hoặc chưa có row trong progress
}

function useVocabStatus(setId: string): {
  groups: VocabGroup;
  loading: boolean;
  // Query: JOIN flashcards LEFT JOIN progress ON card_id WHERE set_id = ?
}
```

### UI Component `VocabStatusPanel`

**File:** `src/components/progress/VocabStatusPanel.tsx`

```
┌─────────────────────────────────────────────────┐
│  📊 Vocabulary Status                           │
├───────────────┬──────────────┬──────────────────┤
│  ✅ Đã học    │  🔄 Đang học │  ⬜ Chưa học     │
│     12 từ     │     5 từ     │     8 từ          │
│  (xanh lá)   │  (vàng)      │   (xám)           │
├───────────────┴──────────────┴──────────────────┤
│  Progress bar tổng: ██████████░░░░░░  48%       │
└─────────────────────────────────────────────────┘
```

- Click vào từng tab → expand danh sách từ của nhóm đó (dạng bảng term | definition)
- Mỗi dòng có badge màu biểu thị mastery level (1–5 sao)
- Có nút **"Study this group"** → navigate vào LearnMode nhưng chỉ với cards của nhóm đó

#### Truyền `filteredCards` vào study modes

Các trang LearnMode / WriteMode nhận thêm query param `?status=inProgress|notStarted` để lọc cards tương ứng.

---

## Tính năng 3 — Biểu đồ theo dõi tiến trình từ mới hàng ngày

### Mục tiêu
Biểu đồ cột (bar chart) 7/14/30 ngày gần nhất, mỗi ngày có 2 cột chồng:
- **Xanh lá** = số từ mới *learned* (đạt mastery ngưỡng lần đầu)
- **Đỏ** = số từ *forgotten* (learned trước đó nhưng trả lời sai)

### Thư viện

Dùng **Recharts** (`npm install recharts`) — nhẹ, native React, không cần canvas thêm.

### Data layer

#### Hook `useDailyStats`

**File:** `src/hooks/useDailyStats.ts`

```ts
interface DayStat {
  date: string;        // "2026-03-14"
  learned: number;     // event_type = 'learned'
  forgotten: number;   // event_type = 'forgotten'
}

function useDailyStats(days: 7 | 14 | 30): {
  stats: DayStat[];
  totalLearned: number;
  totalForgotten: number;
  loading: boolean;
  // Query: SELECT logged_at, event_type, COUNT(*)
  //        FROM daily_log
  //        WHERE user_id = ? AND logged_at >= NOW() - INTERVAL '${days} days'
  //        GROUP BY logged_at, event_type
}
```

### UI Component `DailyProgressChart`

**File:** `src/components/progress/DailyProgressChart.tsx`

```
Streak: 🔥 5 ngày  |  7 ngày ▼       Tổng: +47 mới / -8 quên

  10 │
   8 │         ██
   6 │    ██   ██   ██
   4 │ ██ ██   ██   ██ ██
   2 │ ██ ██ ▓ ██ ▓ ██ ██
   0 └──────────────────────
      14/3 15/3 16/3 17/3 18/3 19/3 20/3

      ■ Học thêm (xanh)    ■ Quên lại (đỏ)
```

- Toggle **7 / 14 / 30 ngày** ở góc phải
- Hover vào cột → tooltip: "Ngày 18/3: +6 từ mới, -1 từ quên"
- **Streak counter**: số ngày liên tiếp có ít nhất 1 từ mới

### Vị trí tích hợp

Có **2 nơi** hiển thị:

| Nơi | Scope | Ghi chú |
|---|---|---|
| **Dashboard** (bottom section) | Toàn bộ vocab của user | Biểu đồ tổng |
| **SetOverview** (dưới VocabStatusPanel) | Chỉ vocab của set đó | Lọc theo `set_id` |

---

## Kế hoạch thực hiện

### Bước 1 — DB migration

File: `plan/sql/phase6-migration.sql`

1. Tạo bảng `study_sessions`
2. Tạo bảng `daily_log` + index
3. Thêm cột `last_result`, `session_id` vào bảng `progress`
4. RLS policies cho 2 bảng mới (user chỉ đọc/ghi data của mình)

### Bước 2 — Hooks & data layer

| Hook | File | Phụ thuộc |
|---|---|---|
| `useStudySession` | `src/hooks/useStudySession.ts` | `study_sessions`, `daily_log`, `progress` |
| `useVocabStatus` | `src/hooks/useVocabStatus.ts` | `flashcards`, `progress` |
| `useDailyStats` | `src/hooks/useDailyStats.ts` | `daily_log` |

### Bước 3 — Tính năng 1: Dừng giữa chừng

1. Implement `useStudySession` hook
2. Thêm `pauseSession` + `useBeforeUnload` + `useBlocker` vào `LearnMode`, `WriteMode`, `MockTest`
3. Thêm nút "Pause & Save" vào header 3 trang trên
4. Toast xác nhận khi lưu thành công

### Bước 4 — Tính năng 2: VocabStatusPanel

1. Implement `useVocabStatus` hook
2. Tạo component `VocabStatusPanel`
3. Tích hợp vào `SetOverview` (thay stats row cũ)
4. Thêm query param filter `?status=` vào `LearnMode` + `WriteMode`

### Bước 5 — Tính năng 3: DailyProgressChart

1. `npm install recharts @types/recharts`
2. Implement `useDailyStats` hook
3. Tạo component `DailyProgressChart`
4. Tích hợp vào `Dashboard` (section mới phía dưới set grid)
5. Tích hợp vào `SetOverview` (dưới VocabStatusPanel, scope theo set_id)

### Bước 6 — Tests

| File test | Coverage |
|---|---|
| `useStudySession.test.ts` | recordResult, pauseSession, finishSession, mock mode |
| `useVocabStatus.test.ts` | grouping logic (mastery 0/1-2/3-5) |
| `useDailyStats.test.ts` | date aggregation, streak calculation |
| `VocabStatusPanel.test.tsx` | render 3 tabs, expand collapse, count display |

---

## Cấu trúc file mới

```
src/
  hooks/
    useStudySession.ts      ← Tính năng 1
    useVocabStatus.ts       ← Tính năng 2
    useDailyStats.ts        ← Tính năng 3
  components/
    progress/
      VocabStatusPanel.tsx  ← Tính năng 2
      DailyProgressChart.tsx← Tính năng 3
      StreakBadge.tsx        ← Component nhỏ dùng lại
plan/
  sql/
    phase6-migration.sql    ← Migration script bảng mới
```

**File thay đổi:**
- `src/pages/LearnMode.tsx` — thêm useStudySession, nút Pause
- `src/pages/WriteMode.tsx` — thêm useStudySession, nút Pause
- `src/pages/MockTest.tsx` — thêm useStudySession, nút Pause
- `src/pages/SetOverview.tsx` — thêm VocabStatusPanel + DailyProgressChart
- `src/pages/Dashboard.tsx` — thêm section DailyProgressChart tổng
- `plan/sql/migration.sql` — append thêm bảng mới vào cuối

---

## Ghi chú kỹ thuật

- **Recharts** dùng `<BarChart>` với `<Bar>` stacked — 2 Bar cho `learned` và `forgotten`
- `useBlocker` từ React Router v7 yêu cầu wrap trong `<RouterProvider>` — cần kiểm tra compatibility
- `daily_log` không được ghi trùng event cho cùng 1 card trong 1 ngày → có thể dùng UPSERT với `ON CONFLICT(user_id, card_id, logged_at, event_type) DO NOTHING`
- Mock mode: `useStudySession` lưu vào `localStorage` thay vì Supabase; `useDailyStats` trả về data tĩnh giả để biểu đồ hiển thị
