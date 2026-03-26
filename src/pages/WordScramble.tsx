import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useStudySets } from '../hooks/useStudySets';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isMockMode } from '../lib/supabase';
import { masteryToBand } from '../lib/masteryEngine';
import { cn } from '../lib/utils';
import type { Flashcard, StudySet } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LetterTile {
  id: string;
  letter: string;
  isSpace: boolean;
}

type GameState = 'playing' | 'correct' | 'wrong' | 'done';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle each word's letters independently; preserve space positions. */
function shuffleTerm(term: string): LetterTile[] {
  const words = term.split(' ');
  const tiles: LetterTile[] = [];

  words.forEach((word, wi) => {
    if (!word) return;
    let letters = word.split('');

    if (letters.length > 1) {
      letters = fisherYates(letters);
      // Guarantee shuffled ≠ original (swap first & last when equal)
      if (letters.join('') === word) {
        [letters[0], letters[letters.length - 1]] = [letters[letters.length - 1], letters[0]];
      }
    }

    letters.forEach((l, li) => {
      tiles.push({ id: `${wi}-${li}-${l}`, letter: l, isSpace: false });
    });

    if (wi < words.length - 1) {
      tiles.push({ id: `space-${wi}`, letter: ' ', isSpace: true });
    }
  });

  return tiles;
}

function checkAnswer(selectedIds: string[], tiles: LetterTile[], term: string): boolean {
  // Build in click order (selectedIds order), not tile array order
  const built = selectedIds
    .map(id => tiles.find(t => t.id === id))
    .filter((t): t is LetterTile => t !== undefined && !t.isSpace)
    .map(t => t.letter)
    .join('')
    .toLowerCase();
  return built === term.replace(/\s/g, '').toLowerCase();
}

// ---------------------------------------------------------------------------
// Card selection — Band 1-3 first, max 15
// ---------------------------------------------------------------------------

