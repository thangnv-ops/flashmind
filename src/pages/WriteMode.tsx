import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Trophy,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { useStudySets } from '../hooks/useStudySets';
import { useUpdateLastAccessed } from '../hooks/useUpdateLastAccessed';
import { checkAnswer } from '../utils/levenshtein';
import type { Flashcard } from '../types';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';

type AnswerStatus = 'idle' | 'correct' | 'almost' | 'wrong' | 'overridden';

export const WriteMode: React.FC = () => {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const { getStudySet } = useStudySets();
  useUpdateLastAccessed(setId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [setTitle, setSetTitle] = useState('');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loadingSet, setLoadingSet] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState<AnswerStatus>('idle');
  const [results, setResults] = useState<boolean[]>([]);    // one per card: correct?
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!setId) return;
    setLoadingSet(true);
    getStudySet(setId).then(set => {
      if (set) {
        setSetTitle(set.title);
        setCards((set.flashcards ?? []).sort(() => Math.random() - 0.5));
      }
      setLoadingSet(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  // Auto-focus input when moving to next card
  useEffect(() => {
    if (status === 'idle') inputRef.current?.focus();
  }, [status, currentIdx]);

  useEffect(() => {
    if (isFinished) {
      const correctCount = results.filter(Boolean).length;
      if (correctCount === cards.length) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#10b981', '#f59e0b'] });
      }
    }
  }, [isFinished, results, cards.length]);

  const currentCard = cards[currentIdx];

  const handleCheck = () => {
    if (status !== 'idle' || !userInput.trim()) return;
    const result = checkAnswer(userInput, currentCard.term);
    setStatus(result);
    setResults(prev => [...prev, result === 'correct' || result === 'almost']);
  };

  const handleNext = () => {
    if (currentIdx < cards.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setUserInput('');
      setStatus('idle');
    } else {
      setIsFinished(true);
    }
  };

  const handleOverride = () => {
    setResults(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = true;
      return updated;
    });
    setStatus('overridden');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (status === 'idle') {
        handleCheck();
      } else {
        handleNext();
      }
    }
  };

  const handleStudyAgain = () => {
    setCards(prev => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIdx(0);
    setUserInput('');
    setStatus('idle');
    setResults([]);
    setIsFinished(false);
  };

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
        <p className="text-slate-500 font-medium">No cards in this set.</p>
        <button onClick={() => navigate(-1)} className="text-primary font-bold hover:underline">Go back</button>
      </div>
    );
  }

  if (isFinished) {
    const correctCount = results.filter(Boolean).length;
    const percent = Math.round((correctCount / cards.length) * 100);
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {percent >= 80 ? 'Well done!' : 'Keep going!'}
          </h2>
          <p className="text-5xl font-bold text-primary mb-1">{correctCount} / {cards.length}</p>
          <p className="text-sm text-slate-400 mb-8">{percent}% correct</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleStudyAgain}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Study Again
            </button>
            <button
              onClick={() => navigate(`/flashcards/${setId}`)}
              className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
            >
              Back to Set
            </button>
          </div>
        </div>
      </div>
    );
  }

  const borderColor = {
    idle: 'border-slate-200',
    correct: 'border-green-400',
    almost: 'border-amber-400',
    wrong: 'border-red-400',
    overridden: 'border-green-400',
  }[status];

  const feedback: { text: string; color: string } | null = {
    correct: { text: 'Correct! ✓', color: 'text-green-600' },
    almost: { text: `Almost! Correct answer: "${currentCard.term}"`, color: 'text-amber-600' },
    wrong: { text: `Incorrect. Answer: "${currentCard.term}"`, color: 'text-red-600' },
    overridden: { text: 'Marked as correct.', color: 'text-green-600' },
    idle: null,
  }[status];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="h-1.5 w-full bg-slate-200">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(currentIdx / cards.length) * 100}%` }}
        />
      </div>

      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="font-bold text-slate-800">{setTitle}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Write Mode</p>
          </div>
        </div>
        <span className="text-sm font-bold text-slate-500 tabular-nums">
          {currentIdx + 1} / {cards.length}
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl flex flex-col gap-6">
          {/* Definition prompt */}
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center border-2 border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4">Definition</span>
            <p className="text-2xl font-medium text-slate-700 leading-relaxed">{currentCard.definition}</p>
          </div>

          {/* Input + feedback */}
          <div className="flex flex-col gap-3">
            <div className={cn('w-full rounded-xl border-2 bg-white transition-colors flex items-center', borderColor)}>
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={status !== 'idle'}
                placeholder="Type the term…"
                aria-label="Enter term answer"
                className="flex-1 px-4 py-3.5 outline-none text-slate-800 font-medium bg-transparent rounded-xl placeholder-slate-300"
              />
              {status === 'correct' && <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 shrink-0" />}
              {status === 'almost' && <AlertCircle className="w-5 h-5 text-amber-500 mr-3 shrink-0" />}
              {status === 'wrong' && <XCircle className="w-5 h-5 text-red-500 mr-3 shrink-0" />}
              {status === 'overridden' && <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 shrink-0" />}
            </div>

            {feedback && (
              <p className={cn('text-sm font-semibold', feedback.color)}>{feedback.text}</p>
            )}

            <div className="flex gap-3">
              {status === 'idle' ? (
                <button
                  onClick={handleCheck}
                  disabled={!userInput.trim()}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Check Answer
                </button>
              ) : (
                <>
                  {status === 'wrong' && (
                    <button
                      onClick={handleOverride}
                      className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
                    >
                      Override: I got it
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                  >
                    {currentIdx < cards.length - 1 ? (
                      <>Next <ArrowRight className="w-4 h-4" /></>
                    ) : (
                      'See Results'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
