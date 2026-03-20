import { getMasteryBadge } from '../../lib/masteryEngine';

const LEVEL_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#94a3b8', 3: '#94a3b8',  // Newbie   — xám xanh
  4: '#f59e0b', 5: '#f59e0b', 6: '#f59e0b',  // Learning — cam vàng
  7: '#22c55e', 8: '#22c55e', 9: '#22c55e',  // Mastered — xanh lá
  10: '#a855f7',                              // Legendary — tím
};

const BADGE_ICONS: Record<string, string> = {
  Newbie:    '🐣',
  Learning:  '📖',
  Mastered:  '⚡',
  Legendary: '🏆',
};

interface MasteryBadgeProps {
  level: number;           // 1–10
  showLabel?: boolean;     // hiện tên badge (mặc định true)
  size?: 'sm' | 'md' | 'lg';
  isLeech?: boolean;       // hiện ⚠️ badge khi là leech card
}

const SIZE_CLASSES = {
  sm:  'text-xs px-2 py-0.5 gap-1',
  md:  'text-sm px-2.5 py-1 gap-1.5',
  lg:  'text-base px-3 py-1.5 gap-2',
};

export function MasteryBadge({
  level,
  showLabel = true,
  size = 'md',
  isLeech = false,
}: MasteryBadgeProps) {
  const clamped = Math.max(1, Math.min(10, level));
  const badge   = getMasteryBadge(clamped);
  const color   = LEVEL_COLORS[clamped];
  const icon    = BADGE_ICONS[badge];

  const isLegendary = clamped === 10;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${SIZE_CLASSES[size]} ${
        isLegendary ? 'shadow-[0_0_8px_2px_rgba(168,85,247,0.4)]' : ''
      }`}
      style={{
        color,
        borderColor: `${color}55`,
        backgroundColor: `${color}18`,
      }}
      title={`Mastery Level ${clamped}: ${badge}`}
    >
      <span>{icon}</span>
      {showLabel && <span>{badge}</span>}
      <span className="opacity-70">Lv.{clamped}</span>
      {isLeech && (
        <span title="Thẻ khó — bị phạt nhiều lần" className="ml-0.5">
          ⚠️
        </span>
      )}
    </span>
  );
}
