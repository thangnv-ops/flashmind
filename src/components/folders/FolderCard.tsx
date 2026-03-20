import React, { useState, useRef, useEffect } from 'react';
import { Folder, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { FolderWithCount } from '../../hooks/useFolders';

interface FolderCardProps {
  folder: FolderWithCount;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({ folder, onRename, onDelete, onOpen }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const commitRename = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== folder.name) {
      onRename(folder.id, trimmed);
    } else {
      setNameInput(folder.name);
    }
    setRenaming(false);
  };

  return (
    <div className="bg-white border rounded-xl p-4 hover:border-primary/40 transition-all group flex items-center gap-4">
      <button
        onClick={() => onOpen(folder.id)}
        className="flex items-center gap-4 flex-1 min-w-0"
        aria-label={`Open folder ${folder.name}`}
      >
        <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
          <Folder className="w-5 h-5 text-amber-500" />
        </div>
        <div className="min-w-0 text-left">
          {renaming ? (
            <input
              ref={inputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setNameInput(folder.name);
                  setRenaming(false);
                }
              }}
              onClick={e => e.stopPropagation()}
              className="font-bold text-sm text-slate-800 border-b border-primary outline-none w-full bg-transparent"
            />
          ) : (
            <h4 className="font-bold text-sm text-slate-800 truncate">{folder.name}</h4>
          )}
          <p className="text-xs text-slate-400">{folder.setCount} sets</p>
        </div>
      </button>

      {/* 3-dot menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={e => {
            e.stopPropagation();
            setMenuOpen(v => !v);
          }}
          className="p-1.5 text-slate-300 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Folder options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-8 z-50 bg-white border rounded-xl shadow-xl py-1 min-w-[140px]">
            <button
              onClick={e => {
                e.stopPropagation();
                setMenuOpen(false);
                setRenaming(true);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Pencil className="w-4 h-4 text-slate-400" />
              Rename
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete(folder.id);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
