import React from 'react';
import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  streak: number;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ streak }) => {
  if (streak === 0) return null;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full text-sm font-bold text-orange-600">
      <Flame className="w-4 h-4 text-orange-500" />
      {streak} ngày liên tiếp
    </div>
  );
};
