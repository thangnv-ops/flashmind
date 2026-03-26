# Phase 8 — Nâng cấp Quizi theo mô hình Learn My Words

> **Tài liệu tham chiếu:** Phân tích learnmywords.com (PDF)
> **Ngày lập:** 2026-03-24
> **Ưu tiên:** Tính năng trong PDF có độ ưu tiên cao nhất khi xung đột với thiết kế cũ.

---

## 1. Tổng quan yêu cầu từ PDF

Learn My Words xây dựng hệ thống học tập dựa trên 3 trụ cột:

1. **Thuật toán SRS vững chắc** — 5 Memory Bands thể hiện trực quan trạng thái ghi nhớ
2. **Đa dạng phương thức học** — 7 chế độ học + 3 trò chơi gamification
3. **Analytics sâu** — Band distribution chart, learning trend, study time

Quizi hiện có: 10 mastery levels (tương đương), 5 study modes, basic daily chart.
Cần thêm: Band visualization, learning trend chart, thêm 2 games (Word Scramble + Word Builder), study time tracking.

---

## 2. Phân tích tác động (Impact Analysis)

### Files bị ảnh hưởng trực tiếp

```
ADDITIVE (an toàn — chỉ thêm, không sửa logic cũ):
├── src/lib/masteryEngine.ts          + masteryToBand(), BandLevel, BAND_INFO
├── src/hooks/useVocabStatus.ts       + bandCounts trong return value
├── src/hooks/useDailyStats.ts        + learningTrend[], studyTimeByMode
├── src/types/index.ts                + BandLevel, LearningTrendPoint, StudyTimeStats
├── src/pages/SetOverview.tsx         + render 2 chart sections mới
└── src/App.tsx                       + routes /set/:setId/scramble, /set/:setId/builder

NEW FILES (không ảnh hưởng code cũ):
├── src/components/progress/BandDistributionChart.tsx
├── src/components/progress/LearningTrendChart.tsx
├── src/components/progress/StudyTimePanel.tsx
├── src/pages/WordScramble.tsx
└── src/pages/WordBuilder.tsx

DATABASE (additive migrations):
└── plan/sql/phase10-study-time.sql   + study_time_log table
```

### Breaking change risks: NONE
Toàn bộ thay đổi là additive. `computeProgressUpdate()` không bị sửa.

---

## 3. Kế hoạch thực thi chi tiết

---

### BƯỚC 1 — Chuẩn bị: Types & masteryEngine

**Mục tiêu:** Map 10 mastery levels → 5 Memory Bands (theo mô hình learnmywords.com)

**Cơ sở từ PDF:**
> "Learn My Words cụ thể hóa lý thuyết SRS thành một hệ thống 5 băng tần ghi nhớ,
> giúp định lượng hóa trạng thái của từng từ vựng trong tâm trí người học."

**Mapping:**

| Band | Mastery Level | Trạng thái | Tần suất ôn tập | Màu |
|------|--------------|------------|-----------------|-----|
| 1 | 1–2 | Chưa nhớ (Unfamiliar) | Hàng ngày | Đỏ |
| 2 | 3–4 | Nhớ mong manh (Fragile) | 2–3 ngày | Cam |
| 3 | 5–6 | Nhớ chủ động (Active) | Hàng tuần | Vàng |
| 4 | 7–8 | Nhớ tự tin (Confident) | 2 tuần | Xanh dương |
| 5 | 9–10 | Nhớ dài hạn (Long-term) | Hàng tháng | Xanh lá |

**File:** `src/types/index.ts`
```typescript
// Thêm vào cuối file

export type BandLevel = 1 | 2 | 3 | 4 | 5

export interface BandInfo {
  band: BandLevel
  label: string
  labelEn: string
  reviewInterval: string
  color: string        // Tailwind bg class
  textColor: string    // Tailwind text class
}

export interface LearningTrendPoint {
  date: string         // 'YYYY-MM-DD'
  newlyLearned: number // cards được học lần đầu (event_type = 'learned')
  forgotten: number    // cards bị quên (event_type = 'forgotten')
  // promoted: Phase 2 — cần column first_promoted_at trong progress table
}

export interface StudyTimeStats {
  totalMinutes: number
  byMode: Record<StudyMode, number>  // phút theo từng mode
}
```

