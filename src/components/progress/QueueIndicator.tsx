import React from 'react';
import type { QueueCounts } from '../../hooks/useLearningQueue';
import { cn } from '../../lib/utils';

interface QueueIndicatorProps {
  counts: QueueCounts;
  /** Cards answered correctly at least once this session. */
  completed: number;
  /** Total cards in the original session (before any wrong-answer re-queuing). */
  total: number;
  className?: string;
}

/**
 * Compact status bar showing how many cards of each bucket type remain
 * in the current learning session.
 *
 * Renders as:   🔴 4  |  🔵 4  |  🟢 2   (3/10)
 */
export const QueueIndicator: React.FC<QueueIndicatorProps> = ({
  counts,
  completed,
  total,
  className,
}) => {
  if (total === 0) return null;

  const remaining = counts.urgent + counts.review + counts.new;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-sm font-medium',
        className,
      )}
      title={`${completed} of ${total} cards completed this session`}
    >
      {/* Bucket A — urgent (red) */}
      <span className={cn('flex items-center gap-1', counts.urgent === 0 && 'opacity-40')}>
        <span>🔴</span>
        <span className="text-red-400">{counts.urgent}</span>
      </span>

      <span className="text-slate-600">|</span>

      {/* Bucket B — review (blue) */}
      <span className={cn('flex items-center gap-1', counts.review === 0 && 'opacity-40')}>
        <span>🔵</span>
        <span className="text-blue-400">{counts.review}</span>
      </span>

      <span className="text-slate-600">|</span>

      {/* Bucket C — new (green) */}
      <span className={cn('flex items-center gap-1', counts.new === 0 && 'opacity-40')}>
        <span>🟢</span>
        <span className="text-green-400">{counts.new}</span>
      </span>

      {/* Session progress */}
      <span className="ml-1 text-slate-500 text-xs tabular-nums">
        ({completed}/{total}
        {remaining > total - completed && (
          <span className="text-orange-400"> +{remaining - (total - completed)}</span>
        )}
        )
      </span>
    </div>
  );
};
