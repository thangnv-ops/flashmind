/**
 * MasteryDots — 10 chấm nhỏ hiển thị mức độ thành thạo.
 *
 * Props:
 *   level            1–10 — số chấm sáng
 *   animate          true = bounce fill khi vừa tăng level
 *   penaltyAnimation true = chấm bị mất trượt mờ dần (khi bị phạt)
 */

function getDotColor(dotIndex: number, currentLevel: number): string {
  // dotIndex 0-based; dot i sáng khi i < currentLevel
  if (dotIndex >= currentLevel) return '#e2e8f0'; // chưa đạt — xám nhạt
  if (dotIndex < 3)  return '#94a3b8';            // dot 1–3 (Newbie)
  if (dotIndex < 6)  return '#f59e0b';            // dot 4–6 (Learning)
  if (dotIndex < 9)  return '#22c55e';            // dot 7–9 (Mastered)
  return '#a855f7';                               // dot 10 (Legendary)
}

interface MasteryDotsProps {
  level: number;
  animate?: boolean;
  penaltyAnimation?: boolean;
}

export function MasteryDots({
  level,
  animate = false,
  penaltyAnimation = false,
}: MasteryDotsProps) {
  const clamped = Math.max(1, Math.min(10, level));
  const isLegendary = clamped === 10;

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`Mastery level ${clamped} out of 10`}
    >
      {Array.from({ length: 10 }, (_, i) => {
        const active = i < clamped;
        const color  = getDotColor(i, clamped);

        // Animation class selection
        let animClass = '';
        if (active && animate) {
          // Newly lit dot bounces
          animClass = 'animate-bounce';
        } else if (!active && penaltyAnimation) {
          // Dots that were just "lost" fade out
          animClass = 'transition-opacity duration-300 ease-out';
        }

        return (
          <span
            key={i}
            className={`block rounded-full transition-colors duration-300 ${animClass} ${
              isLegendary && active ? 'animate-pulse' : ''
            }`}
            style={{
              width:           8,
              height:          8,
              backgroundColor: color,
              opacity:         active ? 1 : 0.35,
            }}
          />
        );
      })}
    </div>
  );
}