**File:** `src/lib/masteryEngine.ts`
```typescript
// Thêm vào sau các exports hiện có — KHÔNG sửa gì ở trên

import type { BandLevel, BandInfo } from '../types'

export function masteryToBand(masteryLevel: number): BandLevel {
  if (masteryLevel <= 2) return 1
  if (masteryLevel <= 4) return 2
  if (masteryLevel <= 6) return 3
  if (masteryLevel <= 8) return 4
  return 5
}

export const BAND_INFO: Record<BandLevel, BandInfo> = {
  1: { band: 1, label: 'Chưa nhớ',  labelEn: 'Unfamiliar', reviewInterval: '1 ngày',   color: 'bg-red-500',     textColor: 'text-red-600' },
  2: { band: 2, label: 'Mong manh', labelEn: 'Fragile',    reviewInterval: '2–3 ngày', color: 'bg-orange-400',  textColor: 'text-orange-500' },
  3: { band: 3, label: 'Chủ động',  labelEn: 'Active',     reviewInterval: '1 tuần',   color: 'bg-yellow-400',  textColor: 'text-yellow-600' },
  4: { band: 4, label: 'Tự tin',    labelEn: 'Confident',  reviewInterval: '2 tuần',   color: 'bg-blue-500',    textColor: 'text-blue-600' },
  5: { band: 5, label: 'Dài hạn',   labelEn: 'Long-term',  reviewInterval: '1 tháng',  color: 'bg-emerald-500', textColor: 'text-emerald-600' },
}

export function getBandInfo(masteryLevel: number): BandInfo {
  return BAND_INFO[masteryToBand(masteryLevel)]
}
```

---

### BƯỚC 2 — useVocabStatus: Thêm bandCounts

**Mục tiêu:** Cung cấp số lượng từ trong từng band để render chart

**File:** `src/hooks/useVocabStatus.ts`

Trong phần tính toán groups (sau vòng lặp flashcards), thêm:

```typescript
// Thêm import — BandLevel lấy từ types, masteryToBand từ masteryEngine
import { masteryToBand } from '../lib/masteryEngine'
import type { BandLevel } from '../types'

// Thêm sau khi tạo groups, trước khi return:
const bandCounts: Record<BandLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

for (const card of flashcards) {
  const p = progressMap.get(card.id)
  if (p) {
    const band = masteryToBand(p.mastery_level)
    bandCounts[band] += 1
  } else {
    // Cards chưa học → Band 1
    bandCounts[1] += 1
  }
}

// Cập nhật return:
return { groups, bandCounts, loading, refetch }
```

Cập nhật TypeScript return type:
```typescript
interface UseVocabStatusReturn {
  groups: { mastered: Flashcard[], inProgress: Flashcard[], notStarted: Flashcard[] }
  bandCounts: Record<BandLevel, number>
  loading: boolean
  refetch: () => void
}
```

---

### BƯỚC 3 — useDailyStats: Thêm Learning Trend

**Mục tiêu:** Thêm dữ liệu "xu hướng học tập" — từ mới học vs từ bị quên
**Cơ sở từ PDF:**
> "Xu hướng học tập: Số lượng từ mới học so với số lượng từ đã chuyển vào bộ nhớ dài hạn."

**File:** `src/hooks/useDailyStats.ts`

Thêm `learningTrend` vào data trả về. Tính từ `daily_log` table hiện có:

