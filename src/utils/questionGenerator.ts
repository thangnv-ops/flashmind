import type { Flashcard } from '../types';

export interface MCQuestion {
  type: 'multiple-choice';
  cardId: string;
  prompt: string;
  correctAnswer: string;
  choices: string[];
}

export interface WriteQuestion {
  type: 'write';
  cardId: string;
  prompt: string;
  correctAnswer: string;
}

export type TestQuestion = MCQuestion | WriteQuestion;

export function generateMCQuestions(cards: Flashcard[]): MCQuestion[] {
  return cards
    .map(card => {
      const distractors = cards
        .filter(c => c.id !== card.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(c => c.definition);

      // Pad with placeholders when there are fewer than 3 other cards
      let idx = 1;
      while (distractors.length < 3) {
        distractors.push(`(option ${idx++})`);
      }

      const choices = [...distractors, card.definition].sort(() => Math.random() - 0.5);

      return {
        type: 'multiple-choice' as const,
        cardId: card.id,
        prompt: card.term,
        correctAnswer: card.definition,
        choices,
      };
    })
    .sort(() => Math.random() - 0.5);
}

export function generateTest(cards: Flashcard[]): TestQuestion[] {
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  const half = Math.ceil(shuffled.length / 2);

  const mcQuestions = generateMCQuestions(shuffled.slice(0, half));

  const writeQuestions: WriteQuestion[] = shuffled.slice(half).map(card => ({
    type: 'write' as const,
    cardId: card.id,
    prompt: card.definition,
    correctAnswer: card.term,
  }));

  return [...mcQuestions, ...writeQuestions].sort(() => Math.random() - 0.5);
}
