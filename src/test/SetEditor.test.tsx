/**
 * Component tests for SetEditor — save flow (handleSave).
 * Tests cover validation, success, and failure paths.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Route mocks ────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  // Default: create mode (no setId)
  useParams: () => ({ setId: undefined }),
}));

// ─── useStudySets mock ───────────────────────────────────────────────────────
const mockCreateStudySet = vi.fn();
const mockUpdateStudySet = vi.fn();
const mockGetStudySet = vi.fn();
vi.mock('../hooks/useStudySets', () => ({
  useStudySets: () => ({
    createStudySet: mockCreateStudySet,
    updateStudySet: mockUpdateStudySet,
    getStudySet: mockGetStudySet,
    loading: false,
    error: null,
  }),
}));

// ─── Auth mock ───────────────────────────────────────────────────────────────
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

// ─── Supabase & Minio mocks ──────────────────────────────────────────────────
vi.mock('../lib/supabase', () => ({
  isMockMode: true,
  supabase: { storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn(), remove: vi.fn() }) } },
}));

vi.mock('../lib/minio', () => ({
  uploadToMinio: vi.fn(),
  deleteFromMinio: vi.fn(),
  isMinioConfigured: false,
}));

// ─── canvas-confetti stub ────────────────────────────────────────────────────
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { SetEditor } from '../pages/SetEditor';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function renderEditor() {
  return render(<SetEditor />);
}

function getTitleInput() {
  return screen.getByPlaceholderText(/Enter a title/i);
}

/** Fill in a card row's term and definition by index (0-based). */
async function fillCard(index: number, term: string, definition: string) {
  const termInputs = screen.getAllByPlaceholderText('Enter term');
  const defInputs = screen.getAllByPlaceholderText('Enter definition');
  await userEvent.clear(termInputs[index]);
  await userEvent.type(termInputs[index], term);
  await userEvent.clear(defInputs[index]);
  await userEvent.type(defInputs[index], definition);
}

function getSaveButton() {
  return screen.getByRole('button', { name: /save set/i });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SetEditor — handleSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('shows error toast when title is empty', async () => {
    renderEditor();
    await act(async () => { fireEvent.click(getSaveButton()); });

    await screen.findByText('Please enter a title for your set.');
    expect(mockCreateStudySet).not.toHaveBeenCalled();
  });

  it('shows error toast when card has empty term or definition', async () => {
    renderEditor();

    // Set title but leave cards empty
    await userEvent.type(getTitleInput(), 'My Set');
    await act(async () => { fireEvent.click(getSaveButton()); });

    await screen.findByText('Please fill in all terms and definitions.');
    expect(mockCreateStudySet).not.toHaveBeenCalled();
  });

  it('shows inline error on bad card row', async () => {
    renderEditor();
    await userEvent.type(getTitleInput(), 'My Set');
    // Fill only first card's term (no definition) — remaining 2 are also empty
    const termInputs = screen.getAllByPlaceholderText('Enter term');
    await userEvent.type(termInputs[0], 'Word');
    await act(async () => { fireEvent.click(getSaveButton()); });

    // All 3 rows have missing data, so at least one inline error appears
    const errors = await screen.findAllByText('Both term and definition are required');
    expect(errors.length).toBeGreaterThan(0);
  });

  // ── Create ─────────────────────────────────────────────────────────────────

  it('calls createStudySet with correct arguments', async () => {
    const createdSet = { id: 'new-set', title: 'My Set', flashcards: [] };
    mockCreateStudySet.mockResolvedValue(createdSet);
    renderEditor();

    await userEvent.type(getTitleInput(), 'My Set');
    await fillCard(0, 'Term A', 'Def A');
    await fillCard(1, 'Term B', 'Def B');
    await fillCard(2, 'Term C', 'Def C');

    await act(async () => {
      fireEvent.click(getSaveButton());
    });

    expect(mockCreateStudySet).toHaveBeenCalledWith(
      'My Set',
      '',
      expect.arrayContaining([
        expect.objectContaining({ term: 'Term A', definition: 'Def A', position: 0 }),
        expect.objectContaining({ term: 'Term B', definition: 'Def B', position: 1 }),
        expect.objectContaining({ term: 'Term C', definition: 'Def C', position: 2 }),
      ]),
      'test-user-id',
      null,
    );
  });

  it('shows success toast after creating a set', async () => {
    mockCreateStudySet.mockResolvedValue({ id: 'set-1', title: 'My Set', flashcards: [] });
    renderEditor();

    await userEvent.type(getTitleInput(), 'My Set');
    await fillCard(0, 'A', 'B');
    await fillCard(1, 'C', 'D');
    await fillCard(2, 'E', 'F');

    await act(async () => {
      fireEvent.click(getSaveButton());
    });

    await screen.findByText('Set created!');
  });

  it('navigates to dashboard after 800ms on success', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCreateStudySet.mockResolvedValue({ id: 'set-1', title: 'My Set', flashcards: [] });
    renderEditor();

    await userEvent.type(getTitleInput(), 'My Set');
    await fillCard(0, 'A', 'B');
    await fillCard(1, 'C', 'D');
    await fillCard(2, 'E', 'F');

    await act(async () => {
      fireEvent.click(getSaveButton());
    });

    expect(mockNavigate).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(800); });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');

    vi.useRealTimers();
  });

  it('shows error toast when createStudySet fails (returns null)', async () => {
    mockCreateStudySet.mockResolvedValue(null);
    renderEditor();

    await userEvent.type(getTitleInput(), 'My Set');
    await fillCard(0, 'A', 'B');
    await fillCard(1, 'C', 'D');
    await fillCard(2, 'E', 'F');

    await act(async () => {
      fireEvent.click(getSaveButton());
    });

    await screen.findByText('Failed to save. Please try again.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when save fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCreateStudySet.mockResolvedValue(null);
    renderEditor();

    await userEvent.type(getTitleInput(), 'My Set');
    await fillCard(0, 'A', 'B');
    await fillCard(1, 'C', 'D');
    await fillCard(2, 'E', 'F');

    await act(async () => {
      fireEvent.click(getSaveButton());
    });

    act(() => { vi.advanceTimersByTime(800); });
    expect(mockNavigate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  // ── Add / Remove cards ─────────────────────────────────────────────────────

  it('starts with 3 card rows', () => {
    renderEditor();
    expect(screen.getAllByPlaceholderText('Enter term')).toHaveLength(3);
  });

  it('adds a card row when + Add Card is clicked', async () => {
    renderEditor();
    const addBtn = screen.getByText(/add card/i);
    await userEvent.click(addBtn);
    expect(screen.getAllByPlaceholderText('Enter term')).toHaveLength(4);
  });
});