```typescript
// Trong fetchStats(), thêm query thứ 2 song song:
const { data: trendRaw } = await supabase
  .from('daily_log')
  .select('card_id, event_type, logged_at')
  .eq('set_id', setId)
  .gte('logged_at', startDate)
  .order('logged_at', { ascending: true })

// Build learningTrend:
const trendMap = new Map<string, { newlyLearned: Set<string>, forgotten: Set<string> }>()

trendRaw?.forEach(row => {
  const date = row.logged_at.slice(0, 10)
  if (!trendMap.has(date)) trendMap.set(date, { newlyLearned: new Set(), forgotten: new Set() })
  const day = trendMap.get(date)!
  if (row.event_type === 'learned') day.newlyLearned.add(row.card_id)
  if (row.event_type === 'forgotten') day.forgotten.add(row.card_id)
})

// startDate = N ngày trước tính từ hôm nay (VD: days=14 → 14 ngày)
// dateRange = mảng ['YYYY-MM-DD'] từ startDate đến today (đủ `days` phần tử)
const today = todayVN()  // từ src/utils/time.ts — trả về 'YYYY-MM-DD' theo TZ Việt Nam
const startDateObj = new Date(today)
startDateObj.setDate(startDateObj.getDate() - days + 1)
const dateRange: string[] = Array.from({ length: days }, (_, i) => {
  const d = new Date(startDateObj)
  d.setDate(d.getDate() + i)
  return d.toISOString().slice(0, 10)
})
// startDate (string) dùng cho Supabase query:
const startDate = dateRange[0]

const learningTrend: LearningTrendPoint[] = dateRange.map(date => ({
  date,
  newlyLearned: trendMap.get(date)?.newlyLearned.size ?? 0,
  forgotten:    trendMap.get(date)?.forgotten.size ?? 0,
}))

// Thêm vào return:
return { stats, learningTrend, totalLearned, totalForgotten, ..., loading }
```

---

### BƯỚC 4 — Component: BandDistributionChart

**Mục tiêu:** Biểu đồ phân bổ 5 băng tần — tính năng đặc trưng của learnmywords.com

**Cơ sở từ PDF:**
> "Phân bổ băng tần: Biểu đồ cột hiển thị số lượng từ trong mỗi băng tần từ 1 đến 5."

**File mới:** `src/components/progress/BandDistributionChart.tsx`

```typescript
import { BAND_INFO } from '../../lib/masteryEngine'
import type { BandLevel } from '../../types'

interface Props {
  bandCounts: Record<BandLevel, number>
  totalCards: number
}

export function BandDistributionChart({ bandCounts, totalCards }: Props) {
  const bands: BandLevel[] = [1, 2, 3, 4, 5]

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Phân bổ băng tần ghi nhớ</h3>
      {bands.map(band => {
        const info = BAND_INFO[band]
        const count = bandCounts[band]
        const pct = totalCards > 0 ? Math.round((count / totalCards) * 100) : 0
        return (
          <div key={band} className="flex items-center gap-3">
            {/* Band label */}
            <span className="w-24 text-xs text-gray-500 shrink-0">
              Band {band} · {info.label}
            </span>
            {/* Progress bar */}
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${info.color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* Count + % */}
            <span className="w-20 text-xs text-gray-600 text-right shrink-0">
              {count} từ ({pct}%)
            </span>
          </div>
        )
      })}

      {/* Legend */}
      <p className="text-xs text-gray-400 pt-1">
        Tổng: {totalCards} từ ·
        {' '}<span className="text-emerald-600 font-medium">{bandCounts[5]} dài hạn</span>
        {' '}·{' '}
        <span className="text-red-500 font-medium">{bandCounts[1]} cần ôn</span>
      </p>
    </div>
  )
}
```

---

### BƯỚC 5 — Component: LearningTrendChart

**Mục tiêu:** Biểu đồ xu hướng học tập — từ mới vs từ bị quên

**Cơ sở từ PDF:**
> "Xu hướng học tập: Số lượng từ mới học so với số lượng từ đã chuyển vào bộ nhớ dài hạn."

**File mới:** `src/components/progress/LearningTrendChart.tsx`

