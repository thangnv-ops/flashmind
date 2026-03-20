import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trophy,
  RotateCcw,
  Loader2,
  PauseCircle,
} from 'lucide-react';
import { useStudySets } from '../hooks/useStudySets';
import { useUpdateLastAccessed } from '../hooks/useUpdateLastAccessed';
import { useStudySession } from '../hooks/useStudySession';
import { useProgressUpdater } from '../hooks/useProgressUpdater';
import { checkAnswer } from '../utils/levenshtein';
import type { Flashcard } from '../types';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { MasteryDots } from '../components/progress/MasteryDots';
import { MasteryBadge } from '../components/progress/MasteryBadge';
import { useLearningQueue } from '../hooks/useLearningQueue';
import { QueueIndicator } from '../components/progress/QueueIndicator';

type AnswerStatus = 'idle' | 'correct' | 'almost' | 'wrong' | 'overridden';

export const WriteMode: React.FC = () => {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const { getStudySet } = useStudySets();
  useUpdateLastAccessed(setId);
  const { recordResult, pauseSession, finishSession, resultsCount, isSaving } = useStudySession(setId, 'write');
  const { submitAnswer } = useProgressUpdater();
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    queue,
    counts,
    correctCardIds: queueCorrectIds,
    sessionTotal,
    loading: queueLoading,
    answerCorrect: queueAnswerCorrect,
    refetch: refetchQueue,
    newCardsToday,
    dailyNewLimit,
  } = useLearningQueue(setId);

  const [setTitle, setSetTitle] = useState('');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loadingSet, setLoadingSet] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState<AnswerStatus>('idle');
  const [results, setResults] = useState<boolean[]>([]);    // one per card: correct?
  const [isFinished, setIsFinished] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [masteryUpdates, setMasteryUpdates] = useState<Record<string, number>>({});
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear auto-next timer on unmount
  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!setId) return;
    setLoadingSet(true);
    getStudySet(setId).then(set => {
      if (set) setSetTitle(set.title);
      setLoadingSet(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  // Populate session cards from the smart queue once it's ready.
  // Queue provides the 40/40/20 prioritised selection (max 20 new cards/day).
  useEffect(() => {
    if (queueLoading || queue.length === 0) return;
    if (cards.length > 0) return; // already set — don't clobber
    setCards(queue as Flashcard[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueLoading, queue]);

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

  const advanceCard = () => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    // Mark card as correctly answered in the queue (updates QueueIndicator counts)
    if (currentCard) queueAnswerCorrect(currentCard.id);
    setWrongAttempts(0);
    setRevealedIndices(new Set());
    if (currentIdx < cards.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setUserInput('');
      setStatus('idle');
    } else {
      setIsFinished(true);
      finishSession(sessionTotal || cards.length);
    }
  };

  const handleCheck = () => {
    if (status !== 'idle' || !userInput.trim()) return;
    const result = checkAnswer(userInput, currentCard.term);
    const isCorrect = result === 'correct' || result === 'almost';
    setStatus(result);
    if (isCorrect) {
      // Only record on the first attempt
      if (wrongAttempts === 0) {
        setResults(prev => [...prev, true]);
        recordResult(currentCard.id, true);
        submitAnswer(currentCard.id, true, 'write', setId!).then(r => {
          if (r) setMasteryUpdates(prev => ({ ...prev, [currentCard.id]: r.newMasteryLevel }));
        });
      }
      // Auto-advance after 1 second
      autoNextTimerRef.current = setTimeout(advanceCard, 1000);
    } else {
      // Record wrong only on first attempt
      if (wrongAttempts === 0) {
        setResults(prev => [...prev, false]);
        recordResult(currentCard.id, false);
        submitAnswer(currentCard.id, false, 'write', setId!).then(r => {
          if (r) setMasteryUpdates(prev => ({ ...prev, [currentCard.id]: r.newMasteryLevel }));
        });
      }
      const nextWrongCount = wrongAttempts + 1;
      setWrongAttempts(nextWrongCount);
      // Reveal one new random character as hint
      setRevealedIndices(prev => {
        const term = currentCard.term;
        const unrevealed = Array.from({ length: term.length }, (_, i) => i)
          .filter(i => term[i] !== ' ' && !prev.has(i));
        if (unrevealed.length === 0) return prev;
        const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        return new Set([...prev, pick]);
      });
      // Reset to idle after 0.8s so user can try again
      autoNextTimerRef.current = setTimeout(() => {
        setStatus('idle');
        setUserInput('');
      }, 800);
    }
  };

  const handleNext = () => advanceCard();

  const handleOverride = () => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    setResults(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = true;
      return updated;
    });
    setStatus('overridden');
    autoNextTimerRef.current = setTimeout(advanceCard, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && status === 'idle') {
      handleCheck();
    }
  };

  const handleStudyAgain = () => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    setWrongAttempts(0);
    setRevealedIndices(new Set());
    setCards([]);
    setCurrentIdx(0);
    setUserInput('');
    setStatus('idle');
    setResults([]);
    setMasteryUpdates({});
    setIsFinished(false);
    refetchQueue();
  };

  if (loadingSet || queueLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (cards.length === 0) {
    // Queue still populating — wait
    if (queueLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    // Queue loaded but empty = daily cap reached + no reviews due
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Bạn đã hoàn thành bài học hôm nay!</h2>
          <p className="text-slate-500 mb-1">
            Đã học <span className="font-bold text-primary">{newCardsToday}</span> từ mới hôm nay
            {newCardsToday >= dailyNewLimit && ` — đã đạt giới hạn ${dailyNewLimit} từ/ngày`}.
          </p>
          <p className="text-slate-400 text-sm mb-8">Không có từ nào cần ôn tập lúc này. Quỹ tiết kiệm trí não đang được bảo vệ → hãy thử lại vào buổi tối hoặc ngày mai!</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate(`/flashcards/${setId}`)}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors"
            >
              Xem Flashcard
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isFinished) {
    const correctCount = results.filter(Boolean).length;
    const total = sessionTotal || cards.length;
    const percent = Math.round((correctCount / Math.max(total, 1)) * 100);
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {percent >= 80 ? 'Well done!' : 'Keep going!'}
          </h2>
          <p className="text-5xl font-bold text-primary mb-1">{correctCount} / {sessionTotal || cards.length}</p>
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
    wrong: { text: 'Incorrect! Try again.', color: 'text-red-600' },
    overridden: { text: 'Marked as correct.', color: 'text-green-600' },
    idle: null,
  }[status];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="h-1.5 w-full bg-slate-200">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(currentIdx / (sessionTotal || cards.length)) * 100}%` }}
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
        <div className="flex items-center gap-3">
          <QueueIndicator
            counts={counts}
            completed={queueCorrectIds.size}
            total={sessionTotal}
            className="hidden sm:flex"
          />
          {resultsCount > 0 && (
            <button
              onClick={async () => {
                // Cancel any pending auto-advance timer before saving
                if (autoNextTimerRef.current) {
                  clearTimeout(autoNextTimerRef.current);
                  autoNextTimerRef.current = null;
                }
                try {
                  await pauseSession(sessionTotal || cards.length);
                } catch {
                  // save failed but still navigate away
                } finally {
                  navigate(`/sets/${setId}`);
                }
              }}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 border rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
              Lưu & Thoát
            </button>
          )}
          <span className="text-sm font-bold text-slate-500 tabular-nums">
            {currentIdx + 1} / {sessionTotal || cards.length}
          </span>
        </div>
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

            {status !== 'idle' && masteryUpdates[currentCard.id] !== undefined && (
              <div className="flex items-center gap-3 px-1 pt-1">
                <MasteryDots
                  level={masteryUpdates[currentCard.id]}
                  animate={status === 'correct' || status === 'almost' || status === 'overridden'}
                  penaltyAnimation={status === 'wrong'}
                />
                <MasteryBadge level={masteryUpdates[currentCard.id]} size="sm" />
              </div>
            )}

            {wrongAttempts > 0 && status === 'idle' && (
              <div className="flex flex-col gap-1 -mt-1">
                <p className="text-xs text-red-400 font-semibold">
                  ✗ {wrongAttempts} lần sai — thử lại
                </p>
                <div className="flex flex-wrap gap-1 text-sm font-mono">
                  {Array.from(currentCard.term).map((char, i) =>
                    char === ' ' ? (
                      <span key={i} className="w-3" />
                    ) : revealedIndices.has(i) ? (
                      <span key={i} className="text-amber-500 font-bold">{char}</span>
                    ) : (
                      <span key={i} className="text-slate-300">_</span>
                    )
                  )}
                </div>
              </div>
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
              ) : status === 'wrong' ? (
                <button
                  onClick={handleOverride}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
                >
                  Override: I got it
                </button>
              ) : (
                <p className="flex-1 py-3 text-sm text-center text-slate-400">
                  Chuyển tiếp tự động...
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
