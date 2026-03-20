import React, { useState, useRef } from 'react';
import { X, Clipboard, Check, FileText } from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { term: string; definition: string }[]) => void;
  /** Terms already present in the editor — used for deduplication. */
  existingTerms?: string[];
}

type Tab = 'paste' | 'csv';
type SeparatorOption = 'tab' | 'comma' | 'semicolon' | 'custom';

const SEPARATOR_LABELS: Record<SeparatorOption, string> = {
  tab: 'Tab',
  comma: 'Comma',
  semicolon: 'Semicolon',
  custom: 'Custom',
};

const SEPARATOR_VALUES: Record<Exclude<SeparatorOption, 'custom'>, string> = {
  tab: '\t',
  comma: ',',
  semicolon: ';',
};

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && line.slice(i, i + sep.length) === sep) {
      result.push(current);
      current = '';
      i += sep.length - 1;
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseLines(
  raw: string,
  sep: string,
): { term: string; definition: string }[] {
  return raw
    .split('\n')
    .filter(l => l.trim())
    .map(line => {
      const parts = parseCsvLine(line, sep);
      return {
        term: parts[0]?.trim() ?? '',
        definition: parts.slice(1).join(sep).trim() ?? '',
      };
    })
    .filter(p => p.term || p.definition);
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingTerms = [],
}) => {
  const [tab, setTab] = useState<Tab>('paste');
  const [text, setText] = useState('');
  const [separatorOption, setSeparatorOption] = useState<SeparatorOption>('comma');
  const [customSeparator, setCustomSeparator] = useState('|');
  const [preview, setPreview] = useState<{ term: string; definition: string }[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [csvFileName, setCsvFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const effectiveSeparator =
    separatorOption === 'custom'
      ? customSeparator || ','
      : SEPARATOR_VALUES[separatorOption];

  const computePreview = (raw: string, sep: string) => {
    const parsed = parseLines(raw, sep);
    const existingSet = new Set(existingTerms.map(t => t.toLowerCase().trim()));
    const dedup = parsed.filter(p => !existingSet.has(p.term.toLowerCase().trim()));
    setPreview(dedup);
    setDuplicateCount(parsed.length - dedup.length);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    computePreview(val, effectiveSeparator);
  };

  const handleSeparatorChange = (opt: SeparatorOption) => {
    setSeparatorOption(opt);
    const sep = opt === 'custom' ? customSeparator || ',' : SEPARATOR_VALUES[opt];
    computePreview(text, sep);
  };

  const handleCustomSeparatorChange = (val: string) => {
    setCustomSeparator(val);
    computePreview(text, val || ',');
  };

  const handleCsvFile = (file: File) => {
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const raw = (e.target?.result as string) ?? '';
      setText(raw);
      computePreview(raw, effectiveSeparator);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    onImport(preview);
    onClose();
    setText('');
    setPreview([]);
    setDuplicateCount(0);
    setCsvFileName('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl">Bulk Import</h2>
              <p className="text-xs text-slate-500">Import multiple cards at once</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {(['paste', 'csv'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  tab === t
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'paste' ? 'Paste Text' : 'Upload CSV'}
              </button>
            ))}
          </div>

          {/* Separator selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Separator:</span>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(SEPARATOR_LABELS) as SeparatorOption[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => handleSeparatorChange(opt)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    separatorOption === opt
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary/60'
                  }`}
                >
                  {SEPARATOR_LABELS[opt]}
                </button>
              ))}
            </div>
            {separatorOption === 'custom' && (
              <input
                type="text"
                value={customSeparator}
                onChange={e => handleCustomSeparatorChange(e.target.value)}
                placeholder="|"
                maxLength={5}
                className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono outline-none focus:border-primary"
              />
            )}
          </div>

          {/* Paste tab */}
          {tab === 'paste' && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Paste Data</label>
              <textarea
                value={text}
                onChange={handleTextChange}
                placeholder={`Term 1${effectiveSeparator === '\t' ? '[Tab]' : effectiveSeparator} Definition 1\nTerm 2${effectiveSeparator === '\t' ? '[Tab]' : effectiveSeparator} Definition 2`}
                className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm"
              />
              <p className="text-[10px] text-slate-400">
                Separate term and definition with the selected separator. One card per line.
              </p>
            </div>
          )}

          {/* CSV tab */}
          {tab === 'csv' && (
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">Upload CSV File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvFile(file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-400 hover:border-primary/40 hover:text-primary transition-all"
              >
                <FileText className="w-8 h-8" />
                <span className="font-semibold text-sm">
                  {csvFileName ? csvFileName : 'Click to select a .csv file'}
                </span>
                {!csvFileName && (
                  <span className="text-xs">First column = term, second = definition</span>
                )}
              </button>
            </div>
          )}

          {/* Duplicate notice */}
          {duplicateCount > 0 && (
            <p className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              {duplicateCount} card{duplicateCount > 1 ? 's were' : ' was'} skipped (duplicate{duplicateCount > 1 ? 's' : ''}).
            </p>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700">
                Preview ({preview.length} card{preview.length !== 1 ? 's' : ''})
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

        {/* Footer */}
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
            Import {preview.length > 0 ? `${preview.length} Cards` : 'Cards'}
          </button>
        </div>
      </div>
    </div>
  );
};