```typescript
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { LearningTrendPoint } from '../../types'

interface Props {
  data: LearningTrendPoint[]
  days?: 7 | 14 | 30
}

export function LearningTrendChart({ data, days = 14 }: Props) {
  if (data.every(d => d.newlyLearned === 0 && d.forgotten === 0)) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        Chưa có dữ liệu học tập
      </div>
    )
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    return `${d.getDate()}/${d.getMonth() + 1}`
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Xu hướng học tập ({days} ngày)
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <Tooltip
            labelFormatter={formatDate}
            formatter={(value: number, name: string) => [
              `${value} từ`,
              name === 'newlyLearned' ? 'Từ mới học' : 'Từ bị quên'
            ]}
          />
          <Legend
            formatter={(value) => value === 'newlyLearned' ? 'Từ mới học' : 'Từ bị quên'}
          />
          <Area
            type="monotone"
            dataKey="newlyLearned"
            stroke="#10b981"
            fill="#d1fae5"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="forgotten"
            stroke="#ef4444"
            fill="#fee2e2"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

---

### BƯỚC 6 — SetOverview: Tích hợp 2 charts mới

**File:** `src/pages/SetOverview.tsx`

**Thay đổi 1:** Import thêm hooks và components

```typescript
// Thêm vào imports
import { BandDistributionChart } from '../components/progress/BandDistributionChart'
import { LearningTrendChart } from '../components/progress/LearningTrendChart'

// Sửa destructure từ useVocabStatus:
const { groups, bandCounts, loading: vocabLoading, refetch: refetchVocab } = useVocabStatus(setId)

// Sửa destructure từ useDailyStats (nếu chưa có learningTrend):
const { stats, learningTrend, streak, loading: statsLoading } = useDailyStats(setId, 14)
```

**Thay đổi 2:** Thêm section charts sau VocabStatusPanel

```tsx
{/* === Band Distribution Chart === */}
{!vocabLoading && (
  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
    <BandDistributionChart
      bandCounts={bandCounts}
      totalCards={set.flashcards?.length ?? 0}
    />
  </div>
)}

{/* === Learning Trend Chart (thay thế / bổ sung DailyProgressChart) === */}
{!statsLoading && learningTrend && (
  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
    <LearningTrendChart data={learningTrend} days={14} />
  </div>
)}
```

---

### BƯỚC 7 — Word Scramble Game (Gamification)

**Mục tiêu:** Trò chơi giải chữ — tương đương "Word Scramble" của learnmywords.com

**Cơ sở từ PDF:**
> "Giải chữ (Word Scramble): Tập trung vào cấu trúc ký tự và chính tả thông qua việc
> sắp xếp lại các chữ cái bị xáo trộn dựa trên gợi ý mức độ khó."

**Cơ chế:**
1. Hiển thị **definition** của card
2. Hiển thị **các chữ cái của term** bị xáo trộn dưới dạng tiles clickable
3. User click từng tile để build từ (có thể click để bỏ chọn)
4. Click "Kiểm tra" → so sánh với term gốc (case-insensitive, trim)
5. Đúng → tile xanh + chuyển card tiếp
6. Sai → tile đỏ, reveal đáp án, chuyển card tiếp sau 1.5s
7. **Không cập nhật mastery** — đây là game, không ảnh hưởng SRS
8. Kết thúc: hiển thị score (đúng/tổng) + thời gian

**File mới:** `src/pages/WordScramble.tsx`

```typescript
// Route: /set/:setId/scramble
// State: currentIndex, scrambledLetters, selectedLetters, score, timer, gameState

// Card selection — ưu tiên Band 1-3 (cards đang học/chưa vững), tối đa 15 cards
// progressMap: Map<cardId, Progress> — lấy từ useVocabStatus hoặc query progress table
const selectedCards = useMemo(() => {
  if (!flashcards || !progressMap) return []

  const band1to3: Flashcard[] = []
  const band4to5: Flashcard[] = []

  for (const card of flashcards) {
    const p = progressMap.get(card.id)
    const band = p ? masteryToBand(p.mastery_level) : 1  // chưa học → Band 1
    if (band <= 3) band1to3.push(card)
    else band4to5.push(card)
  }

  // Ưu tiên Band 1-3, bổ sung Band 4-5 nếu thiếu, cap 15 cards
  const pool = [...band1to3, ...band4to5].slice(0, 15)
  // Fisher-Yates để random thứ tự
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}, [flashcards, progressMap])

