# Giai đoạn 4: Trò chơi Match (Match Game)

## Tổng quan
MatchGame hiện đã có UI và logic cơ bản. Giai đoạn này tập trung hoàn thiện gameplay (lưới 6-8 cặp thay vì dùng toàn bộ set), kết nối Personal Best với database, và thêm hiệu ứng ăn mừng khi phá kỷ lục.

**Phụ thuộc:** Giai đoạn 1 (DB + Auth) để lưu/đọc `match_records`.

---

## Trạng thái hiện tại (Đã làm)

### MatchGame (`src/pages/MatchGame.tsx`) — Gần hoàn chỉnh

-  `GameCard` interface: `id`, `content`, `type` (`term|definition`), `pairId`, `status`
-  `initGame()`: tách cards thành term + definition, xáo trộn ngẫu nhiên (dùng `set.flashcards` — đã cập nhật Phase 1)
-  **Logic ghép thẻ hoàn chỉnh**
-  **Timer:** millisecond precision
-  Timer bắt đầu khi click thẻ đầu tiên HOẶC khi nhấn "Start Game"
-  `confetti()` khi tất cả thẻ biến mất
-  Màn hình "Ready to Match?" trước khi bắt đầu
-  Nút restart (RotateCcw)
-  `AnimatePresence` + `motion.button` cho animation exit
-  `useNavigate` + `useParams` (không còn callback props sau Phase 1)
- [ ] **Chưa:** Giới hạn 6-8 cặp thay vì dùng all cards
- [ ] **Chưa:** Màn hình kết quả (hiện chỉ có confetti)
- [ ] **Chưa:** Personal Best lưu vào DB
- [ ] **Chưa:** So sánh thời gian với kỷ lục cũ
- [ ] **Chưa:** Hiệu ứng pháo hoa đặc biệt khi phá kỷ lục

---

## Việc cần làm (TODO)

### 4.1 Giới hạn số cặp thẻ (6-8 cặp)

#### Logic chọn cards cho game
```ts
const CARDS_PER_ROUND = 8; // Configurable

function selectGameCards(allCards: Flashcard[]): Flashcard[] {
  if (allCards.length <= CARDS_PER_ROUND) return allCards;
  // Ưu tiên các thẻ chưa thuộc (mastery_level thấp) nếu có progress data
  // Fallback: random
  return [...allCards]
    .sort(() => Math.random() - 0.5)
    .slice(0, CARDS_PER_ROUND);
}
```

#### Cập nhật `initGame()` trong MatchGame
```ts
const gameCards = selectGameCards(set.flashcards);
// Tạo term + definition pairs từ gameCards (tối đa 8 cặp = 16 khối)
```

#### UI Round selector (optional)
```
Trên màn "Ready to Match?":
- "Cards per round: [6] [8] [10]" (nếu set đủ lớn)
```

### 4.2 Màn hình kết quả (Finish Screen)

#### State mới trong MatchGame
```ts
const [isFinished, setIsFinished] = useState(false);
const [personalBest, setPersonalBest] = useState<number | null>(null);
const [isNewRecord, setIsNewRecord] = useState(false);
const [finishedTime, setFinishedTime] = useState(0);
```

#### Khi tất cả thẻ khớp xong
```ts
// Thay vì chỉ bắn confetti, hiện finish screen:
setIsFinished(true);
setFinishedTime(time);
await checkAndUpdatePersonalBest(time);  // ← DB call
```

#### UI Finish Screen
```tsx
// Overlay hoặc thay thế grid, với animation fade-in:
<div className="flex flex-col items-center justify-center gap-6 text-center">
  
  {isNewRecord && (
    <div className="badge">🏆 New Personal Best!</div>
  )}
  
  <h1 className="text-5xl font-bold">{formatTime(finishedTime)}</h1>
  
  {personalBest && !isNewRecord && (
    <p className="text-white/60">
      Best: {formatTime(personalBest)}  
      (+{formatTime(finishedTime - personalBest)} slower)
    </p>
  )}
  
  {personalBest && isNewRecord && (
    <p className="text-white/60">
      Previous best: {formatTime(previousBest)}
    </p>
  )}
  
  <div className="flex gap-4">
    <button onClick={initGame}>Play Again</button>
    <button onClick={onBack}>Back to Set</button>
  </div>
</div>
```

### 4.3 Personal Best — Database Integration

