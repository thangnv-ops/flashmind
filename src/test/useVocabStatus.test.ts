/**
 * Unit tests for useVocabStatus hook.
 *
 * Covers:
 *  - notStarted : cards with NO progress row
 *  - inProgress : cards with a row AND mastery_level < 8
 *  - mastered   : cards with a row AND mastery_level >= 8
 *  - boundary values (7 vs 8)
 *  - empty card set
 *  - setId = undefined (no fetch)
 *  - loading state transitions
 *  - refetch() picks up new data
 *  - window 'focus' triggers refetch
 */
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Hoisted mutable DB state (accessible inside vi.mock factory) ─────────────
const { mockDB } = vi.hoisted(() => ({
  mockDB: {
    cards: [] as any[],
    progress: [] as any[],
  },
}));

// ─── Supabase mock (DB mode) ──────────────────────────────────────────────────
vi.mock('../lib/supabase', () => ({
  isMockMode: false,
  supabase: {
    from: (table: string) => {
      if (table === 'flashcards') {
        const chain: any = {};
        chain.select = () => chain;
        chain.eq     = () => chain;
        chain.order  = () => Promise.resolve({ data: mockDB.cards });
        return chain;
      }
      // 'progress' table
      const chain: any = {};
      chain.select = () => chain;
      chain.eq     = () => chain;
      chain.in     = () => Promise.resolve({ data: mockDB.progress });
      return chain;
    },
  },
}));

// ── Auth mock ──────────────────────────────────────────────────────────────────
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

import { useVocabStatus } from '../hooks/useVocabStatus';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeCard = (id: string) => ({
  id,
  set_id: 'set-1',
  term: `Term ${id}`,
  definition: `Def ${id}`,
  is_starred: false,
  position: 0,
  image_url: null,
});

