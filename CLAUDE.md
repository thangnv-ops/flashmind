# CLAUDE.md — AI Agent Documentation for Quizi

> This file is the single source of truth for AI agents working on this codebase.
> Read this before reading any source file.

---

## 1. Project Summary

**Quizi** is a personal flashcard learning platform (Quizlet-style) built with React + Supabase.
Users create study sets, organize them in folders, and learn through multiple modes with spaced repetition.

**Status:** Completed through Phase 7 (Mastery & Spaced Repetition). Actively maintained.

**Language:** TypeScript. All code is strict-typed. No `any` unless unavoidable.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.8, Vite 6.2 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite` plugin) |
| Routing | React Router v7 (`createBrowserRouter`) |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Storage | Supabase Storage (MinIO locally) / AWS S3 fallback |
| Animation | Motion (Framer), Canvas Confetti |
| Charts | Recharts |
| Icons | Lucide React |
| Testing | Vitest + React Testing Library |
| Dev server | `npm run dev` → localhost:3000 |

---

## 3. Directory Structure

```
src/
├── types/index.ts            # ALL TypeScript interfaces — read this first
├── contexts/AuthContext.tsx  # Auth state, useAuth() hook
├── lib/
│   ├── supabase.ts           # Supabase client (singleton)
│   ├── masteryEngine.ts      # Spaced repetition algorithm (pure functions)
│   ├── minio.ts              # MinIO/S3 storage client
│   └── utils.ts              # cn() classname helper, misc utils
├── hooks/                    # All data-fetching and business logic
├── pages/                    # Route-level components (one per route)
├── components/               # Reusable UI components (organized by domain)
├── utils/                    # Pure utility functions (no DB calls)
├── test/                     # Vitest tests
└── mockData.ts               # Mock data for demo/offline mode

plan/                         # Phase planning docs (reference only)
├── phase-1 through phase-7   # Historical implementation plans
└── sql/migration.sql         # Database schema (source of truth for DB)
```

---

## 4. Core TypeScript Types

**File:** `src/types/index.ts` — Always check here before defining new types.

```typescript
type StudyMode = 'flashcard' | 'learn' | 'write' | 'test' | 'match'

interface Flashcard {
  id: string
  set_id: string
  term: string
  definition: string
  image_url?: string | null
  is_starred: boolean
  position: number       // display order
}

interface StudySet {
  id: string
  user_id: string
  folder_id?: string | null
  title: string
  description?: string | null
  last_accessed: string  // ISO timestamp, updated on visit
  created_at: string
  flashcards?: Flashcard[]
  progressPercent?: number  // computed, not stored in DB
}

interface Folder {
  id: string
  user_id: string
  name: string
  created_at: string
}

interface StudySession {
  id: string
  user_id: string
  set_id: string
  mode: StudyMode
  cards_total: number
  cards_done: number
  cards_correct: number
  started_at: string
  ended_at: string | null
  is_complete: boolean
}

// Progress row — one per (user, card) pair
interface Progress {
  id: string
  user_id: string
  card_id: string
  mastery_level: number     // 1–10
  next_review_at: string    // ISO timestamp
  consecutive_correct: number
  ease_factor: number
  penalty_count: number
  is_leech: boolean
  last_studied_at: string
}

