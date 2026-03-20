import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useDailyStats } from '../../hooks/useDailyStats';
import { StreakBadge } from './StreakBadge';
import { Loader2 } from 'lucide-react';

interface DailyProgressChartProps {
  /** If provided, shows stats scoped to this study set only */
  setId?: string;
}

type DayRange = 7 | 14 | 30;

const formatDate = (dateStr: string, range: DayRange) => {
  const d = new Date(dateStr + 'T00:00:00');
  if (range === 7) return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'numeric' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const learned = payload.find((p: any) => p.dataKey === 'learned')?.value ?? 0;
  const forgotten = payload.find((p: any) => p.dataKey === 'forgotten')?.value ?? 0;
  const d = new Date(label + 'T00:00:00');
  const dateStr = d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long' });
  return (
    <div className="bg-white border rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-slate-700 mb-2">{dateStr}</p>
      {learned > 0 && (
        <p className="text-emerald-600 font-semibold">+{learned} từ học mới</p>
      )}
      {forgotten > 0 && (
        <p className="text-red-500 font-semibold">-{forgotten} từ quên</p>
      )}
      {learned === 0 && forgotten === 0 && (
        <p className="text-slate-400">Không có hoạt động</p>
      )}
    </div>
  );
};

export const DailyProgressChart: React.FC<DailyProgressChartProps> = ({ setId }) => {
  const [range, setRange] = useState<DayRange>(7);
  const { stats, uniqueLearnedCards, uniqueForgottenCards, uniqueReviewedCards, streak, loading } = useDailyStats(range, setId);

  const chartData = stats.map(s => ({ ...s, dateLabel: formatDate(s.date, range) }));

  return (
    <div className="bg-white border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-700">Tiến trình hàng ngày</span>
          <StreakBadge streak={streak} />
        </div>

        {/* Day range toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {([7, 14, 30] as DayRange[]).map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                range === d
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {d} ngày
            </button>
          ))}
        </div>
      </div>

      {/* Summary totals — unique card counts, not raw event sums */}
      <div className="px-5 pt-4 flex flex-wrap gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
          +{uniqueLearnedCards} từ học mới
        </span>
        {uniqueReviewedCards > 0 && (
          <span className="flex items-center gap-1.5 font-semibold text-amber-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
            +{uniqueReviewedCards} đang học
          </span>
        )}
        <span className="flex items-center gap-1.5 font-semibold text-red-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />
          -{uniqueForgottenCards} từ quên
        </span>
      </div>

      {/* Chart */}
      <div className="px-2 pb-4 pt-2">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={range === 30 ? 6 : range === 14 ? 10 : 18} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={24}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs font-semibold text-slate-500">
                    {value === 'learned' ? 'Học mới' : 'Đã quên'}
                  </span>
                )}
              />
              <Bar dataKey="learned" name="learned" fill="#34d399" radius={[3, 3, 0, 0]} />
              <Bar dataKey="forgotten" name="forgotten" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