#### Tạo `src/hooks/useMatchRecords.ts`
```ts
export function useMatchRecords() {
  async function getPersonalBest(setId: string): Promise<number | null> {
    const { data } = await supabase
      .from('match_records')
      .select('best_time_ms')
      .eq('user_id', userId)
      .eq('set_id', setId)
      .single();
    return data?.best_time_ms ?? null;
  }

  async function updatePersonalBest(setId: string, timeMs: number): Promise<boolean> {
    const current = await getPersonalBest(setId);
    if (current !== null && timeMs >= current) return false; // Không phá kỷ lục
    
    await supabase.from('match_records').upsert({
      user_id: userId,
      set_id: setId,
      best_time_ms: timeMs,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,set_id' });
    
    return true; // Đã cập nhật kỷ lục mới
  }
  
  return { getPersonalBest, updatePersonalBest };
}
```

#### Tích hợp vào MatchGame
```ts
// Khi game bắt đầu: load personal best để hiển thị trên header
useEffect(() => {
  getPersonalBest(setId).then(setPersonalBest);
}, [setId]);

// Khi game kết thúc:
const isNewRecord = await updatePersonalBest(setId, finishedTime);
setIsNewRecord(isNewRecord);
```

#### Hiển thị Personal Best trên header
```tsx
// Header bar trong MatchGame:
<div className="flex items-center gap-2 text-white/40 text-sm">
  <Trophy className="w-4 h-4 text-yellow-400" />
  <span>Best: {personalBest ? formatTime(personalBest) : '--'}</span>
</div>
```

### 4.4 Enhanced Confetti — Phá kỷ lục

#### Confetti bình thường (hoàn thành game)
```ts
confetti({
  particleCount: 200,
  spread: 100,
  origin: { y: 0.6 }
});
```

#### Confetti đặc biệt (New Personal Best)
```ts
// Bắn confetti từ cả 2 bên
const duration = 3000;
const end = Date.now() + duration;

const frame = () => {
  confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
  confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
  if (Date.now() < end) requestAnimationFrame(frame);
};
frame();
```

### 4.5 Cải thiện UX Gameplay

#### Wrong match animation
Hiện tại dùng `animate: { x: [0, -5, 5, -5, 5, 0] }` — hoạt động tốt. Có thể thêm âm thanh (optional).

#### Selected state highlight
Khi thẻ 1 đang `selected` và user click thẻ 2:
- Nếu cùng loại (term + term): highlight cả 2 đỏ ngắn, không thay đổi selected
- Hiện tại code đang kiểm tra `selected.type !== card.type` — OK

#### Deselect khi click lại thẻ đang selected
```ts
if (selected.id === card.id) {
  setSelected(null);
  setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: 'idle' } : c));
  return;
}
```
✅ Đã có trong code hiện tại.

#### Thêm counter sai
```ts
const [mistakes, setMistakes] = useState(0);
// Tăng mistakes khi wrong match
// Hiển thị trên finish screen: "Mistakes: 3"
```

#### Grid layout responsive
```
Mobile (< 640px): 2 cột
Tablet (640-1024px): 3 cột
Desktop (> 1024px): 4 cột
```
✅ Đã implement với Tailwind responsive classes.

---

## File cần tạo mới
```
src/
  hooks/
    useMatchRecords.ts    ← Personal best CRUD
```

## File cần sửa
```
src/
  pages/
    MatchGame.tsx         ← Giới hạn cards, finish screen, personal best, enhanced confetti
```

---

## Thứ tự thực hiện
1. Implement giới hạn 6-8 cặp trong `initGame()`
2. Thêm `finishedTime` state và màn hình kết quả cơ bản (không cần DB)
3. Test flow với mock data
4. Tạo `useMatchRecords` hook
5. Load personal best khi component mount
6. Lưu personal best khi game kết thúc
7. Implement enhanced confetti cho new record case
8. Test toàn bộ flow: lần 1 (set record mới), lần 2 (chậm hơn), lần 3 (phá record)

---

## Chú ý kỹ thuật
- **Race condition:** Timer `setInterval` và finish check có thể conflict — dùng `useRef` cho timer (đã làm) để đảm bảo cleanup đúng
- **Thẻ ít hơn 6:** Nếu set có < 6 cards, dùng tất cả cards không giới hạn
- **Timer accuracy:** Format `5.23s` thay vì `5.2300s` — cắt ở 2 chữ số thập phân (đã làm với `Math.floor` + `padStart`)
- **Optimistic UI:** Hiển thị "New Personal Best!" ngay lập tức, DB update chạy background
