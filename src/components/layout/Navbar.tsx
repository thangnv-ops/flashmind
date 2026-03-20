import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, LogOut, ChevronDown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStudySets } from '../../hooks/useStudySets';
import type { StudySet } from '../../types';
import { cn } from '../../lib/utils';

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 5;

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { getStudySets } = useStudySets();

  const [query, setQuery] = useState('');
  const [allSets, setAllSets] = useState<StudySet[]>([]);
  const [searchResults, setSearchResults] = useState<StudySet[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load sets for local search once on mount
  useEffect(() => {
    getStudySets().then(sets => setAllSets(sets));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const q = query.toLowerCase();
      const results = allSets
        .filter(s =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q)
        )
        .slice(0, MAX_RESULTS);
      setSearchResults(results);
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, allSets]);

  // Click-outside handlers
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleResultClick = (id: string) => {
    setQuery('');
    setSearchOpen(false);
    navigate(`/sets/${id}`);
  };

  const initials = user?.email?.charAt(0).toUpperCase() ?? '?';
  const showDropdown = searchOpen && query.trim().length > 0;

  return (
    <nav className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-8 flex-1">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-primary">FlashMind</span>
        </button>

        {/* Live search */}
        <div className="relative max-w-md w-full hidden md:block" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search your sets, folders..."
            className="w-full pl-10 pr-8 py-2 bg-slate-100 border border-transparent focus:bg-white focus:border-primary/20 rounded-full text-sm transition-all outline-none"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Search dropdown */}
          {showDropdown && (
            <div className="absolute top-10 left-0 right-0 bg-white border rounded-xl shadow-xl overflow-hidden z-50">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-400">No sets found for "{query}"</div>
              ) : (
                searchResults.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleResultClick(s.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b last:border-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Search className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{s.title}</p>
                      <p className="text-xs text-slate-400">{s.flashcards?.length ?? 0} cards</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/editor')}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create</span>
        </button>

        <div className="w-px h-6 bg-slate-200" />

        {/* User avatar + dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            className={cn(
              'flex items-center gap-1.5 p-1 rounded-full transition-all',
              userMenuOpen ? 'ring-2 ring-primary/40' : 'hover:ring-2 hover:ring-slate-200'
            )}
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
              {initials}
            </div>
            <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', userMenuOpen && 'rotate-180')} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-11 bg-white border rounded-xl shadow-xl py-1 w-56 z-50">
              <div className="px-4 py-3 border-b">
                <p className="text-xs text-slate-400">Signed in as</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};


