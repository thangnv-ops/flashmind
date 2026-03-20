import { renderHook, act } from '@testing-library/react';
import { useToast } from '../components/common/Toast';

describe('useToast', () => {
  it('starts with no toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('adds a toast with addToast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('Hello!', 'success');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello!');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('assigns a unique id to each toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('First', 'info');
      result.current.addToast('Second', 'error');
    });
    const [t1, t2] = result.current.toasts;
    expect(t1.id).not.toBe(t2.id);
  });

  it('removes a toast by id with dismiss', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('Dismiss me', 'info');
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(id);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('only removes the targeted toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('A', 'info');
      result.current.addToast('B', 'info');
    });
    const idA = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(idA);
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('B');
  });

  it('defaults type to info when no type given', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('No type');
    });
    expect(result.current.toasts[0].type).toBe('info');
  });
});
