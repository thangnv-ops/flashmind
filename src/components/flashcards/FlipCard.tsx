import React from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FlipCardProps {
  term: string;
  definition: string;
  imageUrl?: string | null;
  isFlipped: boolean;
  onFlip: () => void;
  isStarred?: boolean;
  onStar?: () => void;
}

export const FlipCard: React.FC<FlipCardProps> = ({
  term,
  definition,
  imageUrl,
  isFlipped,
  onFlip,
  isStarred = false,
  onStar,
}) => {
  return (
    <div
      onClick={onFlip}
      className="w-full max-w-2xl aspect-[16/10] perspective-1000 cursor-pointer group"
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
        className="relative w-full h-full transform-style-3d"
      >
        {/* Front */}
        <div className="absolute inset-0 bg-white border-2 border-slate-100 rounded-3xl shadow-xl flex items-center justify-center p-12 backface-hidden group-hover:border-primary/20 transition-colors">
          {onStar && (
            <button
              onClick={e => { e.stopPropagation(); onStar(); }}
              className={cn(
                'absolute top-4 right-4 p-2 rounded-full transition-colors',
                isStarred ? 'text-amber-400 hover:text-amber-500' : 'text-slate-300 hover:text-amber-400'
              )}
              aria-label={isStarred ? 'Unstar card' : 'Star card'}
            >
              <Star className={cn('w-5 h-5', isStarred && 'fill-amber-400')} />
            </button>
          )}
          <div className="text-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 block">Term</span>
            {imageUrl && (
              <img
                src={imageUrl}
                alt={term}
                className="max-h-32 object-contain rounded-lg mb-4 mx-auto"
              />
            )}
            <h2 className="text-4xl md:text-5xl font-bold text-slate-800 leading-tight">
              {term}
            </h2>
          </div>
          <div className="absolute bottom-6 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            Click to flip
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 bg-primary border-2 border-primary-dark rounded-3xl shadow-xl flex items-center justify-center p-12 backface-hidden rotate-y-180">
          {onStar && (
            <button
              onClick={e => { e.stopPropagation(); onStar(); }}
              className={cn(
                'absolute top-4 right-4 p-2 rounded-full transition-colors',
                isStarred ? 'text-amber-300 hover:text-amber-200' : 'text-white/30 hover:text-amber-300'
              )}
              aria-label={isStarred ? 'Unstar card' : 'Star card'}
            >
              <Star className={cn('w-5 h-5', isStarred && 'fill-amber-300')} />
            </button>
          )}
          <div className="text-center text-white">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 block">Definition</span>
            <p className="text-2xl md:text-3xl font-medium leading-relaxed">
              {definition}
            </p>
          </div>
          <div className="absolute bottom-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Click to flip back
          </div>
        </div>
      </motion.div>
    </div>
  );
};
