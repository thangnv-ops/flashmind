import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, RefreshCw, BookOpen, Loader2 } from 'lucide-react';
import { useVocabStatus } from '../../hooks/useVocabStatus';
import type { Flashcard } from '../../types';
import { cn } from '../../lib/utils';

interface VocabStatusPanelProps {
  setId: string;
}

type Tab = 'mastered' | 'inProgress' | 'notStarted';

const TAB_CONFIG: Record<Tab, { label: string; icon: React.ReactNode; color: string; badge: string; studyStatus: string }> = {
  mastered: {
    label: 'Đã học',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-emerald-600 border-emerald-400 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    studyStatus: 'mastered',
  },
  inProgress: {
    label: 'Đang học',
    icon: <RefreshCw className="w-4 h-4" />,
    color: 'text-amber-600 border-amber-400 bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    studyStatus: 'inProgress',
  },
  notStarted: {
    label: 'Chưa học',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-slate-500 border-slate-300 bg-slate-50',
    badge: 'bg-slate-100 text-slate-600',
    studyStatus: 'notStarted',
  },
};

const CardList: React.FC<{ cards: Flashcard[] }> = ({ cards }) => (
  <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto pr-1">
    {cards.map(card => (
      <div
        key={card.id}
        className="grid grid-cols-2 gap-4 px-4 py-2.5 bg-white border rounded-lg text-sm"
      >
        <div className="font-semibold text-slate-800 truncate">{card.term}</div>
        <div className="text-slate-500 truncate">{card.definition}</div>
      </div>
    ))}
  </div>
);

export const VocabStatusPanel: React.FC<VocabStatusPanelProps> = ({ setId }) => {
  const navigate = useNavigate();
  const { groups, loading } = useVocabStatus(setId);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading vocabulary status…</span>
      </div>
    );
  }

  const total = groups.mastered.length + groups.inProgress.length + groups.notStarted.length;
  const masteredPct = total > 0 ? Math.round((groups.mastered.length / total) * 100) : 0;
  const inProgressPct = total > 0 ? Math.round((groups.inProgress.length / total) * 100) : 0;

  const tabs: Tab[] = ['mastered', 'inProgress', 'notStarted'];
  const cardsForTab: Record<Tab, Flashcard[]> = {
    mastered: groups.mastered,
    inProgress: groups.inProgress,
    notStarted: groups.notStarted,
  };

  const handleStudyGroup = (tab: Tab) => {
    const cards = cardsForTab[tab];
    if (cards.length === 0) return;
    navigate(`/learn/${setId}`, { state: { cardIds: cards.map(c => c.id) } });
  };

  return (
    <div className="bg-white border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b bg-slate-50">
        <h3 className="text-sm font-bold text-slate-700">Trạng thái từ vựng</h3>
      </div>

      {/* 3 stat cards */}
      <div className="grid grid-cols-3 divide-x">
        {tabs.map(tab => {
          const cfg = TAB_CONFIG[tab];
          const count = cardsForTab[tab].length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(isActive ? null : tab)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-4 transition-colors',
                isActive ? cfg.color : 'hover:bg-slate-50',
              )}
            >
              <div className={cn('flex items-center gap-1.5 font-bold text-sm', isActive ? '' : 'text-slate-600')}>
                {cfg.icon}
                {cfg.label}
              </div>
              <span className={cn('text-2xl font-bold', isActive ? '' : 'text-slate-800')}>{count}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', cfg.badge)}>từ</span>
            </button>
          );
        })}
      </div>

      {/* Stacked progress bar */}
      <div className="px-5 py-3 border-t flex gap-0.5 items-center">
        <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
          {masteredPct > 0 && (
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${masteredPct}%` }}
            />
          )}
          {inProgressPct > 0 && (
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${inProgressPct}%` }}
            />
          )}
        </div>
        <span className="ml-3 text-xs font-bold text-slate-500 tabular-nums w-10 text-right">
          {masteredPct}%
        </span>
      </div>

      {/* Expanded card list */}
      {activeTab !== null && (
        <div className="px-5 pb-5 border-t bg-slate-50">
          <div className="flex items-center justify-between mt-3 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {cardsForTab[activeTab].length} từ — {TAB_CONFIG[activeTab].label}
            </span>
            {cardsForTab[activeTab].length > 0 && (
              <button
                onClick={() => handleStudyGroup(activeTab)}
                className="text-xs font-bold text-primary hover:underline transition-colors"
              >
                Ôn nhóm này →
              </button>
            )}
          </div>

          {cardsForTab[activeTab].length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Không có từ nào trong nhóm này.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div>Term</div>
                <div>Definition</div>
              </div>
              <CardList cards={cardsForTab[activeTab]} />
            </>
          )}
        </div>
      )}
    </div>
  );
};
