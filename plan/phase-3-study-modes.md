# Giai đoạn 3: Các Chế độ Học tập (Study Modes)

## Tổng quan
Xây dựng 3 chế độ học còn thiếu: **Learn (Multiple Choice)**, **Write (Text Input)** và **Mock Test**, đồng thời bổ sung tính năng còn thiếu cho FlashcardView (starring cards).

**Phụ thuộc:** Giai đoạn 1 (Auth + DB) nên hoàn thành trước để lưu progress.

---

## Trạng thái hiện tại (Đã làm)

### FlashcardView (`src/pages/FlashcardView.tsx`) — Gần hoàn chỉnh
-  Hiển thị từng thẻ một với `FlipCard` component (CSS 3D Transform)
-  Keyboard shortcuts: Space (flip), ArrowLeft/ArrowRight (prev/next)
-  Shuffle cards (dùng `set.flashcards` — đã cập nhật Phase 1)
-  Auto-play mode (tự lật & chuyển thẻ sau 3s)
-  Progress bar ở cuối màn hình
-  Confetti khi hoàn thành toàn bộ set
-  `useNavigate` + `useParams` (không còn callback props sau Phase 1)
- [ ] **Chưa:** Starring (gắn sao) từng thẻ
- [ ] **Chưa:** Filter "chỉ học thẻ gắn sao"
- [ ] **Chưa:** Settings panel (Settings button có nhưng chưa hoạt động)

### FlipCard (`src/components/flashcards/FlipCard.tsx`) — Hoàn chỉnh
-  CSS 3D flip animation với `motion` từ `motion/react`
-  Spring animation: `stiffness: 260, damping: 20`
-  Front: hiển thị Term, Back: hiển thị Definition (màu primary)

### StudySetCard — Chưa có nút dẫn vào Learn/Write mode
-  Nút "Flashcards" → FlashcardView
-  Nút "Match" → MatchGame
- [ ] **Chưa:** Nút "Learn" → LearnMode
- [ ] **Chưa:** Nút "Write" → WriteMode

---

## Việc cần làm (TODO)

### 3.1 Hoàn thiện FlashcardView — Starring Feature

#### Cập nhật `FlipCard` props để hỗ trợ starring
```tsx
interface FlipCardProps {
  term: string;
  definition: string;
  imageUrl?: string;       // Hiển thị ảnh nếu có
  isFlipped: boolean;
  isStarred: boolean;      // ← Mới
  onFlip: () => void;
  onStar: () => void;      // ← Mới
}
```

#### Logic starring trong FlashcardView
```ts
// State local:
const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
const [showStarredOnly, setShowStarredOnly] = useState(false);

// Toggle star:
const toggleStar = (cardId: string) => {
  setStarredIds(prev => {
    const next = new Set(prev);
    next.has(cardId) ? next.delete(cardId) : next.add(cardId);
    return next;
  });
  // Nếu đã có DB: UPDATE flashcards SET is_starred = !is_starred WHERE id = cardId
};

// Filtered cards:
const activeCards = showStarredOnly
  ? cards.filter(c => starredIds.has(c.id))
  : cards;
```

#### UI thay đổi trong FlashcardView header
```
- Thêm Star icon vào controls bar (giữa Shuffle và AutoPlay)
- Click → toggle showStarredOnly
- Khi active: icon filled + text "Starred only (N)"
```

#### Hiển thị ảnh trong FlipCard
```tsx
// Mặt trước của thẻ:
{imageUrl && (
  <img src={imageUrl} alt={term} className="max-h-32 object-contain rounded-lg mb-4" />
)}
```

### 3.2 Chế độ Learn — Multiple Choice

**Tạo `src/pages/LearnMode.tsx`**

#### Cấu trúc câu hỏi
```ts
interface Question {
  cardId: string;
  prompt: string;          // Hiển thị: term hoặc definition
  promptType: 'term' | 'definition';
  correctAnswer: string;   // Definition hoặc term tương ứng
  choices: string[];       // 4 lựa chọn (1 đúng + 3 nhiễu), đã xáo trộn
}
```