// Event log for daily stats
type DailyLogEventType = 'learned' | 'forgotten' | 'reviewed'
interface DailyLog {
  id: string
  user_id: string
  card_id: string
  set_id: string
  event_type: DailyLogEventType
  logged_at: string
}
```

---

## 5. Database Schema

**Full SQL:** `plan/sql/migration.sql`

**Tables summary:**

| Table | Key columns | Notes |
|---|---|---|
| `folders` | `id, user_id, name` | RLS: user-scoped |
| `study_sets` | `id, user_id, folder_id, title, last_accessed` | `folder_id` nullable |
| `flashcards` | `id, set_id, term, definition, image_url, is_starred, position` | Cascade delete with set |
| `progress` | `user_id, card_id, mastery_level (1-10), next_review_at, penalty_count, is_leech` | Upsert pattern |
| `match_records` | `user_id, set_id, best_time_ms` | One row per (user, set) |
| `study_sessions` | `user_id, set_id, mode, cards_done, cards_correct, is_complete` | Saved on session end |
| `daily_log` | `user_id, card_id, set_id, event_type, logged_at` | Append-only, used for charts |

**RLS Policy:** All tables use Row Level Security. Every query is automatically scoped to `auth.uid()`.

**Upsert pattern for progress:**
```sql
INSERT INTO progress (...) VALUES (...)
ON CONFLICT (user_id, card_id) DO UPDATE SET ...
```

---

## 6. Routing

**File:** `src/App.tsx`

```
/                   → Dashboard (protected)
/auth               → AuthPage (public)
/set/new            → SetEditor (create)
/set/:setId         → SetOverview
/set/:setId/edit    → SetEditor (edit)
/set/:setId/flashcard → FlashcardView
/set/:setId/learn   → LearnMode
/set/:setId/write   → WriteMode
/set/:setId/match   → MatchGame
/set/:setId/test    → MockTest
```

All routes except `/auth` are wrapped in `<ProtectedRoute>`. If user is not authenticated, redirect to `/auth`.

---

## 7. Authentication

**File:** `src/contexts/AuthContext.tsx`

```typescript
const { user, loading, isMockMode, signIn, signUp, signOut, signInWithGoogle } = useAuth()
```

- `isMockMode = true` when Supabase env vars are missing → app runs with mock data
- `user` is the Supabase `User` object or null
- All pages use `useAuth()` to get the current user

**Mock mode:** When `VITE_SUPABASE_URL` is not set, app auto-logs in as a demo user. All hooks check `isMockMode` and return mock data instead of DB calls.

---

## 8. Mastery Engine (Spaced Repetition)

**File:** `src/lib/masteryEngine.ts` — Pure functions, no side effects.

### Mastery Levels (1–10)

| Level | Stage | Review Interval |
|---|---|---|
| 1 | New | 10 minutes |
| 2 | Learning | 30 minutes |
| 3–4 | Consolidating | 1 day |
| 5–6 | Intermediate | 3–7 days |
| 7–8 | Advanced | 14–30 days |
| 9 | Near-mastered | 90 days |
| 10 | Mastered | 180 days |

### Penalty System (on wrong answer)

| Current Level | Falls to |
|---|---|
| 1–2 | 1 |
| 3–4 | 2 |
| 5–6 | 4 |
| 7–8 | 5 |
| 9–10 | 7 |

### Leech Detection
- A card becomes a **leech** when `penalty_count >= 3`
- Leeches are flagged in the "Deep Study" tab in SetOverview
- User can manually study/clear leech cards

### Core Function
```typescript
computeProgressUpdate(snapshot: Progress | null, isCorrect: boolean, mode: StudyMode): ProgressUpdate
```
Returns `{ mastery_level, next_review_at, consecutive_correct, ease_factor, penalty_count, is_leech }`.
This is a **pure function** — call it then save to DB separately.

---

## 9. Learning Queue System

**File:** `src/hooks/useLearningQueue.ts`

The smart queue that powers LearnMode and WriteMode.

### Three Card Buckets

| Bucket | Condition | UI Color | Priority |
|---|---|---|---|
| A (Urgent) | mastery 1–2 AND overdue | Red | 1st |
| B (Review) | mastery ≥3 AND overdue | Blue | 2nd |
| C (New) | no progress row yet | Green | 3rd (max 10/day) |

### Queue Behavior
- Wrong answer → card pushed to end of current queue (intensive loop)
- Session complete when all original bucket cards answered correctly
- Daily new card limit: 10 cards max

### Hook Returns
```typescript
{
  queue: Flashcard[]
  currentCard: Flashcard | null
  counts: { urgent: number, review: number, new: number }
  isComplete: boolean
  recordAnswer: (cardId: string, isCorrect: boolean) => void
  reset: () => void
}
```

---

## 10. Key Hooks Reference

| Hook | File | Purpose |
|---|---|---|
| `useLearningQueue` | hooks/useLearningQueue.ts | Smart study queue with spaced repetition |
| `useStudySession` | hooks/useStudySession.ts | Track and persist session metrics |
| `useProgressUpdater` | hooks/useProgressUpdater.ts | Update mastery + log daily events |
| `useVocabStatus` | hooks/useVocabStatus.ts | Classify cards: mastered/in-progress/not-started |
| `useStudySets` | hooks/useStudySets.ts | CRUD for study sets |
| `useFolders` | hooks/useFolders.ts | CRUD for folders |
| `useMatchRecords` | hooks/useMatchRecords.ts | Personal best for match game |
| `useDailyStats` | hooks/useDailyStats.ts | Aggregate stats for charts |
| `useReviewQueue` | hooks/useReviewQueue.ts | Cards due for review today |
| `useUpdateLastAccessed` | hooks/useUpdateLastAccessed.ts | Update set.last_accessed on visit |

### Vocab Status Thresholds
- **Mastered:** `mastery_level >= 8`
- **In-progress:** has progress row AND `mastery_level < 8`
- **Not-started:** no progress row at all

---

## 11. Pages & What They Do

### Dashboard (`src/pages/Dashboard.tsx`)
- Lists recent study sets sorted by `last_accessed`
- Folder grid + unorganized sets grid
- Create new set button

### SetOverview (`src/pages/SetOverview.tsx`)
- Main hub for a study set
- Shows: card count, mastery stats, vocab status panel, daily chart, match best time
- Progress bar: mastered (purple) / in-progress (blue) / not-started (gray)
- "Ôn tập hôm nay" banner when cards are overdue for review
- Tabs: Overview / Deep Study (leeches only)
- Navigation buttons to all study modes with card counts

### SetEditor (`src/pages/SetEditor.tsx`)
- Create or edit a study set
- Dynamic card list (add/remove rows)
- Image upload per card
- Bulk import via `BulkImportModal`
- Validates: no empty terms/definitions, title required

### FlashcardView (`src/pages/FlashcardView.tsx`)
- Flip-through mode with 3D CSS animation
- Keyboard: Space = flip, ← → = navigate
- Shuffle toggle, star filter, auto-play
- Progress bar at top

### LearnMode (`src/pages/LearnMode.tsx`)
- Multiple-choice (4 options: 1 correct + 3 distractors from same set)
- Shows definition → user picks term
- Immediate green/red feedback
- Intensive loop for wrong answers
- Uses `useLearningQueue` for card order
- Triggers mastery updates via `useProgressUpdater`

### WriteMode (`src/pages/WriteMode.tsx`)
- Shows definition → user types term
- Fuzzy match via Levenshtein distance: correct / almost / wrong
- Progressive hint reveal on wrong answers
- Intensive loop for wrong/almost answers
- Mastery bonus for correct write answers
- Per-card tracking: `wrongAttempts`, `hintRevealed`

### MatchGame (`src/pages/MatchGame.tsx`)
- Selects 6–8 cards (or all if fewer)
- Grid of shuffled term+definition tiles
- Timer starts on first click (milliseconds)
- Matched pairs disappear with animation
- Wrong match: red shake, no penalty
- Saves personal best to `match_records`
- Confetti on new personal best

### MockTest (`src/pages/MockTest.tsx`)
- 50% multiple choice + 50% write questions, mixed
- One-direction, no going back
- Final score as percentage
- Review screen showing all answers

---

## 12. Component Reference

```
components/
├── layout/
│   ├── Navbar.tsx          # Top nav with user menu
│   ├── Sidebar.tsx         # Left nav with folder list
│   └── ProtectedRoute.tsx  # Auth guard
├── dashboard/
│   └── StudySetCard.tsx    # Card tile for dashboard grid
├── flashcards/
│   └── FlipCard.tsx        # 3D flip card (CSS transform-style: preserve-3d)
├── folders/
│   ├── FolderCard.tsx      # Folder tile
│   └── FolderModal.tsx     # Create/rename folder modal
├── editor/
│   └── BulkImportModal.tsx # CSV / pasted text parser
├── progress/
│   ├── MasteryBadge.tsx    # Level badge with color
│   ├── MasteryDots.tsx     # Row of dots (1-10)
│   ├── MasteryPieChart.tsx # Mastered/in-progress/not-started pie
│   ├── VocabStatusPanel.tsx# Grouped vocab count display
│   ├── DailyProgressChart.tsx # Recharts bar chart (learned/forgotten)
│   ├── StreakBadge.tsx     # Streak counter badge
│   └── QueueIndicator.tsx  # Urgent/review/new counts with colors
└── common/
    └── Toast.tsx           # Toast notification (auto-dismiss)