const makeProgress = (cardId: string, masteryLevel: number) => ({
  card_id: cardId,
  mastery_level: masteryLevel,
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('useVocabStatus — phân loại trạng thái từ vựng', () => {
  beforeEach(() => {
    mockDB.cards = [];
    mockDB.progress = [];
  });

  // ── Chưa học ────────────────────────────────────────────────────────────────
  it('chưa học: cards không có progress row → notStarted', async () => {
    mockDB.cards = [makeCard('c1'), makeCard('c2'), makeCard('c3')];
    mockDB.progress = [];

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.groups.notStarted).toHaveLength(3);
    expect(result.current.groups.inProgress).toHaveLength(0);
    expect(result.current.groups.mastered).toHaveLength(0);
  });

  // ── Đang học ────────────────────────────────────────────────────────────────
  it('đang học: cards có row với mastery_level 1–7 → inProgress', async () => {
    mockDB.cards = [makeCard('c1'), makeCard('c2')];
    mockDB.progress = [makeProgress('c1', 1), makeProgress('c2', 7)];

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.groups.inProgress).toHaveLength(2);
    expect(result.current.groups.mastered).toHaveLength(0);
    expect(result.current.groups.notStarted).toHaveLength(0);
  });

  // ── Đã học ──────────────────────────────────────────────────────────────────
  it('đã học: cards có row với mastery_level >= 8 → mastered', async () => {
    mockDB.cards = [makeCard('c1'), makeCard('c2'), makeCard('c3')];
    mockDB.progress = [
      makeProgress('c1', 8),
      makeProgress('c2', 9),
      makeProgress('c3', 10),
    ];

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.groups.mastered).toHaveLength(3);
    expect(result.current.groups.inProgress).toHaveLength(0);
    expect(result.current.groups.notStarted).toHaveLength(0);
  });

  // ── Boundary ─────────────────────────────────────────────────────────────────
  it('boundary: mastery_level 7 → inProgress (không phải mastered)', async () => {
    mockDB.cards = [makeCard('c1')];
    mockDB.progress = [makeProgress('c1', 7)];

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.groups.inProgress).toHaveLength(1);
    expect(result.current.groups.mastered).toHaveLength(0);
  });

  it('boundary: mastery_level 8 → mastered (không phải inProgress)', async () => {
    mockDB.cards = [makeCard('c1')];
    mockDB.progress = [makeProgress('c1', 8)];

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.groups.mastered).toHaveLength(1);
    expect(result.current.groups.inProgress).toHaveLength(0);
  });

  // ── Mixed ────────────────────────────────────────────────────────────────────
  it('mixed: phân loại đúng cho 3 nhóm cùng lúc', async () => {
    mockDB.cards = [
      makeCard('c1'), makeCard('c2'), makeCard('c3'),
      makeCard('c4'), makeCard('c5'),
    ];
    mockDB.progress = [
      makeProgress('c1', 10),  // mastered
      makeProgress('c2', 8),   // mastered
      makeProgress('c3', 7),   // inProgress
      makeProgress('c4', 1),   // inProgress
      // c5 → no row → notStarted
    ];

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.groups.mastered).toHaveLength(2);
    expect(result.current.groups.inProgress).toHaveLength(2);
    expect(result.current.groups.notStarted).toHaveLength(1);
    expect(result.current.groups.notStarted[0].id).toBe('c5');
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────
  it('set rỗng: tất cả groups trả về []', async () => {
    mockDB.cards = [];
    mockDB.progress = [];

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.groups.mastered).toHaveLength(0);
    expect(result.current.groups.inProgress).toHaveLength(0);
    expect(result.current.groups.notStarted).toHaveLength(0);
  });

  it('setId = undefined: không fetch, groups rỗng', () => {
    const { result } = renderHook(() => useVocabStatus(undefined));

    expect(result.current.groups.mastered).toHaveLength(0);
    expect(result.current.groups.inProgress).toHaveLength(0);
    expect(result.current.groups.notStarted).toHaveLength(0);
  });

  // ── Loading state ─────────────────────────────────────────────────────────────
  it('loading = true khi đang fetch, false sau khi xong', async () => {
    mockDB.cards = [makeCard('c1')];
    mockDB.progress = [];

    const { result } = renderHook(() => useVocabStatus('set-1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  // ── refetch ───────────────────────────────────────────────────────────────────
  it('refetch() cập nhật groups theo data mới', async () => {
    mockDB.cards = [makeCard('c1')];
    mockDB.progress = [makeProgress('c1', 5)]; // đang học

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.groups.inProgress).toHaveLength(1);
    expect(result.current.groups.mastered).toHaveLength(0);

    // Simulate: user studied → card now mastered
    mockDB.progress = [makeProgress('c1', 9)];
    await act(async () => { await result.current.refetch(); });

    expect(result.current.groups.mastered).toHaveLength(1);
    expect(result.current.groups.inProgress).toHaveLength(0);
  });

  // ── visibilitychange (tab switch / bfcache) ──────────────────────────────────
  it('visibilitychange trigger refetch — trạng thái cập nhật khi quay lại trang', async () => {
    mockDB.cards = [makeCard('c1')];
    mockDB.progress = []; // chưa học

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.groups.notStarted).toHaveLength(1);

    // Simulate: user learned the card in Flashcard mode, then came back (tab becomes visible)
    mockDB.progress = [makeProgress('c1', 3)];
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(result.current.groups.inProgress).toHaveLength(1));
    expect(result.current.groups.notStarted).toHaveLength(0);
  });

  // ── Count accuracy ────────────────────────────────────────────────────────────
  it('tổng 3 nhóm luôn bằng tổng số cards', async () => {
    mockDB.cards = Array.from({ length: 10 }, (_, i) => makeCard(`c${i}`));
    mockDB.progress = [
      makeProgress('c0', 10),
      makeProgress('c1', 8),
      makeProgress('c2', 7),
      makeProgress('c3', 4),
      makeProgress('c4', 1),
      // c5–c9 no row
    ];

    const { result } = renderHook(() => useVocabStatus('set-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const { mastered, inProgress, notStarted } = result.current.groups;
    expect(mastered.length + inProgress.length + notStarted.length).toBe(10);
    expect(mastered).toHaveLength(2);
    expect(inProgress).toHaveLength(3);
    expect(notStarted).toHaveLength(5);
  });
});