interface LetterTile {
  id: string        // unique key: `${wordIndex}-${letter}-${letterIndex}`
  letter: string
  isSelected: boolean
  isSpace?: boolean  // space separator — hiển thị nhưng không clickable
}

// shuffleTerm — xử lý đúng cả term có space (VD: "make up", "phrasal verb")
function shuffleTerm(term: string): LetterTile[] {
  if (term.length <= 1) {
    // Edge case: term 1 ký tự — skip shuffle, check sẽ auto-correct
    return [{ id: `0-${term}-0`, letter: term, isSelected: false }]
  }

  const words = term.split(' ')
  const result: LetterTile[] = []

  words.forEach((word, wi) => {
    if (word.length === 0) return
    const letters = word.split('')
    // Fisher-Yates shuffle từng word riêng — giữ nguyên vị trí space
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[letters[i], letters[j]] = [letters[j], letters[i]]
    }
    // Guarantee shuffled ≠ original word (tránh trường hợp palindrome)
    if (letters.join('') === word && word.length > 1) {
      ;[letters[0], letters[letters.length - 1]] = [letters[letters.length - 1], letters[0]]
    }

    letters.forEach((l, li) => {
      result.push({ id: `${wi}-${l}-${li}`, letter: l, isSelected: false })
    })
    // Space separator sau mỗi word (trừ word cuối)
    if (wi < words.length - 1) {
      result.push({ id: `space-${wi}`, letter: ' ', isSelected: false, isSpace: true })
    }
  })

  return result
}
```

**File:** `src/App.tsx`

```typescript
// Thêm import
import { WordScramble } from './pages/WordScramble'

// Thêm route trong ProtectedRoute:
{ path: '/set/:setId/scramble', element: <WordScramble /> }
```

**File:** `src/pages/SetOverview.tsx`

```tsx
// Thêm nút Word Scramble vào study modes section
<Link to={`/set/${setId}/scramble`}>
  <button className="...">
    🔤 Giải chữ
    <span className="badge">{set.flashcards?.length ?? 0}</span>
  </button>
</Link>
```

---

### BƯỚC 8 — Word Builder Game (Xây từ)

**Mục tiêu:** Trò chơi xây từ — tương đương "Word Builder" của learnmywords.com

**Cơ sở từ PDF:**
> "Xây từ (Word Builder): Khuyến khích sự sáng tạo và khả năng nhận diện hình thái học của
> từ từ các chữ cái ngẫu nhiên."

**Khác biệt với Word Scramble:**
| | Word Scramble | Word Builder |
|---|---|---|
| Pool chữ cái | Đúng các chữ của term | Chữ đúng + noise letters thêm vào |
| Thử thách | Nhớ vị trí chữ | Nhận diện chữ nào thuộc từ (lọc nhiễu) |
| Kỹ năng rèn | Cấu trúc ký tự | Hình thái học từ vựng |

**Cơ chế:**
1. Hiển thị **definition** của card
2. Hiển thị pool chữ cái: **các chữ của term + 4 noise letters ngẫu nhiên**, tất cả shuffle
3. User click chữ từ pool → chữ đó di chuyển lên vùng "đang xây"
4. Click chữ đã chọn → trả về pool
5. Click "Kiểm tra" → so sánh với term (case-insensitive, trim)
6. Đúng → highlight xanh + chuyển card tiếp
7. Sai → highlight đỏ, reveal đáp án, chuyển card tiếp sau 1.5s
8. **Không cập nhật mastery** — game thuần, không ảnh hưởng SRS
9. Kết thúc: hiển thị score + thời gian

**File mới:** `src/pages/WordBuilder.tsx`

```typescript
// Route: /set/:setId/builder
// State giống Scramble: currentIndex, pool, built, score, timer, gameState
// Card selection: giống Scramble — ưu tiên Band 1-3, tối đa 15 cards

// Noise letter generation — chọn chữ không có trong term
function generateNoiseLetters(term: string, count: number = 4): string[] {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const termSet = new Set(term.toLowerCase().replace(/\s/g, '').split(''))
  const candidates = alphabet.split('').filter(c => !termSet.has(c))
  // Fisher-Yates shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  return candidates.slice(0, count)
}