```

---

## 13. Utility Functions

**`src/utils/questionGenerator.ts`**
```typescript
generateMCQuestions(cards: Flashcard[]): MCQuestion[]
// Each question: { card, distractors: Flashcard[3] } — distractors from same set

generateTest(cards: Flashcard[]): TestQuestion[]
// 50% MC + 50% write, shuffled
```

**`src/utils/levenshtein.ts`**
```typescript
checkAnswer(input: string, expected: string): 'correct' | 'almost' | 'wrong'
// 'almost' when edit distance <= 2 (typo tolerance)
// Case-insensitive, trimmed
```

**`src/utils/time.ts`**
```typescript
relativeTime(isoString: string): string  // "2 hours ago"
todayVN(): string                         // "2026-03-23" in Vietnam timezone
```

---

## 14. Environment Variables

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_APP_URL=http://localhost:3000    # For OAuth redirect URIs
GEMINI_API_KEY=your_gemini_key        # Future AI features
```

When `VITE_SUPABASE_URL` is missing → `isMockMode = true` → mock data used everywhere.

---

## 15. Dev Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build (output: dist/)
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run coverage     # Coverage report
npm run lint         # TypeScript type check (tsc --noEmit)
npm run migrate      # Run DB migrations
```

---

## 16. Data Flow Patterns

### Study Session Flow (LearnMode / WriteMode)
```
1. useLearningQueue → builds card queue (urgent → review → new)
2. User answers card
3. useStudySession.recordResult(cardId, isCorrect) → updates session counters
4. useProgressUpdater.updateProgress(cardId, isCorrect, mode) →
   - Calls computeProgressUpdate() (pure, from masteryEngine.ts)
   - Upserts to `progress` table
   - Inserts to `daily_log` table (event: learned/forgotten/reviewed)
