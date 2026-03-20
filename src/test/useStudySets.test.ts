/**
 * Unit tests for useStudySets hook — mock mode (no Supabase needed).
 */
import { renderHook, act } from '@testing-library/react';

// Force mock mode before importing the hook
vi.mock('../lib/supabase', () => ({
  isMockMode: true,
  supabase: {},
}));

import { useStudySets } from '../hooks/useStudySets';

describe('useStudySets — mock mode', () => {
  it('getStudySets returns MOCK_SETS', async () => {
    const { result } = renderHook(() => useStudySets());
    let sets: Awaited<ReturnType<typeof result.current.getStudySets>>;
    await act(async () => {
      sets = await result.current.getStudySets();
    });
    expect(sets!.length).toBeGreaterThan(0);
    expect(sets![0]).toHaveProperty('title');
    expect(sets![0]).toHaveProperty('flashcards');
  });

  it('getStudySet returns the matching mock set', async () => {
    const { result } = renderHook(() => useStudySets());
    let set: Awaited<ReturnType<typeof result.current.getStudySet>>;
    await act(async () => {
      set = await result.current.getStudySet('1');
    });
    expect(set).not.toBeNull();
    expect(set!.id).toBe('1');
  });

  it('getStudySet returns null for unknown id', async () => {
    const { result } = renderHook(() => useStudySets());
    let set: Awaited<ReturnType<typeof result.current.getStudySet>>;
    await act(async () => {
      set = await result.current.getStudySet('nonexistent-id-xyz');
    });
    expect(set).toBeNull();
  });

  it('createStudySet returns a new mock set', async () => {
    const { result } = renderHook(() => useStudySets());
    let created: Awaited<ReturnType<typeof result.current.createStudySet>>;
    await act(async () => {
      created = await result.current.createStudySet(
        'Test Set',
        'Test description',
        [{ id: 'new-1', term: 'Hello', definition: 'World', position: 0 }],
        'mock-user-id',
        null,
      );
    });
    expect(created).not.toBeNull();
    expect(created!.title).toBe('Test Set');
    expect(created!.flashcards).toHaveLength(1);
    expect(created!.flashcards![0].term).toBe('Hello');
  });

  it('deleteStudySet returns true in mock mode', async () => {
    const { result } = renderHook(() => useStudySets());
    let deleted: boolean;
    await act(async () => {
      deleted = await result.current.deleteStudySet('any-id');
    });
    expect(deleted!).toBe(true);
  });

  it('loading starts as false', () => {
    const { result } = renderHook(() => useStudySets());
    expect(result.current.loading).toBe(false);
  });

  it('error starts as null', () => {
    const { result } = renderHook(() => useStudySets());
    expect(result.current.error).toBeNull();
  });
});
