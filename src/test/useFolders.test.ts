/**
 * Unit tests for useFolders hook — mock mode.
 */
import { renderHook, act } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  isMockMode: true,
  supabase: {},
}));

import { useFolders } from '../hooks/useFolders';

describe('useFolders — mock mode', () => {
  it('getFolders returns MOCK_FOLDERS with setCount', async () => {
    const { result } = renderHook(() => useFolders());
    let folders: Awaited<ReturnType<typeof result.current.getFolders>>;
    await act(async () => {
      folders = await result.current.getFolders();
    });
    expect(folders!.length).toBeGreaterThan(0);
    expect(folders![0]).toHaveProperty('name');
    expect(folders![0]).toHaveProperty('setCount');
    expect(typeof folders![0].setCount).toBe('number');
  });

  it('createFolder returns a folder with the given name', async () => {
    const { result } = renderHook(() => useFolders());
    let folder: Awaited<ReturnType<typeof result.current.createFolder>>;
    await act(async () => {
      folder = await result.current.createFolder('My New Folder', 'user-123');
    });
    expect(folder).not.toBeNull();
    expect(folder!.name).toBe('My New Folder');
    expect(folder!.user_id).toBe('user-123');
  });

  it('createFolder assigns an id and created_at', async () => {
    const { result } = renderHook(() => useFolders());
    let folder: Awaited<ReturnType<typeof result.current.createFolder>>;
    await act(async () => {
      folder = await result.current.createFolder('Folder with meta', 'user-abc');
    });
    expect(folder!.id).toBeTruthy();
    expect(folder!.created_at).toBeTruthy();
  });

  it('renameFolder returns true in mock mode', async () => {
    const { result } = renderHook(() => useFolders());
    let ok: boolean;
    await act(async () => {
      ok = await result.current.renameFolder('f1', 'Renamed');
    });
    expect(ok!).toBe(true);
  });

  it('deleteFolder returns true in mock mode', async () => {
    const { result } = renderHook(() => useFolders());
    let ok: boolean;
    await act(async () => {
      ok = await result.current.deleteFolder('f1');
    });
    expect(ok!).toBe(true);
  });

  it('assignSetToFolder returns true in mock mode', async () => {
    const { result } = renderHook(() => useFolders());
    let ok: boolean;
    await act(async () => {
      ok = await result.current.assignSetToFolder('set-1', 'folder-1');
    });
    expect(ok!).toBe(true);
  });

  it('removeSetFromFolder returns true in mock mode', async () => {
    const { result } = renderHook(() => useFolders());
    let ok: boolean;
    await act(async () => {
      ok = await result.current.removeSetFromFolder('set-1');
    });
    expect(ok!).toBe(true);
  });
});