5. If wrong → card pushed back in queue (intensive loop)
6. isComplete → show results screen
7. On unmount or beforeunload → finishSession() saves to `study_sessions`
```

### Vocab Status Classification Flow
```
useVocabStatus(setId) →
  Fetches progress rows for all cards in set →
  Cards with mastery >= 8 → mastered[]
  Cards with progress row, mastery < 8 → inProgress[]
  Cards without progress row → notStarted[]
```

### Daily Stats Flow
```
daily_log table (append-only) →
useDailyStats(setId) →
  Groups by date and event_type →
  Returns { date, learned, forgotten, reviewed }[] →
DailyProgressChart renders Recharts BarChart
```

---

## 17. Key Business Rules

1. **Daily new card limit:** Max 10 new cards (Bucket C) per day per user. Enforced in `useLearningQueue`.
2. **Intensive loop:** Wrong cards re-enter the end of the current queue until answered correctly.
3. **Leech threshold:** `penalty_count >= 3` → card marked `is_leech = true`.
4. **Mastered threshold:** `mastery_level >= 8` → counts as mastered in all UI.
5. **Write mode bonus:** Correct write answer gives extra mastery increment vs. multiple-choice.
6. **Match game timer:** Starts on first tile click, stops when all pairs matched.
7. **Personal best:** Only updated if new time < existing `best_time_ms`.
8. **Review overdue:** `next_review_at < now()` → card is overdue, shown in queue.
9. **Set last_accessed:** Updated every time user visits SetOverview (not study modes).
10. **Session backup:** Study sessions auto-saved to localStorage on `beforeunload`.

---

## 18. Common Tasks → Where to Make Changes

| Task | Files to modify |
|---|---|
| Add new study mode | `src/App.tsx` (route), `src/pages/NewMode.tsx`, `src/pages/SetOverview.tsx` (button) |
| Change mastery levels/intervals | `src/lib/masteryEngine.ts` |
| Change queue bucket logic | `src/hooks/useLearningQueue.ts` |
| Change mastered threshold | `src/hooks/useVocabStatus.ts` |
| Add new card field | `src/types/index.ts`, `plan/sql/migration.sql`, `src/pages/SetEditor.tsx` |
| Add new chart/stat | `src/components/progress/`, `src/hooks/useDailyStats.ts` |
| Change fuzzy match tolerance | `src/utils/levenshtein.ts` — checkAnswer() |
| Add new event type to daily log | `src/types/index.ts` (DailyLogEventType), `src/hooks/useProgressUpdater.ts` |
| Add new DB table | `plan/sql/migration.sql`, new hook in `src/hooks/` |

---

## 19. Testing Conventions

- Test files in `src/test/*.test.ts` or `*.test.tsx`
- Mock Supabase with `vi.mock('../lib/supabase')`
- Mock data available in `src/mockData.ts`
- Run single file: `npm run test -- src/test/filename.test.ts`
- Tests focus on: hooks logic, utility functions, component rendering

---

## 20. Known Patterns & Conventions

- **No Redux/Zustand:** State is managed via React hooks + Supabase queries. Each hook owns its data.
- **Tailwind v4:** Use `@apply` sparingly; prefer inline classes. No `tailwind.config.js` — config is in CSS.
- **Supabase calls:** Always use the singleton from `src/lib/supabase.ts`. Never create new clients.
- **Error handling:** Hooks return `{ data, loading, error }`. Pages show error state inline.
- **Toast notifications:** Use `Toast` component from `src/components/common/Toast.tsx` for user feedback.
- **Vietnamese UI:** Most user-facing strings are in Vietnamese. Comments may be in either language.
- **Image URLs:** Stored as full public URLs in `flashcards.image_url`. Handled by `src/lib/minio.ts`.
- **Position field:** `flashcards.position` is used for display order. Maintained on create/reorder.
