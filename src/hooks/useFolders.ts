import { useState, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase';
import type { Folder } from '../types';
import { MOCK_FOLDERS } from '../mockData';

export interface FolderWithCount extends Folder {
  setCount: number;
}

export function useFolders() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFolders = useCallback(async (): Promise<FolderWithCount[]> => {
    if (isMockMode) {
      return MOCK_FOLDERS.map(f => ({ ...f, setCount: 0 }));
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('folders')
        .select(`
          *,
          study_sets(count)
        `)
        .order('created_at', { ascending: true });

      if (err) throw err;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        created_at: row.created_at,
        setCount: row.study_sets?.[0]?.count ?? 0,
      })) as FolderWithCount[];
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(
    async (name: string, userId: string): Promise<Folder | null> => {
      if (isMockMode) {
        return {
          id: Math.random().toString(36).substr(2, 9),
          user_id: userId,
          name,
          created_at: new Date().toISOString(),
        };
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('folders')
          .insert({ user_id: userId, name })
          .select()
          .single();

        if (err) throw err;
        return data as Folder;
      } catch (e: any) {
        setError(e.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const renameFolder = useCallback(
    async (id: string, newName: string): Promise<boolean> => {
      if (isMockMode) return true;
      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase
          .from('folders')
          .update({ name: newName })
          .eq('id', id);

        if (err) throw err;
        return true;
      } catch (e: any) {
        setError(e.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deleteFolder = useCallback(async (id: string): Promise<boolean> => {
    if (isMockMode) return true;
    setLoading(true);
    setError(null);
    try {
      // study_sets.folder_id will be SET NULL via DB FK constraint
      const { error: err } = await supabase.from('folders').delete().eq('id', id);
      if (err) throw err;
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const assignSetToFolder = useCallback(
    async (setId: string, folderId: string): Promise<boolean> => {
      if (isMockMode) return true;
      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase
          .from('study_sets')
          .update({ folder_id: folderId })
          .eq('id', setId);

        if (err) throw err;
        return true;
      } catch (e: any) {
        setError(e.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const removeSetFromFolder = useCallback(async (setId: string): Promise<boolean> => {
    if (isMockMode) return true;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('study_sets')
        .update({ folder_id: null })
        .eq('id', setId);

      if (err) throw err;
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    assignSetToFolder,
    removeSetFromFolder,
  };
}
