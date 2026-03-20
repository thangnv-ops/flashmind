import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase, isMockMode } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const GROUPS = [
  { name: 'Newbie (1–3)',   minLevel: 1, maxLevel: 3,  color: '#94a3b8' },
  { name: 'Learning (4–6)', minLevel: 4, maxLevel: 6,  color: '#f59e0b' },
  { name: 'Mastered (7–9)', minLevel: 7, maxLevel: 9,  color: '#22c55e' },
  { name: 'Legendary (10)', minLevel: 10, maxLevel: 10, color: '#a855f7' },
] as const;

interface PieSlice {
  name: string;
  value: number;
  color: string;
}

interface MasteryPieChartProps {
  setId?: string;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload as PieSlice;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white shadow-lg">
      <strong>{name}</strong>: {value} thẻ
    </div>
  );
}

export function MasteryPieChart({ setId }: MasteryPieChartProps) {
  const { user } = useAuth();
  const [slices, setSlices] = useState<PieSlice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || isMockMode) {
      setSlices(GROUPS.map(g => ({ name: g.name, value: 0, color: g.color })));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      let query = supabase
        .from('progress')
        .select('mastery_level')
        .eq('user_id', user.id);

      if (setId) query = query.eq('set_id', setId);

      const { data, error } = await query;

      if (cancelled) return;
      if (error) {
        console.error('[MasteryPieChart]', error.message);
        setLoading(false);
        return;
      }

      const counts = [0, 0, 0, 0]; // Newbie / Learning / Mastered / Legendary
      (data ?? []).forEach((row: { mastery_level: number }) => {
        const lv = row.mastery_level ?? 1;
        if (lv <= 3)       counts[0]++;
        else if (lv <= 6)  counts[1]++;
        else if (lv <= 9)  counts[2]++;
        else               counts[3]++;
      });

      setSlices(
        GROUPS.map((g, i) => ({ name: g.name, value: counts[i], color: g.color })),
      );
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id, setId]);

  const total = slices.reduce((s, sl) => s + sl.value, 0);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Đang tải...
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Chưa có dữ liệu ôn tập.
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-300">Phân bổ thành thạo</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={slices}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {slices.map((sl) => (
              <Cell key={sl.name} fill={sl.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs text-slate-300">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Số thẻ chi tiết mỗi nhóm */}
      <ul className="mt-2 space-y-1">
        {slices.map(sl => (
          <li key={sl.name} className="flex items-center gap-2 text-xs text-slate-400">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: sl.color }}
            />
            <span className="flex-1">{sl.name}</span>
            <span className="font-medium text-slate-200">
              {sl.value} thẻ · {total ? Math.round((sl.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
