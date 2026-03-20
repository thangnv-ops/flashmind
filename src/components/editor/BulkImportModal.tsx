import React, { useState } from 'react';
import { X, Clipboard, Check } from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { term: string; definition: string }[]) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<{ term: string; definition: string }[]>([]);

  if (!isOpen) return null;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    
    // Simple parsing: term and definition separated by tab or comma or semicolon
    const lines = val.split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
      const parts = line.split(/[\t,;]/);
      return {
        term: parts[0]?.trim() || '',
        definition: parts.slice(1).join(',').trim() || ''
      };
    }).filter(p => p.term || p.definition);
    
    setPreview(parsed);
  };

  const handleImport = () => {
    onImport(preview);
    onClose();
    setText('');
    setPreview([]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl">Bulk Import</h2>
              <p className="text-xs text-slate-500">Paste your terms and definitions below</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Paste Data</label>
            <textarea
              value={text}
              onChange={handleTextChange}
              placeholder="Term 1, Definition 1&#10;Term 2, Definition 2"
              className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm"
            />
            <p className="text-[10px] text-slate-400">Separate term and definition with a comma, tab, or semicolon.</p>
          </div>

          {preview.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                Preview ({preview.length} cards)
              </h3>
              <div className="border rounded-xl divide-y overflow-hidden bg-slate-50/50">
                {preview.slice(0, 5).map((p, i) => (
                  <div key={i} className="p-3 flex gap-4 text-xs">
                    <span className="font-bold text-slate-400 w-4">{i + 1}</span>
                    <div className="flex-1 font-medium text-slate-700">{p.term}</div>
                    <div className="flex-1 text-slate-500">{p.definition}</div>
                  </div>
                ))}
                {preview.length > 5 && (
                  <div className="p-2 text-center text-[10px] text-slate-400 font-medium">
                    + {preview.length - 5} more cards
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button 
            disabled={preview.length === 0}
            onClick={handleImport}
            className="px-8 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Import Cards
          </button>
        </div>
      </div>
    </div>
  );
};
