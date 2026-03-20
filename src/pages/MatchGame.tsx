import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ArrowLeft, 
  Timer, 
  Trophy, 
  RotateCcw,
  Play
} from 'lucide-react';
import { MOCK_SETS } from '../mockData';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface GameCard {
  id: string;
  content: string;
  type: 'term' | 'definition';
  pairId: string;
  status: 'idle' | 'selected' | 'correct' | 'wrong';
}

export const MatchGame: React.FC<{ setId: string; onBack: () => void }> = ({ setId, onBack }) => {
  const set = MOCK_SETS.find(s => s.id === setId) || MOCK_SETS[0];
  const [cards, setCards] = useState<GameCard[]>([]);
  const [selected, setSelected] = useState<GameCard | null>(null);
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const timerRef = useRef<any>(null);

  const initGame = useCallback(() => {
    const gameCards: GameCard[] = [];
    set.cards.forEach(card => {
      gameCards.push({
        id: `term-${card.id}`,
        content: card.term,
        type: 'term',
        pairId: card.id,
        status: 'idle'
      });
      gameCards.push({
        id: `def-${card.id}`,
        content: card.definition,
        type: 'definition',
        pairId: card.id,
        status: 'idle'
      });
    });

    setCards(gameCards.sort(() => Math.random() - 0.5));
    setTime(0);
    setIsActive(false);
    setIsFinished(false);
    setSelected(null);
  }, [set]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (isActive && !isFinished) {
      timerRef.current = setInterval(() => {
        setTime(prev => prev + 10);
      }, 10);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, isFinished]);

  const handleCardClick = (card: GameCard) => {
    if (card.status === 'correct' || card.status === 'wrong' || isFinished) return;
    if (!isActive) setIsActive(true);

    if (!selected) {
      setSelected(card);
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: 'selected' } : c));
      return;
    }

    if (selected.id === card.id) {
      setSelected(null);
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: 'idle' } : c));
      return;
    }

    // Check match
    if (selected.pairId === card.pairId && selected.type !== card.type) {
      // Correct match
      setCards(prev => prev.map(c => 
        c.id === card.id || c.id === selected.id ? { ...c, status: 'correct' } : c
      ));
      setSelected(null);
      
      // Check if all matched
      const remaining = cards.filter(c => c.status === 'idle' || c.status === 'selected').length - 2;
      if (remaining === 0) {
        setIsFinished(true);
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 }
        });
      }
    } else {
      // Wrong match
      setCards(prev => prev.map(c => 
        c.id === card.id || c.id === selected.id ? { ...c, status: 'wrong' } : c
      ));
      setSelected(null);
      
      setTimeout(() => {
        setCards(prev => prev.map(c => 
          c.status === 'wrong' ? { ...c, status: 'idle' } : c
        ));
      }, 500);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${milliseconds.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col text-white">
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-bold">{set.title}</h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Match Game</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
            <Timer className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold text-xl tabular-nums w-20 text-center">
              {formatTime(time)}
            </span>
          </div>
          
          <button 
            onClick={initGame}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 flex items-center justify-center">
        {!isActive && !isFinished && (
          <div className="text-center space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto text-primary">
              <Play className="w-10 h-10 fill-current" />
            </div>
            <h1 className="text-4xl font-bold">Ready to Match?</h1>
            <p className="text-white/60">Match all terms with their definitions as fast as you can. Click any card to start the timer!</p>
            <button 
              onClick={() => setIsActive(true)}
              className="px-8 py-3 bg-primary hover:bg-primary-dark rounded-xl font-bold text-lg transition-all shadow-lg shadow-primary/20"
            >
              Start Game
            </button>
          </div>
        )}

        {isActive && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-6xl">
            <AnimatePresence>
              {cards.map((card) => (
                card.status !== 'correct' && (
                  <motion.button
                    key={card.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1,
                      x: card.status === 'wrong' ? [0, -5, 5, -5, 5, 0] : 0
                    }}
                    exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.3 } }}
                    onClick={() => handleCardClick(card)}
                    className={cn(
                      "aspect-[4/3] p-4 rounded-2xl border-2 flex items-center justify-center text-center transition-all duration-200",
                      card.status === 'idle' && "bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10",
                      card.status === 'selected' && "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/20",
                      card.status === 'wrong' && "bg-red-500/20 border-red-500 text-red-500",
                    )}
                  >
                    <span className="text-sm md:text-base font-medium leading-tight">
                      {card.content}
                    </span>
                  </motion.button>
                )
              ))}
            </AnimatePresence>
          </div>
        )}

        {isFinished && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 bg-white/5 p-12 rounded-3xl border border-white/10 backdrop-blur-xl"
          >
            <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto text-yellow-500">
              <Trophy className="w-12 h-12" />
            </div>
            <div>
              <h2 className="text-5xl font-bold mb-2">Great Job!</h2>
              <p className="text-white/40 text-lg">You cleared the board in</p>
              <p className="text-6xl font-bold text-primary font-mono mt-4">
                {formatTime(time)}
              </p>
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={initGame}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all"
              >
                Play Again
              </button>
              <button 
                onClick={onBack}
                className="px-8 py-3 bg-primary hover:bg-primary-dark rounded-xl font-bold transition-all"
              >
                Back to Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};
