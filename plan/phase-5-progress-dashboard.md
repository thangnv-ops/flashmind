# Giai đoạn 5: Theo dõi Tiến độ & Dashboard

## Tổng quan
Hoàn thiện Dashboard với dữ liệu thực từ DB, xây dựng hệ thống progress tracking toàn diện, và bổ sung các tính năng UX còn thiếu (user profile, search, notifications).

**Phụ thuộc:** Tất cả giai đoạn trước — đặc biệt Giai đoạn 3 đã phải lưu progress khi học.

---

## Trạng thái hiện tại (Đã làm)

### Dashboard (`src/pages/Dashboard.tsx`)
-  Header "Welcome back!" + nút Filter + nút Create Set
-  Section "Recent Activity" với `StudySetCard` grid (3 cột)
-  Loading skeleton (1.2s artificial delay)
-  Section "Your Folders" (chỉ có nút "New Folder", hoàn toàn tĩnh)
-  `useNavigate` thay thế callback props (Phase 1)
-  Dữ liệu từ `MOCK_SETS` — **chưa có DB**
- [ ] **Chưa:** Sort/Filter sets
- [ ] **Chưa:** Search
- [ ] **Chưa:** Progress % chính xác từ DB

### StudySetCard (`src/components/dashboard/StudySetCard.tsx`)
-  Title, card count, progress bar (Phase 1 đã cập nhật: `flashcards?.length`, `progressPercent`)
-  Nút Flashcards + Match dùng callback (Phase 1 đã giữ callbacks từ Dashboard)
-  `author` field đã bị **xóa** — hiển thị "You" hardcoded
- [ ] **Chưa:** `progressPercent` tính từ bảng `progress` trong DB
- [ ] **Chưa:** `last_accessed` hiển thị timestamp

### Sidebar (`src/components/layout/Sidebar.tsx`) — Đã cập nhật Phase 1
-  `useNavigate` cho nav items
-  `MOCK_FOLDERS` hiển thị (vẫn dùng mock)
- [ ] **Chưa:** Load folders từ DB
- [ ] **Chưa:** Navigation đúng theo route active state

---

## Việc cần làm (TODO)

### 5.1 Dashboard — Load Data Thực từ DB

#### Tạo `src/hooks/useDashboard.ts`
```ts
export function useDashboard() {
  const [recentSets, setRecentSets] = useState<StudySetWithMeta[]>([]);
  const [allSets, setAllSets] = useState<StudySetWithMeta[]>([]);
  const [folders, setFolders] = useState<FolderWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Query study_sets với joined flashcard count + progress percentage
  async function loadDashboard() {
    const { data: sets } = await supabase
      .from('study_sets')
      .select(`
        *,
        flashcards(count),
        progress:progress(mastery_level)
      `)
      .eq('user_id', userId)
      .order('last_accessed', { ascending: false });
    
    // Tính progress %
    const setsWithMeta = sets?.map(s => {
      const totalCards = s.flashcards[0]?.count ?? 0;
      const masteredCards = s.progress?.filter(p => p.mastery_level >= 4).length ?? 0;
      return {
        ...s,
        cardCount: totalCards,
        progressPercent: totalCards > 0 
          ? Math.round((masteredCards / totalCards) * 100)
          : 0
      };
    }) ?? [];
    
    setRecentSets(setsWithMeta.slice(0, 6));
    setAllSets(setsWithMeta);
    
    // Load folders
    const { data: foldersData } = await supabase
      .from('folders')
      .select('*, study_sets(count)')
      .eq('user_id', userId);
    setFolders(foldersData ?? []);
    
    setIsLoading(false);
  }
  
  return { recentSets, allSets, folders, isLoading, reload: loadDashboard };
}
```

### 5.2 Progress Tracking — Tính toán chính xác

