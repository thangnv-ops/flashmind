import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  Play, 
  Pause, 
  Settings,
  Maximize2,
  Keyboard
} from 'lucide-react';
import { FlipCard } from '../components/flashcards/FlipCard';
import { MOCK_SETS } from '../mockData';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';

export const FlashcardView: React.FC<{ setId: string; onBack: () => void }> = ({ setId, onBack }) => {
  const set = MOCK_SETS.find(s => s.id === setId) || MOCK_SETS[0];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [cards, setCards] = useState(set.cards);

  const nextCard = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Finished set
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2563eb', '#10b981', '#f59e0b']
        });
        setCurrentIndex(0);
      }
    }, 150);
  }, [currentIndex, cards.length]);

  const prevCard = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }, 150);
  }, [currentIndex]);

  const toggleShuffle = () => {
    if (isShuffled) {
      setCards(set.cards);
    } else {
      setCards([...cards].sort(() => Math.random() - 0.5));
    }
    setIsShuffled(!isShuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="font-bold text-slate-800">{set.title}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flashcards Mode</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-12">
        <div className="w-full max-w-2xl flex flex-col items-center gap-8">
          <FlipCard 
            term={cards[currentIndex].term}
            definition={cards[currentIndex].definition}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped(!isFlipped)}
          />

          <div className="flex items-center justify-between w-full px-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleShuffle}
                className={cn(
                  "p-3 rounded-full transition-all",
                  isShuffled ? "bg-primary/10 text-primary" : "text-slate-400 hover:bg-slate-100"
                )}
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className={cn(
                  "p-3 rounded-full transition-all",
                  isAutoPlaying ? "bg-primary/10 text-primary" : "text-slate-400 hover:bg-slate-100"
                )}
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
                {currentIndex + 1} / {cards.length}
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
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>
    </div>
  );
};