#### Thuật toán tạo câu hỏi
```ts
function generateQuestions(cards: Flashcard[]): Question[] {
  return cards.map(card => {
    // Lấy 3 định nghĩa ngẫu nhiên TỪ CÁC THẺ KHÁC
    const distractors = cards
      .filter(c => c.id !== card.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(c => c.definition);

    const choices = [...distractors, card.definition]
      .sort(() => Math.random() - 0.5);  // Xáo trộn vị trí

    return {
      cardId: card.id,
      prompt: card.term,
      promptType: 'term',
      correctAnswer: card.definition,
      choices
    };
  }).sort(() => Math.random() - 0.5);  // Xáo trộn thứ tự câu hỏi
}
```

> **Edge case:** Nếu set có < 4 cards, dùng placeholder distractors hoặc skip mode.

#### UI LearnMode
```
Layout:
- Header: "[Set Title] · Learn Mode" + nút Back + progress "3 / 10"
- Progress bar strip ở trên cùng
- Card câu hỏi: term ở giữa màn hình (lớn, bold)
- Bên dưới: 4 nút đáp án (2x2 grid)

Sau khi chọn đáp án:
- Đúng: nút correct chuyển xanh (bg-green-500), hiện ✓
- Sai: nút wrong chuyển đỏ, nút correct highlight xanh để user biết đáp án
- Delay 1.2s rồi tự chuyển câu tiếp
- Không cho click tiếp khi đang hiện kết quả

Cuối round:
- Màn hình kết quả: "You got X / Y correct (Z%)"
- Nút "Study Again" (xáo trộn lại toàn bộ)
- Nút "Study Missed" (chỉ học những câu sai)
- Nút "Back to Set"
```

#### Lưu progress sau mỗi câu
```ts
// Khi trả lời đúng → mastery_level + 1 (max 5)
// Khi trả lời sai → mastery_level max(0, level - 1)
// UPSERT vào bảng progress
await supabase.from('progress').upsert({
  user_id: userId,
  card_id: cardId,
  mastery_level: newLevel,
  updated_at: new Date().toISOString()
}, { onConflict: 'user_id,card_id' });
```

### 3.3 Chế độ Write — Text Input

**Tạo `src/pages/WriteMode.tsx`**

#### UI WriteMode
```
- Hiển thị: Definition (prompt)
- Input: ô text để gõ Term
- Nút "Check Answer" hoặc nhấn Enter để kiểm tra

Feedback:
- Đúng: input border xanh, text "Correct! ✓"
- Gần đúng (levenshtein distance ≤ 2): border vàng, text "Almost! (correct: [term])"
- Sai: input border đỏ, hiện đáp án đúng, nút "Got it wrong" hoặc "Override: I got it"

Navigation:
- Sau feedback, nút "Next" để chuyển tiếp
- Keyboard: Enter để check, Enter lần 2 để next
```

#### Logic kiểm tra đáp án
```ts
function checkAnswer(userInput: string, correctAnswer: string): 'correct' | 'almost' | 'wrong' {
  const normalized = (s: string) => s.trim().toLowerCase();
  const userNorm = normalized(userInput);
  const correctNorm = normalized(correctAnswer);

  if (userNorm === correctNorm) return 'correct';

  // Levenshtein distance để phát hiện typo
  const distance = levenshtein(userNorm, correctNorm);
  const maxLen = Math.max(userNorm.length, correctNorm.length);
  if (distance / maxLen <= 0.2) return 'almost';  // Sai ≤ 20% ký tự

  return 'wrong';
}
```

> **Lưu ý (từ Phase 1):** Tất cả pages mới (LearnMode, WriteMode, MockTest) **không nhận callback props**. Dùng `useNavigate()` và `useParams<{ setId: string }>()` để navigate và lấy setId.

#### Cài package
```bash
npm install fastest-levenshtein
```

### 3.4 Chế độ Mock Test — Bài thi tổng hợp

