/**
 * Component tests for FolderModal.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderModal } from '../components/folders/FolderModal';

describe('FolderModal', () => {
  it('does not render when isOpen=false', () => {
    const { container } = render(
      <FolderModal isOpen={false} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the modal when isOpen=true', () => {
    render(<FolderModal isOpen onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows default title "New Folder"', () => {
    render(<FolderModal isOpen onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('New Folder')).toBeInTheDocument();
  });

  it('shows a custom title when provided', () => {
    render(
      <FolderModal isOpen title="Rename Folder" onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Rename Folder')).toBeInTheDocument();
  });

  it('populates input with initialName', () => {
    render(
      <FolderModal isOpen initialName="Science" onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('Science');
  });

  it('calls onConfirm with the trimmed name on submit', async () => {
    const onConfirm = vi.fn();
    render(<FolderModal isOpen onConfirm={onConfirm} onClose={vi.fn()} />);
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '  Languages  ');
    fireEvent.submit(input.closest('form')!);
    expect(onConfirm).toHaveBeenCalledWith('Languages');
  });

  it('does not call onConfirm when name is empty', () => {
    const onConfirm = vi.fn();
    render(<FolderModal isOpen onConfirm={onConfirm} onClose={vi.fn()} />);
    const form = screen.getByRole('textbox').closest('form')!;
    fireEvent.submit(form);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel button is clicked', async () => {
    const onClose = vi.fn();
    render(<FolderModal isOpen onConfirm={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows "Create" button text for new folder', () => {
    render(<FolderModal isOpen onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('shows "Rename" button text when initialName is provided', () => {
    render(
      <FolderModal isOpen initialName="Old Name" onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
  });
});
