import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, MoreHorizontal, User, Play, LayoutGrid, Pencil, Trash2, BookOpen, PenLine, ClipboardList, Clock } from 'lucide-react';
import type { StudySet } from '../../types';
import { relativeTime } from '../../utils/time';

interface StudySetCardProps {
  set: StudySet;
  onClick: (id: string) => void;
  onPlayMatch: (id: string) => void;
  onLearn?: (id: string) => void;
  onWrite?: (id: string) => void;
  onTest?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const StudySetCard: React.FC<StudySetCardProps> = ({ set, onClick, onPlayMatch, onLearn, onWrite, onTest, onEdit, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    };
    if (modeMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modeMenuOpen]);

  return (
    <div 
      className="bg-white border rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group relative flex flex-col h-full"
    >
      <div onClick={() => onClick(set.id)} className="flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-display font-bold text-lg text-slate-800 group-hover:text-primary transition-colors line-clamp-1">
              {set.title}
            </h3>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
              {set.flashcards?.length ?? 0} Cards
            </p>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); setConfirmDelete(false); }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-20 bg-white border rounded-xl shadow-lg py-1 w-40 text-sm">
                {!confirmDelete ? (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit?.(set.id); }}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-xs text-slate-600 mb-3">Delete this set?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); setMenuOpen(false); setConfirmDelete(false); onDelete?.(set.id); }}
                        className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
                        className="flex-1 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
            <User className="w-3 h-3 text-slate-500" />
          </div>
          <span className="text-xs font-medium text-slate-600">You</span>
          <span className="text-slate-200">·</span>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            {relativeTime(set.last_accessed)}
          </div>
        </div>

        <div className="space-y-1.5 mb-6">
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tight">
            <span>Progress</span>
            <span>{set.progressPercent ?? 0}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${set.progressPercent ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-4 border-t">
        <button
          onClick={(e) => { e.stopPropagation(); onClick(set.id); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-primary/10 text-slate-600 hover:text-primary rounded-lg text-xs font-bold transition-all"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Cards
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onLearn?.(set.id); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-primary/10 text-slate-600 hover:text-primary rounded-lg text-xs font-bold transition-all"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Learn
        </button>
        <div className="relative shrink-0" ref={modeMenuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setModeMenuOpen(v => !v); }}
            className="flex items-center justify-center p-2 bg-slate-50 hover:bg-primary/10 text-slate-500 hover:text-primary rounded-lg transition-all"
            title="More study modes"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {modeMenuOpen && (
            <div className="absolute bottom-10 right-0 z-20 bg-white border rounded-xl shadow-lg py-1 w-36 text-sm">
              <button
                onClick={(e) => { e.stopPropagation(); setModeMenuOpen(false); onWrite?.(set.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" />
                Write
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setModeMenuOpen(false); onTest?.(set.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Test
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setModeMenuOpen(false); onPlayMatch(set.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Match
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

