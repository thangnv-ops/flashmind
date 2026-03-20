import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Save, 
  ArrowLeft, 
  LayoutGrid,
  Upload
} from 'lucide-react';
import { BulkImportModal } from '../components/editor/BulkImportModal';
import { cn } from '../lib/utils';

interface CardRow {
  id: string;
  term: string;
  definition: string;
  error?: string;
}

export const SetEditor: React.FC = () => {
  const navigate = useNavigate();
  const { setId: editSetId } = useParams<{ setId: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<CardRow[]>([
    { id: '1', term: '', definition: '' },
    { id: '2', term: '', definition: '' },
    { id: '3', term: '', definition: '' },
  ]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const addRow = () => {
    setRows([...rows, { id: Math.random().toString(36).substr(2, 9), term: '', definition: '' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 2) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: 'term' | 'definition', value: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value, error: undefined } : r));
  };

  const handleSave = () => {
    let hasError = false;
    const newRows = rows.map(r => {
      if (!r.term.trim() || !r.definition.trim()) {
        hasError = true;
        return { ...r, error: 'Both term and definition are required' };
      }
      return r;
    });

    if (!title.trim()) {
      alert('Please enter a title for your set');
      return;
    }

    if (hasError) {
      setRows(newRows);
      return;
    }

    console.log('Saving set:', { title, description, cards: rows, editSetId });
    navigate('/dashboard');
  };

  const handleImport = (data: { term: string; definition: string }[]) => {
    const newRows = data.map(d => ({
      id: Math.random().toString(36).substr(2, 9),
      term: d.term,
      definition: d.definition
    }));
    // Filter out empty initial rows if they exist
    const filteredRows = rows.filter(r => r.term || r.definition);
    setRows([...filteredRows, ...newRows]);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Sticky Header */}
      <header className={cn(
        "bg-white border-b transition-all duration-300 z-40",
        isSticky ? "fixed top-0 left-0 right-0 shadow-md py-3" : "py-6"
      )}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className={cn("transition-opacity", isSticky ? "opacity-100" : "opacity-0 pointer-events-none")}>
              <h2 className="font-bold text-slate-800">{title || 'Untitled Set'}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-all shadow-md flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Set
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-8">
        <div className="bg-white rounded-2xl p-8 border shadow-sm mb-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Title</label>
              <input 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='Enter a title, like "Biology - Chapter 1"'
                className="w-full text-2xl font-bold border-b-2 border-slate-100 focus:border-primary outline-none py-2 transition-colors placeholder:text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description (Optional)</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                className="w-full border-b-2 border-slate-100 focus:border-primary outline-none py-2 transition-colors resize-none h-12 placeholder:text-slate-200"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {rows.map((row, index) => (
            <div key={row.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden group">
              <div className="bg-slate-50 px-6 py-3 border-b flex items-center justify-between">
                <span className="text-sm font-bold text-slate-400">{index + 1}</span>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 text-slate-400 hover:text-primary transition-colors">
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => removeRow(row.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <input 
                    type="text"
                    value={row.term}
                    onChange={(e) => updateRow(row.id, 'term', e.target.value)}
                    placeholder="Enter term"
                    className={cn(
                      "w-full border-b-2 outline-none py-2 transition-colors text-lg font-medium",
                      row.error ? "border-red-200 focus:border-red-500" : "border-slate-100 focus:border-primary"
                    )}
                  />
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Term</label>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <input 
                      type="text"
                      value={row.definition}
                      onChange={(e) => updateRow(row.id, 'definition', e.target.value)}
                      placeholder="Enter definition"
                      className={cn(
                        "w-full border-b-2 outline-none py-2 transition-colors text-lg font-medium",
                        row.error ? "border-red-200 focus:border-red-500" : "border-slate-100 focus:border-primary"
                      )}
                    />
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Definition</label>
                  </div>
                  
                  <button className="w-12 h-12 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 hover:border-primary hover:text-primary transition-all mt-1">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {row.error && (
                <div className="px-6 pb-4 text-xs font-bold text-red-500">
                  {row.error}
                </div>
              )}
            </div>
          ))}

          <button 
            onClick={addRow}
            className="w-full py-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-primary/40 hover:text-primary hover:bg-white transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm uppercase tracking-widest">Add Card</span>
          </button>
        </div>
      </main>

      <BulkImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleImport}
      />
    </div>
  );
};