**Tạo `src/pages/MockTest.tsx`**

#### Tạo đề thi
```ts
function generateTest(cards: Flashcard[]): TestQuestion[] {
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  const half = Math.ceil(shuffled.length / 2);
  
  // 50% Multiple Choice (từ generateQuestions)
  const mcQuestions = generateQuestions(shuffled.slice(0, half))
    .map(q => ({ ...q, type: 'multiple-choice' as const }));
  
  // 50% Write
  const writeQuestions = shuffled.slice(half).map(card => ({
    type: 'write' as const,
    cardId: card.id,
    prompt: card.definition,
    correctAnswer: card.term
  }));

  // Xáo trộn thứ tự câu hỏi
  return [...mcQuestions, ...writeQuestions].sort(() => Math.random() - 0.5);
}
```

#### UI MockTest
```
- Header: progress "Question 5 of 20" + nút submit sớm
- Hiển thị từng câu 1 (không cho skip back)
- Multiple choice: giống LearnMode nhưng không auto-advance
- Write: giống WriteMode nhưng không show override option

Màn hình kết quả cuối:
- Điểm: "15 / 20 (75%)"
- Bảng review: liệt kê tất cả câu, term, đáp án user gõ, đáp án đúng
- Màu xanh/đỏ cho đúng/sai
- Nút "Retake Test"
```

### 3.5 Cập nhật Navigation

#### App.tsx — Thêm routes mới

> **Phase 1 đã setup React Router** với `ProtectedRoute` dùng `<Outlet>` pattern.
> Thêm vào group `<Route element={<ProtectedRoute />}>` trong `App.tsx`.

```
/learn/:setId   → LearnMode
/write/:setId   → WriteMode
/test/:setId    → MockTest
```

#### StudySetCard — Thêm dropdown cho study modes
```tsx
// Thay 2 nút thành dropdown "Study" với các options:
// - Flashcards
// - Learn (Multiple Choice)
// - Write
// - Test
// - Match Game
```

#### FlashcardView header — Thêm nút chuyển mode
```
Thêm dropdown/menu: "Switch Mode"
→ Flashcards (current) ✓
→ Learn
→ Write
→ Test
```

---

## File cần tạo mới
```
src/
  pages/
    LearnMode.tsx         ← Multiple choice study mode
    WriteMode.tsx         ← Text input study mode
    MockTest.tsx          ← Combined test mode
  utils/
    questionGenerator.ts  ← Shared logic tạo câu hỏi
    levenshtein.ts        ← String similarity check (hoặc dùng package)
```

## File cần sửa
```
src/
  components/
    flashcards/
      FlipCard.tsx        ← Thêm starring, image display
    dashboard/
      StudySetCard.tsx    ← Thêm các nút study mode
  pages/
    FlashcardView.tsx     ← Starring feature + filter starred only
  App.tsx                 ← Thêm routes cho các mode mới
```

---

## Thứ tự thực hiện
1. Hoàn thiện starring trong FlashcardView (không cần DB có thể làm ngay)
2. Tạo `questionGenerator.ts` với `generateQuestions()`
3. Build `LearnMode.tsx` (UI + logic)
4. Test LearnMode với mock data
5. Kết nối LearnMode với DB để lưu progress
6. Build `WriteMode.tsx` + implement levenshtein check
7. Build `MockTest.tsx` (kết hợp 2 loại câu hỏi)
8. Update navigation (StudySetCard dropdown, mode switcher)
9. Test toàn bộ flow cho cả 3 mode

---

## Chú ý kỹ thuật
- **Minimum 4 cards:** LearnMode cần ít nhất 4 cards để tạo distractors đủ; hiển thị warning nếu set < 4 cards
- **Progress persistence:** Tất cả câu trả lời đúng/sai đều phải được debounce để tránh spam DB updates
- **State reset:** Khi user navigate away rồi quay lại, có thể resume hoặc start fresh — nên hỏi user
- **Accessibility:** Input trong WriteMode cần `aria-label`, focus tự động khi chuyển câu
