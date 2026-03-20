import React, { useEffect, useRef, useState } from 'react';
import { FolderPlus, X } from 'lucide-react';

interface FolderModalProps {
  isOpen: boolean;
  initialName?: string;
  title?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  initialName = '',
  title = 'New Folder',
  onConfirm,
  onClose,
}) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-50 rounded-full flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="font-bold text-lg text-slate-800">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Folder Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Science, Languages…"
              maxLength={60}
              className="w-full border-b-2 border-slate-100 focus:border-primary outline-none py-2 text-lg font-medium transition-colors placeholder:text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {initialName ? 'Rename' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
