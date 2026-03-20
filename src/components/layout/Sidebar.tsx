import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Library,
  Folder as FolderIcon,
  ChevronDown,
  ChevronRight,
  Settings,
  HelpCircle,
  Loader2,
  Plus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFolders } from '../../hooks/useFolders';
import { FolderModal } from '../folders/FolderModal';
import { useAuth } from '../../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { getFolders, createFolder } = useFolders();

  const [isFoldersOpen, setIsFoldersOpen] = useState(true);
  const [folders, setFolders] = useState<{ id: string; name: string; setCount: number }[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    setFoldersLoading(true);
    getFolders().then(f => {
      setFolders(f);
      setFoldersLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateFolder = async (name: string) => {
    const folder = await createFolder(name, user?.id ?? '');
    if (folder) setFolders(prev => [...prev, { ...folder, setCount: 0 }]);
    setIsCreateModalOpen(false);
  };

  const navItems = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Library, label: 'Your Library', path: '/dashboard' },
  ];

  // Parse active folder from query string
  const searchParams = new URLSearchParams(location.search);
  const activeFolderId = searchParams.get('folder');

  return (
    <aside className="w-64 border-r bg-white h-[calc(100vh-64px)] sticky top-16 hidden lg:flex flex-col p-4">
      <div className="space-y-1 mb-8">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              location.pathname === item.path && !activeFolderId
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-between px-3 py-2 mb-1">
          <button
            onClick={() => setIsFoldersOpen(!isFoldersOpen)}
            className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            {isFoldersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Folders
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="p-1 text-slate-400 hover:text-primary hover:bg-primary/5 rounded transition-colors"
            title="New folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isFoldersOpen && (
          <div className="mt-1 space-y-1 overflow-y-auto max-h-72">
            {foldersLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : folders.length === 0 ? (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create a folder
              </button>
            ) : (
              folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => navigate(`/dashboard?folder=${folder.id}`)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeFolderId === folder.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <FolderIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate flex-1 text-left">{folder.name}</span>
                  <span className="text-xs text-slate-400">{folder.setCount}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="pt-4 border-t space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <HelpCircle className="w-4 h-4" />
          Help Center
        </button>
      </div>

      <FolderModal
        isOpen={isCreateModalOpen}
        title="New Folder"
        onConfirm={handleCreateFolder}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </aside>
  );
};
