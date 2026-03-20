import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Timer,
  Trophy,
  RotateCcw,
  Play,
  Loader2,
  Zap,
} from 'lucide-react';
import { useStudySets } from '../hooks/useStudySets';
import { useMatchRecords } from '../hooks/useMatchRecords';
import { useUpdateLastAccessed } from '../hooks/useUpdateLastAccessed';
import type { StudySet } from '../types';
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

const ROUND_OPTIONS = [6, 8, 10] as const;
type RoundOption = typeof ROUND_OPTIONS[number];

function selectGameCards(all: { id: string; term: string; definition: string }[], count: number) {
  if (all.length <= count) return all;
  return [...all].sort(() => Math.random() - 0.5).slice(0, count);
}

function fireSideConfetti() {
  const end = Date.now() + 3000;
  const frame = () => {
    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, zIndex: 9999 });
    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, zIndex: 9999 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export const MatchGame: React.FC = () => {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const { getStudySet } = useStudySets();
  const { getPersonalBest, updatePersonalBest } = useMatchRecords();
  useUpdateLastAccessed(setId);

  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [loadingSet, setLoadingSet] = useState(true);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [selected, setSelected] = useState<GameCard | null>(null);
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [finishedTime, setFinishedTime] = useState(0);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [cardsPerRound, setCardsPerRound] = useState<RoundOption>(8);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!setId) return;
    setLoadingSet(true);
    getStudySet(setId).then(set => {
      setStudySet(set);
      setLoadingSet(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  // Load personal best once set is known
  useEffect(() => {
    if (!setId) return;
    getPersonalBest(setId).then(best => setPersonalBest(best));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  const initGame = useCallback(() => {
    if (!studySet) return;
    const chosen = selectGameCards(studySet.flashcards ?? [], cardsPerRound);
    const gameCards: GameCard[] = [];
    chosen.forEach(card => {
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
    setMistakes(0);
    setFinishedTime(0);
    setIsNewRecord(false);
  }, [studySet, cardsPerRound]);

  useEffect(() => {
    if (studySet) initGame();
  }, [initGame, studySet]);

  // Re-init when cardsPerRound changes on the ready screen
  useEffect(() => {
    if (studySet && !isActive && !isFinished) initGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsPerRound]);

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
        const finalTime = time;
        setIsFinished(true);
        setFinishedTime(finalTime);
        // Check personal best optimistically, fire confetti
        if (setId) {
          updatePersonalBest(setId, finalTime).then(isNew => {
            setIsNewRecord(isNew);
            if (isNew) {
              setPreviousBest(personalBest);
              setPersonalBest(finalTime);
              fireSideConfetti();
            } else {
              confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
            }
          });
        } else {
          confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        }
      }
    } else {
      // Wrong match
      setMistakes(prev => prev + 1);
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

  if (loadingSet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!studySet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <p className="text-white/60 font-medium">Study set not found.</p>
        <button onClick={() => navigate('/dashboard')} className="text-primary font-bold hover:underline">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col text-white">
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-bold">{studySet.title}</h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Match Game</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Personal best */}
          <div className="flex items-center gap-1.5 text-sm text-white/40">
            <Trophy className="w-4 h-4 text-yellow-400/70" />
            <span className="font-mono">{personalBest !== null ? formatTime(personalBest) : '--'}</span>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
            <Timer className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold text-xl tabular-nums w-20 text-center">
              {formatTime(time)}
            </span>
          </div>

          <button
            onClick={initGame}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Restart"
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

            {/* Round size selector — only show when set has more than 6 cards */}
            {(studySet?.flashcards?.length ?? 0) > 6 && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Cards per round</p>
                <div className="flex gap-2">
                  {ROUND_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setCardsPerRound(n)}
                      disabled={(studySet?.flashcards?.length ?? 0) < n}
                      className={cn(
                        'w-12 h-10 rounded-lg font-bold text-sm transition-all',
                        cardsPerRound === n
                          ? 'bg-primary text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20',
                        (studySet?.flashcards?.length ?? 0) < n && 'opacity-30 cursor-not-allowed'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setIsActive(true)}
              className="px-8 py-3 bg-primary hover:bg-primary-dark rounded-xl font-bold text-lg transition-all shadow-lg shadow-primary/20"
            >
              Start Game
            </button>
          </div>
        )}

        {isActive && !isFinished && (
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
            className="text-center space-y-6 bg-white/5 p-12 rounded-3xl border border-white/10 backdrop-blur-xl max-w-md w-full"
          >
            {isNewRecord ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-full border border-yellow-400/30">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span className="font-bold text-yellow-300 text-sm">New Personal Best!</span>
                </div>
              </div>
            ) : (
              <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto text-yellow-500">
                <Trophy className="w-12 h-12" />
              </div>
            )}

            <div>
              <h2 className="text-3xl font-bold mb-1">{isNewRecord ? '🎉 Amazing!' : 'Great Job!'}</h2>
              <p className="text-white/40 text-sm">You cleared the board in</p>
              <p className="text-6xl font-bold text-primary font-mono mt-3">
                {formatTime(finishedTime)}
              </p>
            </div>

            {/* Personal best comparison */}
            {!isNewRecord && personalBest !== null && (
              <p className="text-white/40 text-sm">
                Best: {formatTime(personalBest)}&ensp;·&ensp;
                <span className="text-red-400">+{formatTime(finishedTime - personalBest)} slower</span>
              </p>
            )}
            {isNewRecord && previousBest !== null && (
              <p className="text-white/40 text-sm">
                Previous best: {formatTime(previousBest)}&ensp;
                <span className="text-green-400">({formatTime(previousBest - finishedTime)} faster!)</span>
              </p>
            )}

            {/* Mistakes */}
            <div className="flex items-center justify-center gap-3 text-sm">
              <div className={cn(
                'px-3 py-1.5 rounded-full font-bold',
                mistakes === 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/10 text-red-400'
              )}>
                {mistakes === 0 ? '✓ No mistakes!' : `${mistakes} mistake${mistakes === 1 ? '' : 's'}`}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={initGame}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-primary hover:bg-primary-dark rounded-xl font-bold transition-all"
              >
                Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};
