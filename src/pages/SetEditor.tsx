import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Save,
  ArrowLeft,
  LayoutGrid,
  Upload,
  X,
  Loader2,
} from 'lucide-react';
import { BulkImportModal } from '../components/editor/BulkImportModal';
import { ToastContainer, useToast } from '../components/common/Toast';
import { useStudySets } from '../hooks/useStudySets';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isMockMode } from '../lib/supabase';
import { cn } from '../lib/utils';

interface CardRow {
  id: string;
  term: string;
  definition: string;
  image_url?: string | null;
  error?: string;
  uploading?: boolean;
}

const MAX_IMAGE_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, GIF, and WebP images are allowed.';
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return `Image must be smaller than ${MAX_IMAGE_SIZE_MB}MB.`;
  }
  return null;
}

export const SetEditor: React.FC = () => {
  const navigate = useNavigate();
  const { setId: editSetId } = useParams<{ setId: string }>();
  const { user } = useAuth();
  const { createStudySet, updateStudySet, getStudySet, loading: saving } = useStudySets();
  const { toasts, addToast, dismiss } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<CardRow[]>([
    { id: 'new-1', term: '', definition: '' },
    { id: 'new-2', term: '', definition: '' },
    { id: 'new-3', term: '', definition: '' },
  ]);
  const [deletedCardIds, setDeletedCardIds] = useState<string[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [loadingSet, setLoadingSet] = useState(false);

  // Load set for edit mode
  useEffect(() => {
    if (!editSetId) return;
    setLoadingSet(true);
    getStudySet(editSetId).then(set => {
      if (!set) {
        addToast('Study set not found.', 'error');
        navigate('/dashboard');
        return;
      }
      setTitle(set.title);
      setDescription(set.description ?? '');
      if (set.flashcards && set.flashcards.length > 0) {
        setRows(
          set.flashcards.map(c => ({
            id: c.id,
            term: c.term,
            definition: c.definition,
            image_url: c.image_url,
          })),
        );
      }
      setLoadingSet(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSetId]);

  useEffect(() => {
    const handleScroll = () => setIsSticky(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const addRow = () => {
    setRows(prev => [
      ...prev,
      { id: `new-${Math.random().toString(36).substr(2, 9)}`, term: '', definition: '' },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 2) return;
    setRows(prev => prev.filter(r => r.id !== id));
    if (!id.startsWith('new-')) {
      setDeletedCardIds(prev => [...prev, id]);
    }
  };

  const updateRow = (id: string, field: 'term' | 'definition', value: string) => {
    setRows(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value, error: undefined } : r)),
    );
  };

  // Image upload
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleImageClick = (rowId: string) => {
    fileInputRefs.current[rowId]?.click();
  };

  const handleImageChange = async (rowId: string, file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      addToast(validationError, 'error');
      return;
    }
    setRows(prev => prev.map(r => (r.id === rowId ? { ...r, uploading: true } : r)));
    if (isMockMode) {
      const localUrl = URL.createObjectURL(file);
      setRows(prev =>
        prev.map(r => (r.id === rowId ? { ...r, image_url: localUrl, uploading: false } : r)),
      );
      return;
    }
    try {
      const userId = user?.id ?? 'unknown';
      const storagePath = `${userId}/${editSetId ?? 'new'}/${rowId}-${Date.now()}`;
      const { error } = await supabase.storage
        .from('flashcard-images')
        .upload(storagePath, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from('flashcard-images')
        .getPublicUrl(storagePath);
      setRows(prev =>
        prev.map(r =>
          r.id === rowId ? { ...r, image_url: urlData.publicUrl, uploading: false } : r,
        ),
      );
    } catch (e: any) {
      addToast(`Image upload failed: ${e.message}`, 'error');
      setRows(prev => prev.map(r => (r.id === rowId ? { ...r, uploading: false } : r)));
    }
  };

  const removeImage = async (rowId: string, imageUrl: string) => {
    setRows(prev => prev.map(r => (r.id === rowId ? { ...r, image_url: null } : r)));
    if (isMockMode || !imageUrl.includes('supabase')) return;
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/flashcard-images/');
      if (pathParts.length > 1) {
        await supabase.storage.from('flashcard-images').remove([pathParts[1]]);
      }
    } catch {
      // best-effort cleanup
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      addToast('Please enter a title for your set.', 'error');
      return;
    }
    let hasError = false;
    const validatedRows = rows.map(r => {
      if (!r.term.trim() || !r.definition.trim()) {
        hasError = true;
        return { ...r, error: 'Both term and definition are required' };
      }
      return r;
    });
    if (hasError) {
      setRows(validatedRows);
      addToast('Please fill in all terms and definitions.', 'error');
      return;
    }
    const cardInputs = rows.map((r, i) => ({
      id: r.id,
      term: r.term.trim(),
      definition: r.definition.trim(),
      image_url: r.image_url,
      position: i,
    }));
    let success = false;
    if (editSetId) {
      const result = await updateStudySet(editSetId, title.trim(), description.trim(), cardInputs, deletedCardIds);
      success = result !== null || isMockMode;
    } else {
      const result = await createStudySet(title.trim(), description.trim(), cardInputs, user?.id ?? '', null);
      success = result !== null;
    }
    if (success) {
      addToast(editSetId ? 'Set updated!' : 'Set created!', 'success');
      setTimeout(() => navigate('/dashboard'), 800);
    } else {
      addToast('Failed to save. Please try again.', 'error');
    }
  };

  const handleImport = (data: { term: string; definition: string }[]) => {
    const newRows = data.map(d => ({
      id: `new-${Math.random().toString(36).substr(2, 9)}`,
      term: d.term,
      definition: d.definition,
    }));
    const filteredRows = rows.filter(r => r.term || r.definition);
    setRows([...filteredRows, ...newRows]);
  };

  if (loadingSet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Set'}
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
                    disabled={rows.length <= 2}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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

                  {/* Image upload */}
                  <div className="mt-1 relative">
                    <input
                      ref={el => { fileInputRefs.current[row.id] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleImageChange(row.id, file);
                        e.target.value = '';
                      }}
                    />
                    {row.image_url ? (
                      <div className="relative w-12 h-12 group/img">
                        <img
                          src={row.image_url}
                          alt="card visual"
                          className="w-12 h-12 rounded-xl object-cover border"
                        />
                        <button
                          onClick={() => removeImage(row.id, row.image_url!)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                          aria-label="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleImageClick(row.id)}
                        disabled={row.uploading}
                        className="w-12 h-12 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                        aria-label="Upload image"
                      >
                        {row.uploading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                          <ImageIcon className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
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
        existingTerms={rows.map(r => r.term)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};
