import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shuffle,
  Star,
  Play,
  Pause,
  BookOpen,
  PenLine,
  ClipboardList,
  Maximize2,
  Keyboard,
  Loader2,
} from 'lucide-react';
import { FlipCard } from '../components/flashcards/FlipCard';
import { useStudySets } from '../hooks/useStudySets';
import { useUpdateLastAccessed } from '../hooks/useUpdateLastAccessed';
import type { Flashcard } from '../types';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';

export const FlashcardView: React.FC = () => {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const { getStudySet } = useStudySets();
  useUpdateLastAccessed(setId);

  const [setTitle, setSetTitle] = useState('');
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [loadingSet, setLoadingSet] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [modeSwitcherOpen, setModeSwitcherOpen] = useState(false);
  const modeSwitcherRef = useRef<HTMLDivElement>(null);

  const activeCards = showStarredOnly
    ? cards.filter(c => starredIds.has(c.id))
    : cards;

  useEffect(() => {
    if (!setId) return;
    setLoadingSet(true);
    getStudySet(setId).then(set => {
      if (set) {
        setSetTitle(set.title);
        const fc = set.flashcards ?? [];
        setAllCards(fc);
        setCards(fc);
      }
      setLoadingSet(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  const nextCard = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < activeCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2563eb', '#10b981', '#f59e0b']
        });
        setCurrentIndex(0);
      }
    }, 150);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activeCards.length]);

  const prevCard = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }, 150);
  }, [currentIndex]);

  const toggleStar = (cardId: string) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      return next;
    });
  };

  const toggleShuffle = () => {
    if (isShuffled) {
      setCards(allCards);
    } else {
      setCards([...allCards].sort(() => Math.random() - 0.5));
    }
    setIsShuffled(!isShuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeSwitcherRef.current && !modeSwitcherRef.current.contains(e.target as Node)) {
        setModeSwitcherOpen(false);
      }
    };
    if (modeSwitcherOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modeSwitcherOpen]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.code === 'ArrowRight') {
        nextCard();
      } else if (e.code === 'ArrowLeft') {
        prevCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextCard, prevCard]);

  // Auto-play logic
  useEffect(() => {
    let timer: any;
    if (isAutoPlaying) {
      timer = setInterval(() => {
        if (!isFlipped) {
          setIsFlipped(true);
        } else {
          nextCard();
        }
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [isAutoPlaying, isFlipped, nextCard]);

  if (loadingSet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <p className="text-slate-500 font-medium">No cards found in this set.</p>
        <button onClick={() => navigate(-1)} className="text-primary font-bold hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="font-bold text-slate-800">{setTitle}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flashcards Mode</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mode switcher */}
          <div className="relative" ref={modeSwitcherRef}>
            <button
              onClick={() => setModeSwitcherOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border"
            >
              Switch Mode
              <ChevronDown className="w-4 h-4" />
            </button>
            {modeSwitcherOpen && (
              <div className="absolute right-0 top-10 z-30 bg-white border rounded-xl shadow-lg py-1 w-48 text-sm">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Study Modes</div>
                <button
                  onClick={() => setModeSwitcherOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2 bg-primary/5 text-primary font-semibold"
                >
                  <BookOpen className="w-4 h-4" />
                  Flashcards ✓
                </button>
                <button
                  onClick={() => navigate(`/learn/${setId}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  <ClipboardList className="w-4 h-4" />
                  Learn
                </button>
                <button
                  onClick={() => navigate(`/write/${setId}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  <PenLine className="w-4 h-4" />
                  Write
                </button>
                <button
                  onClick={() => navigate(`/test/${setId}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  <ClipboardList className="w-4 h-4" />
                  Test
                </button>
              </div>
            )}
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-12">
        {activeCards.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Star className="w-10 h-10 text-slate-200" />
            <p className="text-slate-500 font-medium">No starred cards yet.</p>
            <p className="text-sm text-slate-400">Star cards by clicking the ★ on a card first.</p>
            <button
              onClick={() => { setShowStarredOnly(false); setCurrentIndex(0); }}
              className="text-primary text-sm font-bold hover:underline"
            >
              Show all cards
            </button>
          </div>
        ) : (
        <div className="w-full max-w-2xl flex flex-col items-center gap-8">
          <FlipCard
            term={activeCards[currentIndex].term}
            definition={activeCards[currentIndex].definition}
            imageUrl={activeCards[currentIndex].image_url}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped(!isFlipped)}
            isStarred={starredIds.has(activeCards[currentIndex].id)}
            onStar={() => toggleStar(activeCards[currentIndex].id)}
          />

          <div className="flex items-center justify-between w-full px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleShuffle}
                className={cn(
                  'p-3 rounded-full transition-all',
                  isShuffled ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-100'
                )}
                title="Shuffle"
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setShowStarredOnly(v => !v); setCurrentIndex(0); setIsFlipped(false); }}
                className={cn(
                  'p-3 rounded-full transition-all',
                  showStarredOnly ? 'bg-amber-50 text-amber-400' : 'text-slate-400 hover:bg-slate-100'
                )}
                title={showStarredOnly ? `Starred only (${starredIds.size})` : 'Show starred only'}
              >
                <Star className={cn('w-5 h-5', showStarredOnly && 'fill-amber-400')} />
              </button>
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className={cn(
                  'p-3 rounded-full transition-all',
                  isAutoPlaying ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-100'
                )}
                title="Auto-play"
              >
                {isAutoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex items-center gap-6">
              <button 
                onClick={prevCard}
                disabled={currentIndex === 0}
                className="w-12 h-12 flex items-center justify-center bg-white border rounded-full text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="text-sm font-bold text-slate-500 tabular-nums">
                {currentIndex + 1} / {activeCards.length}
              </div>

              <button 
                onClick={nextCard}
                className="w-12 h-12 flex items-center justify-center bg-white border rounded-full text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <div className="w-10" /> {/* Spacer */}
          </div>
        </div>
        )}

        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white border rounded">
            <Keyboard className="w-3 h-3" />
            <span>Space</span>
            <span className="text-slate-200">Flip</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white border rounded">
            <ChevronLeft className="w-3 h-3" />
            <span>Prev</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white border rounded">
            <ChevronRight className="w-3 h-3" />
            <span>Next</span>
          </div>
        </div>
      </main>

      <div className="h-1.5 w-full bg-slate-200">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${activeCards.length ? ((currentIndex + 1) / activeCards.length) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
};