// Build initial pool: term letters + noise letters, all shuffled
function buildPool(term: string): LetterTile[] {
  const termLetters = term.replace(/\s/g, '').split('')
  const noiseLetters = generateNoiseLetters(term, 4)
  const all = [...termLetters, ...noiseLetters]
  // Fisher-Yates shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.map((l, i) => ({ id: `${l}-${i}`, letter: l, isSelected: false }))
}

// Check answer: built letters (không space) phải match term (không space)
function checkAnswer(built: LetterTile[], term: string): boolean {
  const builtStr = built.map(t => t.letter).join('').trim().toLowerCase()
  const termStr = term.replace(/\s/g, '').toLowerCase()
  return builtStr === termStr
}

// Edge cases:
// - Term có space → noise vẫn là single letters, built không cần space (check bỏ space)
// - Term = 1 ký tự → noise = 4 letters, user phải tìm đúng chữ
// - Set < 2 cards → vẫn chơi bình thường (không cần distractors)
```

**File:** `src/App.tsx`

```typescript
// Thêm import
import { WordBuilder } from './pages/WordBuilder'

// Thêm route trong ProtectedRoute:
{ path: '/set/:setId/builder', element: <WordBuilder /> }
```

**File:** `src/pages/SetOverview.tsx`

```tsx
// Thêm nút Word Builder vào study modes section (cạnh Word Scramble)
<Link to={`/set/${setId}/builder`}>
  <button className="...">
    🧱 Xây từ
    <span className="badge">{set.flashcards?.length ?? 0}</span>
  </button>
</Link>
```

---

### BƯỚC 9 (Phase 2) — Study Time Tracking

**Cơ sở từ PDF:**
> "Thời gian học tập: Tổng thời gian dành cho các hoạt động khác nhau để tối ưu hóa
> lịch trình cá nhân."

**Database migration:** `plan/sql/phase10-study-time.sql`

```sql
-- Thêm duration_seconds vào study_sessions (đã có table)
ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

-- Tính từ started_at và ended_at (có thể tính retroactively)
-- UPDATE study_sessions
--   SET duration_seconds = EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
--   WHERE ended_at IS NOT NULL AND duration_seconds = 0;
```

**Hook:** `src/hooks/useStudyTimeStats.ts` (file mới)

```typescript
// Query study_sessions của user trong N ngày
// Group by mode → tổng duration_seconds
// Return: { byMode: Record<StudyMode, number>, totalMinutes: number }
```

**Lưu ý:** `useStudySession.ts` hiện lưu `started_at` và `ended_at` — chỉ cần
thêm tính `duration_seconds = (ended_at - started_at)` khi `finishSession()`.

---

## 4. SQL Migration cần chạy

### Phase 8 — Không cần migration (dùng data hiện có)

BandDistributionChart và LearningTrendChart đều dùng data hiện có từ:
- `progress` table → mastery_level → band mapping (tính ở frontend)
- `daily_log` table → event_type = 'learned'/'forgotten'

### Phase 2 — study_time_log (tuỳ chọn)

```sql
-- plan/sql/phase10-study-time.sql
-- KHÔNG dùng GENERATED ALWAYS AS — Supabase INSERT/UPDATE không hoạt động với computed column
-- Dùng plain column, tính thủ công trong finishSession()
ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

-- Tính trong finishSession() của useStudySession.ts:
-- duration_seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000)
```

---

## 5. Thứ tự triển khai theo rủi ro

```
Phase A — Foundation (an toàn nhất, impact cao nhất):
  [ ] Bước 1: types/index.ts + masteryEngine.ts (thêm band functions)
  [ ] Bước 2: useVocabStatus.ts (thêm bandCounts)
  [ ] Bước 4: BandDistributionChart.tsx (component mới)
  [ ] Bước 6a: SetOverview.tsx (render BandDistributionChart)

