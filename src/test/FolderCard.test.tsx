/**
 * Component tests for FolderCard.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderCard } from '../components/folders/FolderCard';
import type { FolderWithCount } from '../hooks/useFolders';

const mockFolder: FolderWithCount = {
  id: 'f1',
  user_id: 'u1',
  name: 'Science',
  created_at: new Date().toISOString(),
  setCount: 3,
};

describe('FolderCard', () => {
  it('displays folder name', () => {
    render(
      <FolderCard
        folder={mockFolder}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('Science')).toBeInTheDocument();
  });

  it('displays set count', () => {
    render(
      <FolderCard
        folder={mockFolder}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('3 sets')).toBeInTheDocument();
  });

  it('calls onOpen when the folder button is clicked', async () => {
    const onOpen = vi.fn();
    render(
      <FolderCard
        folder={mockFolder}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onOpen={onOpen}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /open folder/i }));
    expect(onOpen).toHaveBeenCalledWith('f1');
  });

  it('opens context menu on 3-dot button click', async () => {
    render(
      <FolderCard
        folder={mockFolder}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /folder options/i }));
    expect(screen.getByText('Rename')).toBeVisible();
    expect(screen.getByText('Delete')).toBeVisible();
  });

  it('calls onDelete with folder id when Delete is clicked', async () => {
    const onDelete = vi.fn();
    render(
      <FolderCard
        folder={mockFolder}
        onRename={vi.fn()}
        onDelete={onDelete}
        onOpen={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /folder options/i }));
    await userEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('f1');
  });

  it('shows rename input when Rename is clicked', async () => {
    render(
      <FolderCard
        folder={mockFolder}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /folder options/i }));
    await userEvent.click(screen.getByText('Rename'));
    expect(screen.getByDisplayValue('Science')).toBeInTheDocument();
  });

  it('calls onRename with new name on Enter', async () => {
    const onRename = vi.fn();
    render(
      <FolderCard
        folder={mockFolder}
        onRename={onRename}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /folder options/i }));
    await userEvent.click(screen.getByText('Rename'));
    const input = screen.getByDisplayValue('Science');
    await userEvent.clear(input);
    await userEvent.type(input, 'Biology{Enter}');
    await waitFor(() => expect(onRename).toHaveBeenCalledWith('f1', 'Biology'));
  });
});
