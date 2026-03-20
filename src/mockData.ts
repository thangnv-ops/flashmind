import type { StudySet, Folder } from './types';

export const MOCK_SETS: StudySet[] = [
  {
    id: '1',
    title: 'Anatomy: The Skeletal System',
    description: 'Key bones and structures of the human body.',
    cards: [
      { id: '1-1', term: 'Femur', definition: 'The longest bone in the human body, located in the thigh.' },
      { id: '1-2', term: 'Clavicle', definition: 'Commonly known as the collarbone.' },
      { id: '1-3', term: 'Scapula', definition: 'The shoulder blade.' },
    ],
    author: 'Dr. Smith',
    createdAt: Date.now() - 86400000 * 2,
    progress: 45,
  },
  {
    id: '2',
    title: 'French Vocabulary: Food',
    description: 'Common items found in a French kitchen.',
    cards: [
      { id: '2-1', term: 'Le Pain', definition: 'Bread' },
      { id: '2-2', term: 'Le Fromage', definition: 'Cheese' },
      { id: '2-3', term: 'Le Vin', definition: 'Wine' },
    ],
    author: 'Prof. Dubois',
    createdAt: Date.now() - 86400000 * 5,
    progress: 80,
  },
  {
    id: '3',
    title: 'Intro to Astrophysics',
    description: 'Fundamental concepts of the universe.',
    cards: [
      { id: '3-1', term: 'Light Year', definition: 'The distance light travels in one year.' },
      { id: '3-2', term: 'Black Hole', definition: 'A region of spacetime where gravity is so strong that nothing can escape.' },
    ],
    author: 'Neil D. Tyson',
    createdAt: Date.now() - 86400000 * 10,
    progress: 15,
  },
];

export const MOCK_FOLDERS: Folder[] = [
  { id: 'f1', name: 'Science', setIds: ['1', '3'] },
  { id: 'f2', name: 'Languages', setIds: ['2'] },
];