Phase B — Analytics:
  [ ] Bước 3: useDailyStats.ts (thêm learningTrend)
  [ ] Bước 5: LearningTrendChart.tsx (component mới)
  [ ] Bước 6b: SetOverview.tsx (render LearningTrendChart)

Phase C — Gamification:
  [ ] Bước 7: WordScramble.tsx (trang mới)
  [ ] Bước 8: WordBuilder.tsx (trang mới)
  [ ] App.tsx + SetOverview.tsx (routes + nút cho cả 2 game)

Phase D — Study Time (cần migration):
  [ ] Bước 9: SQL migration
  [ ] useStudyTimeStats.ts
  [ ] StudyTimePanel.tsx
  [ ] SetOverview.tsx render
```

---

## 6. Chiến lược kiểm thử (Testing Strategy)

### Regression — Tính năng cũ không hỏng

| Test | Mục tiêu | File |
|------|----------|------|
| `computeProgressUpdate()` với level 1–10 | SRS logic không đổi | masteryEngine.test.ts |
| `useLearningQueue` build queue | 3 buckets vẫn đúng | useLearningQueue.test.ts |
| `useVocabStatus` groups | mastered/inProgress/notStarted vẫn đúng | useVocabStatus.test.ts |
| SetOverview render | Không crash với bandCounts mới | SetOverview.test.tsx |

### New Feature Tests

| Test | Input | Expected |
|------|-------|----------|
| `masteryToBand(1)` | level 1 | band 1 |
| `masteryToBand(3)` | level 3 | band 2 |
| `masteryToBand(5)` | level 5 | band 3 |
| `masteryToBand(7)` | level 7 | band 4 |
| `masteryToBand(10)` | level 10 | band 5 |
| `BandDistributionChart` với bandCounts = {1:0,2:0,3:0,4:0,5:0} | empty set | render 0% bars, không crash |
| `BandDistributionChart` totalCards=0 | division by zero | pct = 0, không crash |
| `LearningTrendChart` data = all zeros | no activity | hiển thị "Chưa có dữ liệu" |
| Word Scramble: term = "A" | 1 chữ | skip shuffle, mark đúng luôn |
| Word Scramble: term = "level" | palindrome-ish | kết quả khác "level" |
| Word Scramble: check answer | "APPLE" vs "apple" | đúng (case-insensitive) |
| Word Scramble: term = "make up" | có space | space tile = isSpace=true, không clickable |
| Word Builder: generateNoiseLetters("cat", 4) | 3-letter term | trả về 4 chữ không có trong "cat" |
| Word Builder: buildPool("apple") | 5-letter term | pool = 9 tiles (5 + 4 noise), đủ loại |
| Word Builder: check answer | built="APPLE", term="apple" | đúng (case-insensitive) |
| Word Builder: term có space "make up" | built = "makeup" | check bỏ space trước so sánh |

### Edge Cases đặc biệt cần test

- Set có 0 flashcards → BandDistributionChart: totalCards=0, không chia cho 0
- Set chưa học lần nào → bandCounts[1] = totalCards, bands 2-5 = 0
- daily_log trống → LearningTrendChart hiển thị empty state
- Word Scramble với set < 2 cards → xử lý gracefully
- Word Builder với set < 2 cards → xử lý gracefully
- Word Builder: noise letters không được trùng với bất kỳ chữ nào trong term

---

## 7. Liên kết tham chiếu

| Tính năng | Nguồn từ PDF | Section trong plan |
|-----------|--------------|-------------------|
| 5 Memory Bands | "Mô hình hóa tiến trình ghi nhớ qua 5 băng tần" (trang 1-2) | Bước 1 |
| Band Distribution Chart | "Phân bổ băng tần: Biểu đồ cột..." (trang 6) | Bước 4 |
| Learning Trend | "Xu hướng học tập: Số lượng từ mới học..." (trang 6) | Bước 3+5 |
| Study Time | "Thời gian học tập: Tổng thời gian..." (trang 6) | Bước 9 |
| Word Scramble | "Giải chữ (Word Scramble)..." (trang 3) | Bước 7 |
| Word Builder | "Xây từ (Word Builder)..." (trang 3) | Bước 8 |
