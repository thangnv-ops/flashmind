import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Loader2,
  Send,
  PauseCircle,
} from 'lucide-react';
import { useStudySets } from '../hooks/useStudySets';
import { useStudySession } from '../hooks/useStudySession';
import { useProgressUpdater } from '../hooks/useProgressUpdater';
import { generateTest } from '../utils/questionGenerator';
import { checkAnswer } from '../utils/levenshtein';
import type { TestQuestion } from '../utils/questionGenerator';
import type { Flashcard } from '../types';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { MasteryBadge } from '../components/progress/MasteryBadge';

interface QuestionResponse {
  answered: boolean;
  correct: boolean;
  userAnswer: string;
  // For MC: which choice was selected; for write: the typed text
}

export const MockTest: React.FC = () => {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const { getStudySet } = useStudySets();
  const { recordResult, pauseSession, finishSession, resultsCount, isSaving } = useStudySession(setId, 'test');
  const { submitAnswer } = useProgressUpdater();
  const writeInputRef = useRef<HTMLInputElement>(null);

  const [setTitle, setSetTitle] = useState('');
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loadingSet, setLoadingSet] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [writeInput, setWriteInput] = useState('');
  const [mcSelected, setMcSelected] = useState<string | null>(null);
  const [currentAnswered, setCurrentAnswered] = useState(false);
  const [currentCorrect, setCurrentCorrect] = useState(false);
  const [currentWriteStatus, setCurrentWriteStatus] = useState<'correct' | 'almost' | 'wrong' | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [masteryUpdates, setMasteryUpdates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!setId) return;
    setLoadingSet(true);
    getStudySet(setId).then(set => {
      if (set) {
        setSetTitle(set.title);
        const cards = set.flashcards ?? [];
        setAllCards(cards);
        setQuestions(generateTest(cards));
      }
      setLoadingSet(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  useEffect(() => {
    if (!currentAnswered && questions[currentIdx]?.type === 'write') {
      writeInputRef.current?.focus();
    }
  }, [currentIdx, currentAnswered, questions]);

  useEffect(() => {
    if (isFinished) {
      const score = responses.filter(r => r.correct).length;
      if (score === questions.length) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#10b981', '#f59e0b'] });
      }
    }
  }, [isFinished, responses, questions.length]);

  const currentQuestion = questions[currentIdx];

  const handleMCSelect = (choice: string) => {
    if (currentAnswered) return;
    const isCorrect = choice === currentQuestion.correctAnswer;
    setMcSelected(choice);
    setCurrentAnswered(true);
    setCurrentCorrect(isCorrect);
    setResponses(prev => [...prev, { answered: true, correct: isCorrect, userAnswer: choice }]);
    recordResult(currentQuestion.cardId, isCorrect);
    submitAnswer(currentQuestion.cardId, isCorrect, 'test', setId!).then(r => {
      if (r) setMasteryUpdates(prev => ({ ...prev, [currentQuestion.cardId]: r.newMasteryLevel }));
    });
  };

  const handleWriteCheck = () => {
    if (currentAnswered || !writeInput.trim()) return;
    const result = checkAnswer(writeInput, currentQuestion.correctAnswer);
    const isCorrect = result === 'correct' || result === 'almost';
    setCurrentWriteStatus(result);
    setCurrentAnswered(true);
    setCurrentCorrect(isCorrect);
    setResponses(prev => [...prev, { answered: true, correct: isCorrect, userAnswer: writeInput }]);
    recordResult(currentQuestion.cardId, isCorrect);
    submitAnswer(currentQuestion.cardId, isCorrect, 'test', setId!).then(r => {
      if (r) setMasteryUpdates(prev => ({ ...prev, [currentQuestion.cardId]: r.newMasteryLevel }));
    });
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setMcSelected(null);
      setWriteInput('');
      setCurrentAnswered(false);
      setCurrentCorrect(false);
      setCurrentWriteStatus(null);
    } else {
      setIsFinished(true);
      finishSession(questions.length);
    }
  };

  const handleWriteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!currentAnswered) handleWriteCheck();
      else handleNext();
    }
  };

  const handleRetake = () => {
    setQuestions(generateTest(allCards));
    setCurrentIdx(0);
    setResponses([]);
    setWriteInput('');
    setMcSelected(null);
    setCurrentAnswered(false);
    setCurrentCorrect(false);
    setCurrentWriteStatus(null);
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

  if (isFinished) {
    const score = responses.filter(r => r.correct).length;
    const percent = Math.round((score / questions.length) * 100);
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="font-bold text-slate-800">{setTitle}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test Results</p>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
          {/* Score summary */}
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center mb-6">
            <p className="text-5xl font-bold text-primary mb-1">{score} / {questions.length}</p>
            <p className="text-slate-400 text-sm mb-2">{percent}% correct</p>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-4">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  percent >= 80 ? 'bg-green-400' : percent >= 50 ? 'bg-amber-400' : 'bg-red-400'
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Review table */}
          <div className="bg-white rounded-2xl border overflow-hidden mb-6">
            <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2 border-b bg-slate-50">
              <div className="col-span-1"></div>
              <div className="col-span-3">Term / Prompt</div>
              <div className="col-span-3">Your Answer</div>
              <div className="col-span-3">Correct Answer</div>
              <div className="col-span-2">Mastery</div>
            </div>
            {questions.map((q, i) => {
              const resp = responses[i];
              return (
                <div
                  key={i}
                  className={cn(
                    'grid grid-cols-12 px-4 py-3 text-sm border-b last:border-0',
                    resp?.correct ? 'bg-green-50/50' : 'bg-red-50/50'
                  )}
                >
                  <div className="col-span-1 flex items-center">
                    {resp?.correct
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-red-400" />
                    }
                  </div>
                  <div className="col-span-3 font-medium text-slate-700 pr-2 line-clamp-2">{q.prompt}</div>
                  <div className={cn('col-span-3 pr-2 line-clamp-2', resp?.correct ? 'text-green-700' : 'text-red-600')}>
                    {resp?.userAnswer || '—'}
                  </div>
                  <div className="col-span-3 text-slate-500 line-clamp-2">{q.correctAnswer}</div>
                  <div className="col-span-2 flex items-center">
                    {masteryUpdates[q.cardId] !== undefined && (
                      <MasteryBadge level={masteryUpdates[q.cardId]} size="sm" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRetake}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retake Test
            </button>
            <button
              onClick={() => navigate(`/flashcards/${setId}`)}
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
            >
              Back to Set
            </button>
          </div>
        </main>
      </div>
    );
  }

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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mock Test</p>
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
          {!currentAnswered && currentIdx === questions.length - 1 && (
            <button
              onClick={() => { setIsFinished(true); finishSession(questions.length); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Submit
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl flex flex-col gap-6">
          {/* Question type badge */}
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full',
              currentQuestion.type === 'multiple-choice'
                ? 'bg-blue-50 text-blue-500'
                : 'bg-violet-50 text-violet-500'
            )}>
              {currentQuestion.type === 'multiple-choice' ? 'Multiple Choice' : 'Written Answer'}
            </span>
          </div>

          {/* Prompt card */}
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center border-2 border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4">
              {currentQuestion.type === 'multiple-choice' ? 'Term' : 'Definition'}
            </span>
            <p className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">
              {currentQuestion.prompt}
            </p>
          </div>

          {/* Answer section */}
          {currentQuestion.type === 'multiple-choice' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentQuestion.choices!.map((choice, i) => {
                let style = 'bg-white border-2 border-slate-200 text-slate-700 hover:border-primary/60 hover:bg-primary/5 cursor-pointer';
                if (currentAnswered) {
                  if (choice === currentQuestion.correctAnswer) {
                    style = 'bg-green-50 border-2 border-green-400 text-green-700';
                  } else if (choice === mcSelected && !currentCorrect) {
                    style = 'bg-red-50 border-2 border-red-400 text-red-600';
                  } else {
                    style = 'bg-white border-2 border-slate-100 text-slate-400 cursor-default';
                  }
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleMCSelect(choice)}
                    disabled={currentAnswered}
                    className={cn('w-full p-4 rounded-xl text-left font-medium text-sm transition-all', style)}
                  >
                    <span className="font-bold text-xs mr-2 text-slate-400 uppercase">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {choice}
                    {currentAnswered && choice === currentQuestion.correctAnswer && (
                      <CheckCircle2 className="w-4 h-4 inline-block ml-1.5 text-green-500" />
                    )}
                    {currentAnswered && choice === mcSelected && !currentCorrect && (
                      <XCircle className="w-4 h-4 inline-block ml-1.5 text-red-500" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className={cn(
                'w-full rounded-xl border-2 bg-white transition-colors flex items-center',
                !currentAnswered ? 'border-slate-200'
                  : currentWriteStatus === 'correct' ? 'border-green-400'
                  : currentWriteStatus === 'almost' ? 'border-amber-400'
                  : 'border-red-400'
              )}>
                <input
                  ref={writeInputRef}
                  type="text"
                  value={writeInput}
                  onChange={e => setWriteInput(e.target.value)}
                  onKeyDown={handleWriteKeyDown}
                  disabled={currentAnswered}
                  placeholder="Type the term…"
                  aria-label="Enter term answer"
                  className="flex-1 px-4 py-3.5 outline-none text-slate-800 font-medium bg-transparent rounded-xl placeholder-slate-300"
                />
                {currentAnswered && currentWriteStatus === 'correct' && <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 shrink-0" />}
                {currentAnswered && currentWriteStatus === 'almost' && <AlertCircle className="w-5 h-5 text-amber-500 mr-3 shrink-0" />}
                {currentAnswered && currentWriteStatus === 'wrong' && <XCircle className="w-5 h-5 text-red-500 mr-3 shrink-0" />}
              </div>

              {currentAnswered && currentWriteStatus === 'almost' && (
                <p className="text-sm font-semibold text-amber-600">
                  Almost! Correct: "{currentQuestion.correctAnswer}"
                </p>
              )}
              {currentAnswered && currentWriteStatus === 'wrong' && (
                <p className="text-sm font-semibold text-red-600">
                  Incorrect. Answer: "{currentQuestion.correctAnswer}"
                </p>
              )}

              {!currentAnswered && (
                <button
                  onClick={handleWriteCheck}
                  disabled={!writeInput.trim()}
                  className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Check Answer
                </button>
              )}
            </div>
          )}

          {/* Next button (after answering) */}
          {currentAnswered && (
            <button
              onClick={handleNext}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
            >
              {currentIdx < questions.length - 1 ? (
                <>Next Question <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>See Results <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
