/**
 * Component tests for ToastContainer.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastContainer } from '../components/common/Toast';
import type { ToastMessage } from '../components/common/Toast';

const makeToast = (overrides?: Partial<ToastMessage>): ToastMessage => ({
  id: 'toast-1',
  type: 'success',
  message: 'Operation successful!',
  ...overrides,
});

describe('ToastContainer', () => {
  it('renders nothing when toasts array is empty', () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a toast message', () => {
    render(
      <ToastContainer toasts={[makeToast()]} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText('Operation successful!')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    const toasts: ToastMessage[] = [
      makeToast({ id: '1', message: 'First' }),
      makeToast({ id: '2', type: 'error', message: 'Second' }),
    ];
    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    render(
      <ToastContainer toasts={[makeToast({ id: 'abc' })]} onDismiss={onDismiss} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith('abc');
  });

  it('renders success toast with role=alert', () => {
    render(
      <ToastContainer toasts={[makeToast({ type: 'success' })]} onDismiss={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders error toast', () => {
    render(
      <ToastContainer toasts={[makeToast({ type: 'error', message: 'Oh no!' })]} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText('Oh no!')).toBeInTheDocument();
  });

  it('renders info toast', () => {
    render(
      <ToastContainer toasts={[makeToast({ type: 'info', message: 'FYI' })]} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText('FYI')).toBeInTheDocument();
  });
});
