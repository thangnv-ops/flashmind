import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  BookOpen,
  Brain,
  PenLine,
  ClipboardList,
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trophy,
} from 'lucide-react';
import { useStudySets } from '../hooks/useStudySets';
import { useMatchRecords } from '../hooks/useMatchRecords';
import { relativeTime } from '../utils/time';
import { VocabStatusPanel } from '../components/progress/VocabStatusPanel';
import { DailyProgressChart } from '../components/progress/DailyProgressChart';
import type { StudySet } from '../types';

const MODES = [
  {
    key: 'flashcards',
    label: 'Flashcards',
    desc: 'Browse cards one by one',
    icon: BookOpen,
    color: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
    path: (id: string) => `/flashcards/${id}`,
  },
  {
    key: 'learn',
    label: 'Learn',
    desc: 'Multiple choice questions',
    icon: Brain,
    color: 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100',
    path: (id: string) => `/learn/${id}`,
  },
  {
    key: 'write',
    label: 'Write',
    desc: 'Type the answer',
    icon: PenLine,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100',
    path: (id: string) => `/write/${id}`,
  },
  {
    key: 'test',
    label: 'Test',
    desc: 'Mixed quiz',
    icon: ClipboardList,
    color: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100',
    path: (id: string) => `/test/${id}`,
  },
  {
    key: 'match',
    label: 'Match',
    desc: 'Beat the clock!',
    icon: Zap,
    color: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100',
    path: (id: string) => `/match/${id}`,
  },
] as const;

const PREVIEW_LIMIT = 5;

export const SetOverview: React.FC = () => {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const { getStudySet } = useStudySets();
  const { getPersonalBest } = useMatchRecords();

  const [set, setSet] = useState<StudySet | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchBest, setMatchBest] = useState<number | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);

  useEffect(() => {
    if (!setId) return;
    setLoading(true);
    Promise.all([
      getStudySet(setId),
      getPersonalBest(setId),
    ]).then(([s, best]) => {
      setSet(s);
      setMatchBest(best);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!set) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <p className="text-slate-500">Study set not found.</p>
        <button onClick={() => navigate('/dashboard')} className="text-primary font-bold hover:underline">Back to Dashboard</button>
      </div>
    );
  }

  const cards = set.flashcards ?? [];
  const cardCount = cards.length;
  const masteredCount = Math.round(((set.progressPercent ?? 0) / 100) * cardCount);
  const visibleCards = showAllCards ? cards : cards.slice(0, PREVIEW_LIMIT);

  const formatMatchTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const cents = Math.floor((ms % 1000) / 10);
    return `${s}.${cents.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{set.title}</h1>
              {set.description && (
                <p className="text-slate-500 text-sm mt-1">{set.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(`/editor/${set.id}`)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white border rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 mb-8 text-sm">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-semibold text-slate-700">{cardCount} cards</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="font-semibold text-slate-700">{masteredCount} / {cardCount} mastered</span>
          </div>
          {matchBest !== null && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-slate-700">Best: {formatMatchTime(matchBest)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-slate-500">
            Last studied {relativeTime(set.last_accessed)}
          </div>
        </div>

        {/* Progress bar */}
        {cardCount > 0 && (
          <div className="mb-8">
            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              <span>Progress</span>
              <span>{set.progressPercent ?? 0}%</span>
            </div>
            <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${set.progressPercent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Study mode selector */}
        <div className="mb-10">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Study Mode</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MODES.map(mode => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.key}
                  onClick={() => navigate(mode.path(set.id))}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${mode.color}`}
                >
                  <div className="shrink-0 mt-0.5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{mode.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{mode.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card preview list */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
            Vocabulary Status
          </h2>
          <VocabStatusPanel setId={set.id} />
        </div>

        {/* Daily progress chart for this set */}
        <div className="mb-8">
          <DailyProgressChart setId={set.id} />
        </div>

        {/* Card preview list */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
            Cards ({cardCount})
          </h2>
          {cards.length === 0 ? (
            <div className="bg-white border rounded-xl p-8 text-center text-slate-400 text-sm">
              No cards yet. <button onClick={() => navigate(`/editor/${set.id}`)} className="text-primary font-bold hover:underline">Add some.</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2">
                <div className="col-span-5">Term</div>
                <div className="col-span-7">Definition</div>
              </div>
              {visibleCards.map(card => (
                <div
                  key={card.id}
                  className="grid grid-cols-12 bg-white border rounded-xl px-4 py-3 text-sm hover:border-primary/30 transition-colors"
                >
                  <div className="col-span-5 font-semibold text-slate-800 pr-4 truncate">{card.term}</div>
                  <div className="col-span-7 text-slate-500 truncate">{card.definition}</div>
                </div>
              ))}
              {cards.length > PREVIEW_LIMIT && (
                <button
                  onClick={() => setShowAllCards(v => !v)}
                  className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:bg-primary/5 rounded-xl transition-colors"
                >
                  {showAllCards ? (
                    <><ChevronUp className="w-4 h-4" /> Show less</>
                  ) : (
                    <><ChevronDown className="w-4 h-4" /> View all {cards.length} cards</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
