import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
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
import { generateMCQuestions } from '../utils/questionGenerator';
import type { MCQuestion } from '../utils/questionGenerator';
import type { Flashcard } from '../types';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';

export const LearnMode: React.FC = () => {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const { getStudySet } = useStudySets();
  useUpdateLastAccessed(setId);
  const { recordResult, pauseSession, finishSession, resultsCount, isSaving } = useStudySession(setId, 'learn');

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

  useEffect(() => {
    if (!setId) return;
    setLoadingSet(true);
    getStudySet(setId).then(set => {
      if (set) {
        setSetTitle(set.title);
        const cards = set.flashcards ?? [];
        setAllCards(cards);
        setQuestions(generateMCQuestions(cards));
      }
      setLoadingSet(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  const handleChoiceSelect = useCallback((choice: string) => {
    if (isAnswered) return;
    const current = questions[currentIdx];
    const isCorrect = choice === current.correctAnswer;
    const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;

    setSelectedChoice(choice);
    setIsAnswered(true);
    recordResult(current.cardId, isCorrect);

    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    } else {
      setWrongCardIds(prev => new Set([...prev, current.cardId]));
    }

    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1);
        setSelectedChoice(null);
        setIsAnswered(false);
      } else {
        setIsFinished(true);
        finishSession(questions.length);
        if (newCorrectCount === questions.length) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#10b981', '#f59e0b'] });
        }
      }
    }, 1200);
  }, [isAnswered, questions, currentIdx, correctCount]);

  const handleStudyAgain = () => {
    setQuestions(generateMCQuestions([...allCards]));
    setCurrentIdx(0);
    setSelectedChoice(null);
    setIsAnswered(false);
    setCorrectCount(0);
    setWrongCardIds(new Set());
    setIsFinished(false);
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

  if (loadingSet) {
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

  if (isFinished) {
    const percent = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {percent >= 80 ? 'Great job!' : 'Keep practicing!'}
          </h2>
          <p className="text-5xl font-bold text-primary mb-1">{correctCount} / {questions.length}</p>
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

  const currentQuestion = questions[currentIdx];

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
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="font-bold text-slate-800">{setTitle}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Learn Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {resultsCount > 0 && (
            <button
              onClick={async () => {
                await pauseSession(questions.length);
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
            {currentIdx + 1} / {questions.length}
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
        </div>
      </main>
    </div>
  );
};