#### Định nghĩa "Đã thuộc" (Mastered)
```
mastery_level >= 4 → thẻ đã thuộc
mastery_level = 0-3 → đang học
mastery_level = 5 → hoàn toàn thuộc

Progress % = (số thẻ có mastery_level >= 4) / (tổng số thẻ) * 100
```

#### Cập nhật StudySetCard với `progressPercent` và `last_accessed`
```tsx
// Sau Phase 1, StudySetCard đã dùng set.progressPercent ?? 0
// Phase 5 chỉ cần truyền đúng giá trị từ DB thay vì mock
// Thêm hiển thị last_accessed:
<p className="text-xs text-slate-400">{relativeTime(set.last_accessed)}</p>
```

#### Hàm `relativeTime()`
```ts
// Tạo src/utils/time.ts
export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}
```

### 5.3 Cập nhật `last_accessed`

Mỗi khi user mở 1 study set để học, update timestamp:
```ts
// Trong FlashcardView, LearnMode, WriteMode, MockTest khi component mount:
await supabase
  .from('study_sets')
  .update({ last_accessed: new Date().toISOString() })
  .eq('id', setId);
```

### 5.4 Trang "Set Overview" (Thay thế navigate thẳng vào Flashcard)

Khi click vào StudySetCard, thay vì chuyển thẳng vào FlashcardView, nên có trang trung gian:

**Tạo `src/pages/SetOverview.tsx`**
```
URL: /sets/:setId

Layout:
- Header: Title, Description, [Edit] button
- Stats row: "X cards · Y% mastered · Last studied Z"
- Personal Best cho Match: "Best: 12.34s"
- Grid chọn study mode:
  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
  │ 📚 Flashcards│ │ 🧠 Learn     │ │ ✍️ Write     │ │ 📝 Test     │
  │ Browse cards │ │ Multiple     │ │ Type the    │ │ Mixed quiz  │
  │             │ │ choice       │ │ answer      │ │             │
  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
  ┌─────────────┐
  │ ⚡ Match     │
  │ Beat the    │
  │ clock!      │
  └─────────────┘
- Preview list: hiển thị 5 cards đầu (term | definition)
- Nút "View all cards" để toggle show more
```

### 5.5 Progress Bar Nâng cao trong SetOverview

```
Overall: [████████░░] 80% (8/10 cards mastered)

Breakdown by level:
Level 5 (Mastered): ████ 4 cards
Level 4:            ██   2 cards
Level 3:            ██   2 cards
Level 2:            █    1 card
Level 1:            █    1 card
Level 0 (New):         0 cards
```

### 5.6 Navbar — User Profile & Search

#### Cập nhật `src/components/layout/Navbar.tsx`

**Search:**
```
- Thanh search responsive (collapse trên mobile)
- Tìm kiếm live trong tất cả study sets của user (title + description)
- Debounce 300ms trước khi query
- Dropdown kết quả (max 5): icon + title + card count
- Click vào kết quả → navigate về SetOverview/:setId
```

**User Avatar + Dropdown:**
```
- Avatar circle với initial email (e.g., "T" cho thangnguyen@...)
- Click → dropdown:
  - Email user
  - "My Profile" (optional)
  - "Settings" (optional)
  - Divider
  - "Sign Out" → gọi supabase.auth.signOut() → redirect /auth
```

### 5.7 Sidebar — Cập nhật Navigation

Sidebar hiện tại cần được kết nối với dữ liệu thực:

```tsx
// Sidebar sections:
1. "My Library" (link về Dashboard)
2. "Recent Sets" - hiển thị 5 sets gần nhất (từ DB)
3. "Folders" - danh sách folders có thể expand/collapse
   - Click folder → filter Dashboard theo folder
   - "+" để tạo folder mới (inline)
4. Avatar + name ở cuối Sidebar
```

### 5.8 Dashboard — Filter & Sort

