import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Home,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Loader2,
  AlertTriangle,
  PauseCircle,
} from 'lucide-react';
import { useStudySets } from '../hooks/useStudySets';
import { useUpdateLastAccessed } from '../hooks/useUpdateLastAccessed';
import { useStudySession } from '../hooks/useStudySession';
import { useProgressUpdater } from '../hooks/useProgressUpdater';
import { MasteryDots } from '../components/progress/MasteryDots';
import { MasteryBadge } from '../components/progress/MasteryBadge';
import { generateMCQuestions } from '../utils/questionGenerator';
import type { MCQuestion } from '../utils/questionGenerator';
import type { Flashcard } from '../types';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { useLearningQueue } from '../hooks/useLearningQueue';
import { QueueIndicator } from '../components/progress/QueueIndicator';

export const LearnMode: React.FC = () => {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const { getStudySet } = useStudySets();
  useUpdateLastAccessed(setId);
  const { recordResult, pauseSession, finishSession, resultsCount, isSaving } = useStudySession(setId, 'learn');
  const { submitAnswer } = useProgressUpdater();

  const [dailyLimitSetting, setDailyLimitSetting] = useState(10);

  const {
    queue,
    counts,
    correctCardIds: queueCorrectIds,
    sessionTotal,
    loading: queueLoading,
    answerCorrect: queueAnswerCorrect,
    answerWrong: queueAnswerWrong,
    refetch: refetchQueue,
    newCardsToday,
    dailyNewLimit,
  } = useLearningQueue(setId, dailyLimitSetting);

  // Tracks unique card IDs answered correctly this session (ref for sync checks in closure)
  const uniqueCorrectRef = useRef<Set<string>>(new Set());
  // Tracks pending submitAnswer promises so we can await them before navigating away
  const pendingSubmitsRef = useRef<Promise<unknown>[]>([]);

  const [setTitle, setSetTitle] = useState('');
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [questions, setQuestions] = useState<MCQuestion[]>([]);
  const [loadingSet, setLoadingSet] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCardIds, setWrongCardIds] = useState<Set<string>>(new Set());
  const [isFinished, setIsFinished] = useState(false);
  // Track mastery changes during the session
  const [masteryUpdates, setMasteryUpdates] = useState<Record<string, number>>({});
  // Last answer feedback for MasteryDots
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    if (!setId) return;
    setLoadingSet(true);
    getStudySet(setId).then(set => {
      if (set) {
        setSetTitle(set.title);
        setAllCards(set.flashcards ?? []);
        setDailyLimitSetting(set.daily_new_limit ?? 10);
      }
      setLoadingSet(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  // Once both the flashcard pool and the smart queue are ready, generate MCQ for this session.
  // Uses allCards as the distractor pool so choices remain meaningful even with a 10-card queue.
  useEffect(() => {
    if (queueLoading || allCards.length < 4 || queue.length === 0) return;
    if (questions.length > 0) return; // already generated — don't clobber
    const sessionCardIds = new Set(queue.map(c => c.id));
    const sessionQs = generateMCQuestions(allCards).filter(q => sessionCardIds.has(q.cardId));
    setQuestions(sessionQs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueLoading, queue, allCards]);

  const handleChoiceSelect = useCallback((choice: string) => {
    if (isAnswered) return;
    const current = questions[currentIdx];
    if (!current) return;
    const isCorrect = choice === current.correctAnswer;

    setSelectedChoice(choice);
    setIsAnswered(true);
    setLastAnswerCorrect(isCorrect);
    recordResult(current.cardId, isCorrect);

    // Update mastery via engine (fire-and-forget, non-blocking)
    if (setId) {
      const p = submitAnswer(current.cardId, isCorrect, 'learn', setId).then(result => {
        setMasteryUpdates(prev => ({ ...prev, [current.cardId]: result.newMasteryLevel }));
      }).catch(() => {/* ignore DB errors */});
      pendingSubmitsRef.current.push(p);
    }

    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      // Track unique correct cards synchronously via ref (needed for closure check below)
      if (!uniqueCorrectRef.current.has(current.cardId)) {
        uniqueCorrectRef.current = new Set([...uniqueCorrectRef.current, current.cardId]);
      }
      queueAnswerCorrect(current.cardId);
    } else {
      setWrongCardIds(prev => new Set([...prev, current.cardId]));
      queueAnswerWrong(current.cardId);
      // Intensive loop: push a copy of this question to the END of the queue.
      // The user must answer it correctly before the session can end.
      setQuestions(prev => [...prev, { ...prev[currentIdx] }]);
    }

    setTimeout(() => {
      // Session ends only when ALL original cards have been answered correctly at least once.
      const allDone = sessionTotal > 0 && uniqueCorrectRef.current.size >= sessionTotal;
      if (allDone) {
        setIsFinished(true);
        finishSession(sessionTotal);
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#10b981', '#f59e0b'] });
      } else {
        setCurrentIdx(prev => prev + 1);
        setSelectedChoice(null);
        setIsAnswered(false);
        setLastAnswerCorrect(null);
      }
    }, 1200);
  }, [isAnswered, questions, currentIdx, setId, submitAnswer, recordResult, finishSession, sessionTotal, queueAnswerCorrect, queueAnswerWrong]);

  const handleStudyAgain = () => {
    // Reset local session state and re-run the queue algorithm for a fresh smart session
    setQuestions([]);
    setCurrentIdx(0);
    setSelectedChoice(null);
    setIsAnswered(false);
    setCorrectCount(0);
    setWrongCardIds(new Set());
    setMasteryUpdates({});
    setIsFinished(false);
    uniqueCorrectRef.current = new Set();
    refetchQueue();
  };

  const handleStudyMissed = () => {
    const missedCards = allCards.filter(c => wrongCardIds.has(c.id));
    setQuestions(generateMCQuestions(missedCards));
    setCurrentIdx(0);
    setSelectedChoice(null);
    setIsAnswered(false);
    setCorrectCount(0);
    setWrongCardIds(new Set());
    setIsFinished(false);
  };

  if (loadingSet || queueLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (allCards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <p className="text-slate-500 font-medium">No cards in this set.</p>
        <button onClick={() => navigate(-1)} className="text-primary font-bold hover:underline">Go back</button>
      </div>
    );
  }

  // Queue is empty after loading = daily new-card cap reached + no reviews due
  if (!queueLoading && queue.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Bạn đã hoàn thành bài học hôm nay!</h2>
          <p className="text-slate-500 mb-1">
            Đã học <span className="font-bold text-primary">{newCardsToday}</span> từ mới hôm nay
            {newCardsToday >= dailyNewLimit && ` — đã đạt giới hạn ${dailyNewLimit} từ/ngày`}.
          </p>
          <p className="text-slate-400 text-sm mb-8">Không có từ nào cần ôn tập lúc này. Quủ tiết kiệm trí não đang được bảo vệ → hãy thử lại vào buổi tối hoặc ngày mai!</p>
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

  if (allCards.length < 4) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <h2 className="text-lg font-bold text-slate-800">Not enough cards</h2>
        <p className="text-slate-500 text-sm max-w-xs">
          Learn mode needs at least 4 cards to generate answer choices. This set has {allCards.length}.
        </p>
        <div className="flex gap-3">
          <button onClick={() => navigate(`/flashcards/${setId}`)} className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition-colors">
            Flashcard Mode
          </button>
          <button onClick={() => navigate(`/write/${setId}`)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
            Write Mode
          </button>
        </div>
      </div>
    );
  }

  // questions[] is populated asynchronously after the queue resolves.
  // Show a spinner rather than crashing while we wait.
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isFinished) {
    const total = sessionTotal || questions.length;
    const percent = Math.round((correctCount / Math.max(total, 1)) * 100);
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {percent >= 80 ? 'Great job!' : 'Keep practicing!'}
          </h2>
          <p className="text-5xl font-bold text-primary mb-1">{correctCount} / {sessionTotal || questions.length}</p>
          <p className="text-sm text-slate-400 mb-8">{percent}% correct</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleStudyAgain}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Study Again
            </button>
            {wrongCardIds.size > 0 && (
              <button
                onClick={handleStudyMissed}
                className="w-full py-3 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 transition-colors"
              >
                Study Missed ({wrongCardIds.size})
              </button>
            )}
            <button
              onClick={async () => { await Promise.allSettled(pendingSubmitsRef.current); navigate(`/sets/${setId}`); }}
              className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
            >
              Back to Set
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];

  // Safety: if currentIdx somehow goes out of bounds (e.g. between setState batches)
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getChoiceStyle = (choice: string) => {
    if (!isAnswered) return 'bg-white border-2 border-slate-200 text-slate-700 hover:border-primary/60 hover:bg-primary/5 cursor-pointer';
    if (choice === currentQuestion.correctAnswer) return 'bg-green-50 border-2 border-green-400 text-green-700';
    if (choice === selectedChoice && choice !== currentQuestion.correctAnswer) return 'bg-red-50 border-2 border-red-400 text-red-600';
    return 'bg-white border-2 border-slate-100 text-slate-400 cursor-default';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top progress bar */}
      <div className="h-1.5 w-full bg-slate-200">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(currentIdx / questions.length) * 100}%` }}
        />
      </div>

      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={async () => { await Promise.allSettled(pendingSubmitsRef.current); navigate(-1); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button onClick={async () => { await Promise.allSettled(pendingSubmitsRef.current); navigate('/dashboard'); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Trang chủ">
            <Home className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="font-bold text-slate-800">{setTitle}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Learn Mode</p>
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
                await pauseSession(sessionTotal || questions.length);
                navigate(`/sets/${setId}`);
              }}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 border rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
              Lưu & Thoát
            </button>
          )}
          <span className="text-sm font-bold text-slate-500 tabular-nums">
            {Math.min(currentIdx + 1, sessionTotal || questions.length)} / {sessionTotal || questions.length}
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl flex flex-col gap-6">
          {/* Question card */}
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center border-2 border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4">Term</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 leading-tight">
              {currentQuestion.prompt}
            </h2>
          </div>

          {/* Answer choices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentQuestion.choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => handleChoiceSelect(choice)}
                disabled={isAnswered}
                className={cn(
                  'w-full p-4 rounded-xl text-left font-medium text-sm transition-all',
                  getChoiceStyle(choice)
                )}
              >
                <span className="font-bold text-xs mr-2 text-slate-400 uppercase">
                  {String.fromCharCode(65 + i)}.
                </span>
                {choice}
                {isAnswered && choice === currentQuestion.correctAnswer && (
                  <CheckCircle2 className="w-4 h-4 inline-block ml-1.5 text-green-500" />
                )}
                {isAnswered && choice === selectedChoice && choice !== currentQuestion.correctAnswer && (
                  <XCircle className="w-4 h-4 inline-block ml-1.5 text-red-500" />
                )}
              </button>
            ))}
          </div>

          {/* Mastery feedback after answering */}
          {isAnswered && masteryUpdates[currentQuestion.cardId] !== undefined && (
            <div className="flex flex-col items-center gap-1.5">
              <MasteryDots
                level={masteryUpdates[currentQuestion.cardId]}
                animate={lastAnswerCorrect === true}
                penaltyAnimation={lastAnswerCorrect === false}
              />
              <MasteryBadge level={masteryUpdates[currentQuestion.cardId]} size="sm" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
