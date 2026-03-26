import React from 'react';
import { BAND_INFO } from '../../lib/masteryEngine';
import type { BandLevel } from '../../types';

interface Props {
  bandCounts: Record<BandLevel, number>;
  totalCards: number;
}

const BANDS: BandLevel[] = [1, 2, 3, 4, 5];

export const BandDistributionChart: React.FC<Props> = ({ bandCounts, totalCards }) => {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
        Phân bổ băng tần ghi nhớ
      </h3>
      <div className="space-y-2.5">
        {BANDS.map(band => {
          const info = BAND_INFO[band];
          const count = bandCounts[band];
          const pct = totalCards > 0 ? Math.round((count / totalCards) * 100) : 0;
          return (
            <div key={band} className="flex items-center gap-3">
              <span className="w-28 text-xs text-slate-500 shrink-0">
                Band {band} · {info.label}
              </span>
              <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${info.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-20 text-xs text-slate-500 text-right shrink-0">
                {count} từ ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 pt-3">
        Tổng: {totalCards} từ ·{' '}
        <span className="text-emerald-600 font-semibold">{bandCounts[5]} dài hạn</span>
        {' · '}
        <span className="text-red-500 font-semibold">{bandCounts[1]} cần ôn</span>
      </p>
    </div>
  );
};