#### Filter panel (khi click "Filter" button)
```
Dropdown hoặc drawer:
- Sort by: Last accessed | Alphabetical | Date created | Progress
- Filter by: All | In progress | Mastered (≥80%) | Not started (0%)
- Filter by Folder: All | [Folder 1] | [Folder 2] | ...
```

#### Implementation
```ts
const [sortBy, setSortBy] = useState<'last_accessed' | 'title' | 'progress'>('last_accessed');
const [filterBy, setFilterBy] = useState<'all' | 'in_progress' | 'mastered' | 'new'>('all');
const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

const filteredSets = useMemo(() => {
  let result = allSets;
  
  if (selectedFolder) {
    result = result.filter(s => s.folder_id === selectedFolder);
  }
  
  if (filterBy === 'in_progress') result = result.filter(s => s.progressPercent > 0 && s.progressPercent < 80);
  if (filterBy === 'mastered') result = result.filter(s => s.progressPercent >= 80);
  if (filterBy === 'new') result = result.filter(s => s.progressPercent === 0);
  
  result.sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'progress') return b.progressPercent - a.progressPercent;
    return new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime();
  });
  
  return result;
}, [allSets, sortBy, filterBy, selectedFolder]);
```

### 5.9 "Streak" & Gamification (Bonus)

Nếu có thời gian, thêm học streak (số ngày liên tiếp học):

```sql
-- Bảng activity log (tùy chọn)
CREATE TABLE study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  set_id UUID REFERENCES study_sets NOT NULL,
  mode TEXT,  -- 'flashcard' | 'learn' | 'write' | 'test' | 'match'
  cards_studied INTEGER DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE
);
```

Hiển thị trên Dashboard:
```
🔥 5-day streak! Keep it up!
```

---

## File cần tạo mới
```
src/
  hooks/
    useDashboard.ts       ← Load sets + folders + progress từ DB
  pages/
    SetOverview.tsx       ← Trang trung gian chọn study mode
  utils/
    time.ts               ← relativeTime() helper
  components/
    dashboard/
      ProgressBreakdown.tsx ← Bar chart mastery levels
      FilterPanel.tsx       ← Sort & filter controls
```

## File cần sửa
```
src/
  pages/
    Dashboard.tsx         ← Kết nối hooks + filter/sort
    FlashcardView.tsx     ← Update last_accessed khi mount
    LearnMode.tsx         ← Update last_accessed khi mount
    WriteMode.tsx         ← Update last_accessed khi mount
    MatchGame.tsx         ← Update last_accessed khi mount
  components/
    layout/
      Navbar.tsx          ← Search + user dropdown
      Sidebar.tsx         ← Folders + recent sets từ DB
    dashboard/
      StudySetCard.tsx    ← progressPercent + lastAccessed props
  App.tsx                 ← Thêm route /sets/:setId → SetOverview
```

---

## Thứ tự thực hiện
1. Tạo `useDashboard` hook — load data từ DB
2. Kết nối Dashboard component với hook (thay mock data)
3. Tạo `SetOverview.tsx` với mode selector UI
4. Cập nhật routing qua SetOverview thay vì direct navigate
5. Implement `last_accessed` updates trong tất cả study modes
6. Tạo `time.ts` utils + update StudySetCard UI
7. Implement Filter & Sort panel
8. Update Navbar với search + user dropdown (signOut)
9. Update Sidebar với dữ liệu thực
10. Test toàn bộ flow từ Dashboard → SetOverview → Study → Back

---

## Chú ý kỹ thuật
- **N+1 query:** Dùng Supabase join thay vì loop fetch từng set riêng
- **Realtime updates:** Có thể dùng Supabase Realtime để progress bar update live nếu có nhiều tab
- **Empty states:** Thiết kế UI khi user chưa có set nào (onboarding CTA)
- **Pagination:** Nếu user có > 20 sets, implement "Load more" hoặc infinite scroll
- **Search debounce:** 300ms để tránh spam query khi user đang gõ
