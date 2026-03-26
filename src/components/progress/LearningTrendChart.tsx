import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useDailyStats } from '../../hooks/useDailyStats';
import { Loader2 } from 'lucide-react';

interface Props {
  setId?: string;
  days?: 7 | 14 | 30;
}

type DayRange = 7 | 14 | 30;

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const learned = payload.find((p: any) => p.dataKey === 'newlyLearned')?.value ?? 0;
  const forgotten = payload.find((p: any) => p.dataKey === 'forgotten')?.value ?? 0;
  const d = new Date(label + 'T00:00:00');
  const dateStr = d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long' });
  return (
    <div className="bg-white border rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-slate-700 mb-1">{dateStr}</p>
      {learned > 0 && <p className="text-emerald-600 font-semibold">+{learned} từ mới học</p>}
      {forgotten > 0 && <p className="text-red-500 font-semibold">-{forgotten} từ bị quên</p>}
      {learned === 0 && forgotten === 0 && <p className="text-slate-400">Không có hoạt động</p>}
    </div>
  );
};

const legendFormatter = (value: string) =>
  value === 'newlyLearned' ? 'Từ mới học' : 'Từ bị quên';

export const LearningTrendChart: React.FC<Props> = ({ setId, days: initialDays = 14 }) => {
  const [days, setDays] = useState<DayRange>(initialDays);
  const { learningTrend, loading } = useDailyStats(days, setId);

  const isEmpty = learningTrend.every(d => d.newlyLearned === 0 && d.forgotten === 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
          Xu hướng học tập
        </h3>
        <div className="flex gap-1">
          {([7, 14, 30] as DayRange[]).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-colors ${
                days === d
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              {d}N
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : isEmpty ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
          Chưa có dữ liệu học tập
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={learningTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={28} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={legendFormatter} />
            <Area
              type="monotone"
              dataKey="newlyLearned"
              stroke="#10b981"
              fill="#d1fae5"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="forgotten"
              stroke="#ef4444"
              fill="#fee2e2"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
