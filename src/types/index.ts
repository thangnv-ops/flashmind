export interface Flashcard {
  id: string;
  term: string;
  definition: string;
  imageUrl?: string;
}

export interface StudySet {
  id: string;
  title: string;
  description?: string;
  cards: Flashcard[];
  author: string;
  createdAt: number;
  progress: number; // 0 to 100
}

export interface Folder {
  id: string;
  name: string;
  setIds: string[];
}
