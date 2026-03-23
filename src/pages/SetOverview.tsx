import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  BookOpen,
  Brain,
  PenLine,
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { useStudySets } from '../hooks/useStudySets';
import { useMatchRecords } from '../hooks/useMatchRecords';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useVocabStatus } from '../hooks/useVocabStatus';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isMockMode } from '../lib/supabase';
import { relativeTime } from '../utils/time';
import { VocabStatusPanel } from '../components/progress/VocabStatusPanel';
import { DailyProgressChart } from '../components/progress/DailyProgressChart';
import { MasteryBadge } from '../components/progress/MasteryBadge';
import { useLearningQueue } from '../hooks/useLearningQueue';
import { useWriteQueue } from '../hooks/useWriteQueue';
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
  const { user } = useAuth();
  const { dueCards, totalDue } = useReviewQueue(setId);
  const { groups: vocabGroups, loading: vocabLoading } = useVocabStatus(setId);
  const [set, setSet] = useState<StudySet | null>(null);
  const [dailyNewLimit, setDailyNewLimit] = useState(10);

  const {
    sessionTotal: learnTotal,
    counts: queueCounts,
    loading: queueCountLoading,
  } = useLearningQueue(setId, dailyNewLimit);
  const { writeCount, loading: writeCountLoading } = useWriteQueue(setId);
  const [loading, setLoading] = useState(true);
  const [matchBest, setMatchBest] = useState<number | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);
  const [leechMap, setLeechMap] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'deep-study'>('all');

  useEffect(() => {
    if (!setId) return;
    setLoading(true);
    Promise.all([
      getStudySet(setId),
      getPersonalBest(setId),
    ]).then(([s, best]) => {
      setSet(s);
      if (s) setDailyNewLimit(s.daily_new_limit ?? 10);
      setMatchBest(best);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  useEffect(() => {
    if (!setId || !user || isMockMode) return;
    supabase
      .from('progress')
      .select('card_id, mastery_level')
      .eq('set_id', setId)
      .eq('user_id', user.id)
      .eq('is_leech', true)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, number> = {};
          data.forEach(row => { map[row.card_id] = row.mastery_level; });
          setLeechMap(map);
        }
      });
  }, [setId, user]);

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

  // Live progress computed from mastery table (mastered = >= 8)
  const liveMastered = vocabGroups.mastered.length;
  const liveInProgress = vocabGroups.inProgress.length;
  const liveNotStarted = vocabGroups.notStarted.length;
  const liveTotal = liveMastered + liveInProgress + liveNotStarted;
  const liveProgressPct = liveTotal > 0 ? Math.round((liveMastered / liveTotal) * 100) : 0;

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
          <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg min-w-[140px]">
            <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
            {vocabLoading ? (
              <span className="h-4 w-24 bg-slate-200 rounded animate-pulse inline-block" />
            ) : (
              <span className="font-semibold text-slate-700">{liveMastered} / {liveTotal || cardCount} đã thành thạo</span>
            )}
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
              <span>{liveProgressPct}%</span>
            </div>
            <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
              {liveMastered > 0 && liveTotal > 0 && (
                <div
                  className="h-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.round((liveMastered / liveTotal) * 100)}%` }}
                />
              )}
              {liveInProgress > 0 && liveTotal > 0 && (
                <div
                  className="h-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${Math.round((liveInProgress / liveTotal) * 100)}%` }}
                />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Đã học {liveMastered}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Đang học {liveInProgress}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Chưa học {liveNotStarted}</span>
            </div>
          </div>
        )}

        {/* Queue bucket counts */}
        {!queueCountLoading && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Hôm nay cần học</h2>
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-white border rounded-xl">
                <span className="text-2xl font-bold text-slate-800">{queueCounts.urgent + queueCounts.review}</span>
                <span className="text-sm text-slate-500 leading-tight">từ cần<br />ôn tập</span>
              </div>
              <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-white border rounded-xl">
                <span className="text-2xl font-bold text-slate-800">{queueCounts.new}</span>
                <span className="text-sm text-slate-500 leading-tight">từ<br />mới</span>
              </div>
              {!writeCountLoading && (
                <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-white border rounded-xl">
                  <span className="text-2xl font-bold text-slate-800">{writeCount}</span>
                  <span className="text-sm text-slate-500 leading-tight">từ cần<br />viết</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Study mode selector */}
        <div className="mb-10">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Study Mode</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MODES.map(mode => {
              const Icon = mode.icon;
              const learnBadge = !queueCountLoading && learnTotal > 0 && mode.key === 'learn';
              const writeBadge = mode.key === 'write' && (!queueCountLoading || !writeCountLoading) && (learnTotal + writeCount) > 0;
              const badgeCount = mode.key === 'write' ? learnTotal + writeCount : learnTotal;
              return (
                <button
                  key={mode.key}
                  onClick={() => navigate(mode.path(set.id))}
                  className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${mode.color}`}
                >
                  {(learnBadge || writeBadge) && (
                    <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold shadow">
                      {badgeCount}
                    </span>
                  )}
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

        {/* Vocabulary Status */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
            Vocabulary Status
          </h2>
          <VocabStatusPanel setId={set.id} groups={vocabGroups} loading={vocabLoading} />
        </div>

        {/* Daily progress chart for this set */}
        <div className="mb-8">
          <DailyProgressChart setId={set.id} />
        </div>

        {/* Cards section with tabs */}
        <div>
          {/* Tab header */}
          <div className="flex items-center gap-1 mb-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                activeTab === 'all'
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              Cards ({cardCount})
            </button>
            <button
              onClick={() => setActiveTab('deep-study')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                activeTab === 'deep-study'
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Deep Study
              {Object.keys(leechMap).length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'deep-study' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-600'
                }`}>
                  {Object.keys(leechMap).length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'all' ? (
            <>
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
            </>
          ) : (
            <>
              {Object.keys(leechMap).length === 0 ? (
                <div className="bg-white border rounded-xl p-8 text-center text-slate-400 text-sm">
                  Không có thẻ khó nào. Tiếp tục học để phát hiện thẻ cần chú ý.
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-3">
                    ⚠️ Những thẻ này đã bị sai nhiều lần. Thử đổi ví dụ hoặc hình ảnh liên tưởng để ghi nhớ tốt hơn.
                  </p>
                  <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2">
                    <div className="col-span-4">Term</div>
                    <div className="col-span-5">Definition</div>
                    <div className="col-span-3">Mastery</div>
                  </div>
                  {cards.filter(c => leechMap[c.id] !== undefined).map(card => (
                    <div
                      key={card.id}
                      className="grid grid-cols-12 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm"
                    >
                      <div className="col-span-4 font-semibold text-slate-800 pr-4 truncate">{card.term}</div>
                      <div className="col-span-5 text-slate-500 truncate pr-2">{card.definition}</div>
                      <div className="col-span-3 flex items-center">
                        <MasteryBadge level={leechMap[card.id]} size="sm" isLeech />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
