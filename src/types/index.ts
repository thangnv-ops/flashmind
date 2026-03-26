export type StudyMode = 'flashcard' | 'learn' | 'write' | 'test' | 'match';

export interface StudySession {
  id: string;
  user_id: string;
  set_id: string;
  mode: StudyMode;
  cards_total: number;
  cards_done: number;
  cards_correct: number;
  started_at: string;
  ended_at: string | null;
  is_complete: boolean;
}

export interface Flashcard {
  id: string;
  set_id: string;
  term: string;
  definition: string;
  image_url?: string | null;
  is_starred: boolean;
  position: number;
}

export interface StudySet {
  id: string;
  user_id: string;
  folder_id?: string | null;
  title: string;
  description?: string | null;
  daily_new_limit: number;  // max new cards per day, default 10
  last_accessed: string; // ISO timestamp
  created_at: string;    // ISO timestamp
  flashcards?: Flashcard[];
  // Computed UI fields — populated by hooks (not stored in DB directly)
  progressPercent?: number; // 0–100, calculated from progress table in Phase 5
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Phase 8 — Band system (maps mastery 1–10 to 5 memory bands)
// ---------------------------------------------------------------------------

export type BandLevel = 1 | 2 | 3 | 4 | 5;

export interface BandInfo {
  band: BandLevel;
  label: string;        // Vietnamese
  labelEn: string;      // English
  reviewInterval: string;
  color: string;        // Tailwind bg class
  textColor: string;    // Tailwind text class
}

export interface LearningTrendPoint {
  date: string;         // 'YYYY-MM-DD'
  newlyLearned: number; // distinct cards with event_type='learned'
  forgotten: number;    // distinct cards with event_type='forgotten'
}

export interface StudyTimeStats {
  totalMinutes: number;
  byMode: Record<StudyMode, number>; // minutes per mode
}
