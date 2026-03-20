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
