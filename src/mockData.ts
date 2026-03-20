import type { StudySet, Folder } from './types';

const MOCK_USER_ID = 'mock-user-id';

export const MOCK_SETS: StudySet[] = [
  {
    id: '1',
    user_id: MOCK_USER_ID,
    title: 'Anatomy: The Skeletal System',
    description: 'Key bones and structures of the human body.',
    flashcards: [
      { id: '1-1', set_id: '1', term: 'Femur', definition: 'The longest bone in the human body, located in the thigh.', is_starred: false, position: 0 },
      { id: '1-2', set_id: '1', term: 'Clavicle', definition: 'Commonly known as the collarbone.', is_starred: false, position: 1 },
      { id: '1-3', set_id: '1', term: 'Scapula', definition: 'The shoulder blade.', is_starred: true, position: 2 },
    ],
    last_accessed: new Date(Date.now() - 86400000 * 2).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    progressPercent: 45,
  },
  {
    id: '2',
    user_id: MOCK_USER_ID,
    title: 'French Vocabulary: Food',
    description: 'Common items found in a French kitchen.',
    flashcards: [
      { id: '2-1', set_id: '2', term: 'Le Pain', definition: 'Bread', is_starred: false, position: 0 },
      { id: '2-2', set_id: '2', term: 'Le Fromage', definition: 'Cheese', is_starred: true, position: 1 },
      { id: '2-3', set_id: '2', term: 'Le Vin', definition: 'Wine', is_starred: false, position: 2 },
    ],
    last_accessed: new Date(Date.now() - 86400000 * 5).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    progressPercent: 80,
  },
  {
    id: '3',
    user_id: MOCK_USER_ID,
    title: 'Intro to Astrophysics',
    description: 'Fundamental concepts of the universe.',
    flashcards: [
      { id: '3-1', set_id: '3', term: 'Light Year', definition: 'The distance light travels in one year.', is_starred: false, position: 0 },
      { id: '3-2', set_id: '3', term: 'Black Hole', definition: 'A region of spacetime where gravity is so strong that nothing can escape.', is_starred: false, position: 1 },
    ],
    last_accessed: new Date(Date.now() - 86400000 * 10).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    progressPercent: 15,
  },
];

export const MOCK_FOLDERS: Folder[] = [
  { id: 'f1', user_id: MOCK_USER_ID, name: 'Science', created_at: new Date().toISOString() },
  { id: 'f2', user_id: MOCK_USER_ID, name: 'Languages', created_at: new Date().toISOString() },
];