function selectCards(
  flashcards: Flashcard[],
  progressMap: Map<string, number>,
): Flashcard[] {
  const band1to3: Flashcard[] = [];
  const band4to5: Flashcard[] = [];

  for (const card of flashcards) {
    const mastery = progressMap.get(card.id);
    const band = mastery !== undefined ? masteryToBand(mastery) : 1;
    if (band <= 3) band1to3.push(card);
    else band4to5.push(card);
  }

  return fisherYates([...band1to3, ...band4to5]).slice(0, 15);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const WordScramble: React.FC = () => {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const { getStudySet } = useStudySets();
  const { user } = useAuth();

  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());
  const [loadingSet, setLoadingSet] = useState(true);

  // Game state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tiles, setTiles] = useState<LetterTile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [startTime] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  // Load set + progress
  useEffect(() => {
    if (!setId) return;
    const load = async () => {
      const s = await getStudySet(setId);
      setStudySet(s);

      if (!isMockMode && user?.id) {
        const cardIds = (s?.flashcards ?? []).map(c => c.id);
        if (cardIds.length > 0) {
          const { data } = await supabase
            .from('progress')
            .select('card_id, mastery_level')
            .eq('user_id', user.id)
            .in('card_id', cardIds);
          const map = new Map<string, number>();
          (data ?? []).forEach((r: any) => map.set(r.card_id, r.mastery_level));
          setProgressMap(map);
        }
      }

      setLoadingSet(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, user?.id]);

  const cards = useMemo(
    () => (studySet?.flashcards ? selectCards(studySet.flashcards, progressMap) : []),
    [studySet, progressMap],
  );

  const currentCard = cards[currentIndex] ?? null;

  // Build tiles when card changes
  useEffect(() => {
    if (!currentCard) return;
    setTiles(shuffleTerm(currentCard.term));
    setSelectedIds([]);
    setGameState('playing');
  }, [currentCard]);

  // Timer (only while playing)
  useEffect(() => {
    if (gameState !== 'playing' && gameState !== 'correct' && gameState !== 'wrong') return;
    if (gameState === 'done') return;
    const id = setInterval(() => setElapsedMs(Date.now() - startTime), 100);
    return () => clearInterval(id);
  }, [gameState, startTime]);

  const handleTileClick = useCallback(
    (tile: LetterTile) => {
      if (tile.isSpace || gameState !== 'playing') return;
      setSelectedIds(prev =>
        prev.includes(tile.id) ? prev.filter(id => id !== tile.id) : [...prev, tile.id],
      );
    },
    [gameState],
  );

  const handleCheck = useCallback(() => {
    if (!currentCard || gameState !== 'playing') return;
    const correct = checkAnswer(selectedIds, tiles, currentCard.term);
    if (correct) {
      setScore(s => s + 1);
      setGameState('correct');
      setTimeout(goNext, 800);
    } else {
      setGameState('wrong');
      setTimeout(goNext, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard, gameState, selectedIds, tiles]);

  const goNext = useCallback(() => {
    if (currentIndex + 1 >= cards.length) {
      setElapsedMs(Date.now() - startTime);
      setGameState('done');
    } else {
      setCurrentIndex(i => i + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, cards.length, startTime]);

  const handleRestart = () => {
    setCurrentIndex(0);
    setScore(0);
    setGameState('playing');
    setSelectedIds([]);
  };

  const formatTime = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  // ---- Render states ----

  if (loadingSet) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!studySet || cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Không có thẻ nào để chơi.</p>
        <button
          onClick={() => navigate(`/sets/${setId}`)}
          className="text-primary font-bold hover:underline"
        >
          Quay lại
        </button>
      </div>
    );
  }

  if (gameState === 'done') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
        <div className="bg-white rounded-2xl border p-8 max-w-sm w-full text-center shadow-sm">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Hoàn thành!</h2>
          <p className="text-slate-500 mb-6">
            Bạn đã giải xong {cards.length} từ
          </p>
          <div className="flex justify-center gap-8 mb-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">{score}</p>
              <p className="text-xs text-slate-400 mt-1">Đúng</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-500">{cards.length - score}</p>
              <p className="text-xs text-slate-400 mt-1">Sai</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-700">{formatTime(elapsedMs)}</p>
              <p className="text-xs text-slate-400 mt-1">Thời gian</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Chơi lại
            </button>
            <button
              onClick={() => navigate(`/sets/${setId}`)}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors"
            >
              Xong
            </button>
          </div>
        </div>
      </div>
    );
  }

  const poolTiles = tiles.filter(t => !t.isSpace && !selectedIds.includes(t.id));
  // Preserve click order for built tiles
  const builtTiles = selectedIds
    .map(id => tiles.find(t => t.id === id))
    .filter((t): t is LetterTile => t !== undefined && !t.isSpace);
  const spaceTiles = tiles.filter(t => t.isSpace);

  const feedbackColor =
    gameState === 'correct'
      ? 'border-emerald-400 bg-emerald-50'
      : gameState === 'wrong'
        ? 'border-red-400 bg-red-50'
        : 'border-slate-200 bg-white';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(`/sets/${setId}`)}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="text-center">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">
              🔤 Giải chữ
            </p>
            <p className="text-sm font-bold text-slate-700">
              {currentIndex + 1} / {cards.length}
            </p>
          </div>
          <div className="text-sm font-bold text-slate-500">{formatTime(elapsedMs)}</div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-200 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div className={cn('rounded-2xl border-2 p-6 mb-6 transition-colors', feedbackColor)}>
          {/* Feedback icon */}
          {gameState === 'correct' && (
            <div className="flex items-center gap-2 text-emerald-600 font-bold mb-3 text-sm">
              <CheckCircle className="w-4 h-4" /> Chính xác!
            </div>
          )}
          {gameState === 'wrong' && (
            <div className="mb-3">
              <div className="flex items-center gap-2 text-red-500 font-bold text-sm mb-1">
                <XCircle className="w-4 h-4" /> Sai rồi!
              </div>
              <p className="text-sm text-slate-600">
                Đáp án đúng: <span className="font-bold text-slate-800">{currentCard?.term}</span>
              </p>
            </div>
          )}

          {/* Definition */}
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-2">
            Định nghĩa
          </p>
          <p className="text-base text-slate-800 font-semibold leading-relaxed mb-6">
            {currentCard?.definition}
          </p>

          {/* Built answer area */}
          <div className="min-h-12 border-2 border-dashed border-slate-300 rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-center">
            {builtTiles.length === 0 ? (
              <span className="text-slate-300 text-sm">Nhấn vào các chữ cái bên dưới...</span>
            ) : (
              <>
                {builtTiles.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTileClick(t)}
                    disabled={gameState !== 'playing'}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-bold uppercase hover:bg-primary/80 transition-colors"
                  >
                    {t.letter}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Visual word separator hint */}
          {spaceTiles.length > 0 && (
            <p className="text-xs text-slate-400 mb-3">
              Từ có {spaceTiles.length + 1} chữ (bỏ qua khoảng cách)
            </p>
          )}

          {/* Pool tiles */}
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {poolTiles.map(t => (
              <button
                key={t.id}
                onClick={() => handleTileClick(t)}
                disabled={gameState !== 'playing'}
                className="px-3 py-2 bg-slate-100 border-2 border-slate-200 rounded-lg text-sm font-bold uppercase text-slate-700 hover:bg-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50"
              >
                {t.letter}
              </button>
            ))}
          </div>

          {/* Check button */}
          <button
            onClick={handleCheck}
            disabled={gameState !== 'playing' || builtTiles.length === 0}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            Kiểm tra
          </button>
        </div>

        {/* Score */}
        <div className="flex justify-center gap-6 text-sm">
          <span className="text-emerald-600 font-bold">✓ {score}</span>
          <span className="text-red-500 font-bold">✗ {currentIndex - score}</span>
        </div>
      </div>
    </div>
  );
};
