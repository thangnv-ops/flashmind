import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudySetCard } from '../components/dashboard/StudySetCard';
import { FolderCard } from '../components/folders/FolderCard';
import { FolderModal } from '../components/folders/FolderModal';
import { ToastContainer, useToast } from '../components/common/Toast';
import { useStudySets } from '../hooks/useStudySets';
import { useFolders } from '../hooks/useFolders';
import { useAuth } from '../contexts/AuthContext';
import type { StudySet } from '../types';
import type { FolderWithCount } from '../hooks/useFolders';
import { Plus, Clock, Filter, FolderPlus, Loader2 } from 'lucide-react';
import { StudySetCardSkeleton } from '../components/ui/Skeleton';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getStudySets, deleteStudySet, loading: setsLoading } = useStudySets();
  const {
    getFolders,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useFolders();
  const { toasts, addToast, dismiss } = useToast();

  const [sets, setSets] = useState<StudySet[]>([]);
  const [folders, setFolders] = useState<FolderWithCount[]>([]);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [fetchedSets, fetchedFolders] = await Promise.all([
      getStudySets(),
      getFolders(),
    ]);
    setSets(fetchedSets);
    setFolders(fetchedFolders);
  }, [getStudySets, getFolders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateFolder = async (name: string) => {
    const folder = await createFolder(name, user?.id ?? '');
    if (folder) {
      setFolders(prev => [...prev, { ...folder, setCount: 0 }]);
      addToast(`Folder "${name}" created!`, 'success');
    } else {
      addToast('Failed to create folder.', 'error');
    }
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    const ok = await renameFolder(id, newName);
    if (ok) {
      setFolders(prev => prev.map(f => (f.id === id ? { ...f, name: newName } : f)));
    } else {
      addToast('Failed to rename folder.', 'error');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    const folder = folders.find(f => f.id === id);
    const ok = await deleteFolder(id);
    if (ok) {
      setFolders(prev => prev.filter(f => f.id !== id));
      addToast(`Folder "${folder?.name ?? ''}" deleted.`, 'info');
    } else {
      addToast('Failed to delete folder.', 'error');
    }
  };

  const handleEditSet = (id: string) => {
    navigate(`/editor/${id}`);
  };

  const handleDeleteSet = async (id: string) => {
    const set = sets.find(s => s.id === id);
    const ok = await deleteStudySet(id);
    if (ok) {
      setSets(prev => prev.filter(s => s.id !== id));
      addToast(`"${set?.title ?? 'Set'}" deleted.`, 'info');
    } else {
      addToast('Failed to delete set.', 'error');
    }
  };

  const isLoading = setsLoading && sets.length === 0;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back!</h1>
          <p className="text-slate-500">Ready to master something new today?</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            onClick={() => navigate('/editor')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Set
          </button>
        </div>
      </header>

      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => <StudySetCardSkeleton key={i} />)
          ) : (
            <>
              {sets.map(set => (
                <StudySetCard
                  key={set.id}
                  set={set}
                  onClick={id => navigate(`/flashcards/${id}`)}
                  onPlayMatch={id => navigate(`/match/${id}`)}
                  onEdit={handleEditSet}
                  onDelete={handleDeleteSet}
                />
              ))}
              <button
                onClick={() => navigate('/editor')}
                className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-primary/40 hover:text-primary transition-all group min-h-[180px]"
              >
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-semibold text-sm">Create new study set</span>
              </button>
            </>
          )}
        </div>
      </section>



      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded-full" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Your Folders</h2>
          </div>
          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5 rounded-lg transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
        </div>

        {setsLoading && folders.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-400 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading folders...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {folders.map(folder => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onRename={handleRenameFolder}
                onDelete={handleDeleteFolder}
                onOpen={id => navigate(`/dashboard?folder=${id}`)}
              />
            ))}
            {folders.length === 0 && (
              <button
                onClick={() => setIsFolderModalOpen(true)}
                className="bg-white border rounded-xl p-4 hover:border-primary/40 transition-all cursor-pointer flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-sm text-slate-800">New Folder</h4>
                  <p className="text-xs text-slate-400">Organize your sets</p>
                </div>
              </button>
            )}
          </div>
        )}
      </section>

      <FolderModal
        isOpen={isFolderModalOpen}
        onConfirm={handleCreateFolder}
        onClose={() => setIsFolderModalOpen(false)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};
