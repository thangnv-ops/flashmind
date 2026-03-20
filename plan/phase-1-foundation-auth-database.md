# Giai đoạn 1: Nền tảng, Auth & Database

## Tổng quan
Thiết lập backend thực sự (Supabase), hệ thống xác thực và lược đồ cơ sở dữ liệu. Thay thế toàn bộ `mockData.ts` bằng dữ liệu thực từ database.

**Tech Stack hiện tại:**
- React 19 + TypeScript + Vite + Tailwind CSS v4
- `@google/genai` (đã có), `motion`, `canvas-confetti`, `lucide-react`
- **Chưa có:** Supabase, react-router-dom, Auth context

---

## Trạng thái hiện tại (Đã làm)
- [x] Cấu trúc project cơ bản (Vite + React + TypeScript)
- [x] UI routing thủ công qua `useState` trong `App.tsx` (`'dashboard' | 'editor' | 'flashcards' | 'match'`)
- [x] Types định nghĩa: `Flashcard`, `StudySet`, `Folder` trong `src/types/index.ts`
- [x] Mock data tĩnh trong `src/mockData.ts` (3 study sets, 2 folders)
- [x] Không có user info, không có auth, không có persistence

---

## Việc cần làm (TODO)

### 1.1 Cài đặt Dependencies

```bash
npm install @supabase/supabase-js react-router-dom
```

### 1.2 Thiết lập Supabase Project
1. Tạo project mới trên [supabase.com](https://supabase.com)
2. Lấy `SUPABASE_URL` và `SUPABASE_ANON_KEY`
3. Tạo file `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
4. Tạo `src/lib/supabase.ts`:
   ```ts
   import { createClient } from '@supabase/supabase-js';
   export const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );
   ```

### 1.3 Thiết kế Schema Database (SQL Migration)

Chạy trong Supabase SQL Editor:

```sql
-- Users được quản lý bởi Supabase Auth (auth.users)
-- Chỉ cần tạo profile table nếu cần thêm thông tin

-- Folders
CREATE TABLE folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study Sets
CREATE TABLE study_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcards
CREATE TABLE flashcards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID REFERENCES study_sets(id) ON DELETE CASCADE NOT NULL,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  image_url TEXT,
  is_starred BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress
CREATE TABLE progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES flashcards(id) ON DELETE CASCADE NOT NULL,
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

-- Match Records (Personal Best)
CREATE TABLE match_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  set_id UUID REFERENCES study_sets(id) ON DELETE CASCADE NOT NULL,
  best_time_ms INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, set_id)
);
```

### 1.4 Row Level Security (RLS) - BẮT BUỘC

```sql
-- Enable RLS trên tất cả bảng
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_records ENABLE ROW LEVEL SECURITY;

-- Policies: chỉ user sở hữu mới được đọc/ghi
CREATE POLICY "Users manage own folders" ON folders
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own study sets" ON study_sets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own flashcards" ON flashcards
  FOR ALL USING (
    set_id IN (SELECT id FROM study_sets WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own progress" ON progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own match records" ON match_records
  FOR ALL USING (auth.uid() = user_id);
```

### 1.5 Hệ thống Auth (Email/Password)

**Tạo `src/contexts/AuthContext.tsx`:**
```
- Cung cấp: user, session, loading state
- Hàm: signIn(email, password), signUp(email, password), signOut()
- Lắng nghe: supabase.auth.onAuthStateChange()
- Wrap toàn bộ app trong AuthProvider
```

**Tạo trang `src/pages/AuthPage.tsx`:**
- Tab chuyển đổi giữa "Sign In" / "Sign Up"
- Form: email input + password input + submit button
- Hiện thông báo lỗi nếu sai credentials
- Redirect sang Dashboard sau khi đăng nhập thành công

### 1.6 Protected Routes (React Router)

Cài đặt `react-router-dom` và refactor routing từ `useState` trong `App.tsx` sang:

```
/ → redirect nếu chưa login → /auth
/auth → AuthPage (public)
/dashboard → Dashboard (protected)
/editor → SetEditor (protected)
/editor/:setId → SetEditor với data có sẵn (protected)
/flashcards/:setId → FlashcardView (protected)
/match/:setId → MatchGame (protected)
```

**Tạo `src/components/layout/ProtectedRoute.tsx`:**
- Kiểm tra `useAuth()` → nếu `!user` thì redirect về `/auth`
- Hiển thị loading spinner trong khi kiểm tra session

### 1.7 Cập nhật Types

Cập nhật `src/types/index.ts` để map với DB schema:
```ts
export interface Flashcard {
  id: string;
  set_id: string;
  term: string;
  definition: string;
  image_url?: string | null;
  is_starred: boolean;
  position: number;
}

export interface StudySet {
  id: string;
  user_id: string;
  folder_id?: string | null;
  title: string;
  description?: string | null;
  last_accessed: string; // ISO timestamp
  created_at: string;
  flashcards?: Flashcard[]; // joined
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}
```

### 1.8 Seed Data (Test)
Sau khi setup xong, viết seed script hoặc chèn data thủ công vào Supabase dashboard để test, thay thế `mockData.ts`.

---

## ✅ TRẠNG THÁI THỰC HIỆN (Completed)

**Đã hoàn thành toàn bộ Phase 1.**

### Thay đổi so với plan và lý do:

| Thay đổi | Lý do |
|---|---|
| `ProtectedRoute` dùng `<Outlet />` (React Router v6 pattern) thay vì `children` prop | Sạch hơn với nested routes của v6; cho phép group nhiều routes trong 1 `<Route element={<ProtectedRoute />}>` |
| Thêm `src/vite-env.d.ts` với `ImportMetaEnv` | tsconfig không có `vite/client` type → `import.meta.env` bị lỗi TS2339 |
| Navbar: bỏ `onCreate` prop, dùng `useNavigate` nội bộ | Không cần truyền prop qua App.tsx nữa khi dùng React Router |
| `App.tsx` dùng `DashboardLayout` component với `<Outlet>` | Tách layout (Navbar + Sidebar) khỏi routes; cleaner than wrapping each route |
| `author` field xóa khỏi `StudySet` type + mockData | Không có trong DB schema; `StudySetCard` hiển thị "You" hardcoded (sẽ thay bằng email user ở Phase 5) |
| `cards` → `flashcards` trong `StudySet` | Align với tên bảng DB |
| `progress: number` → `progressPercent?: number` (optional) | Là computed field từ bảng `progress`, không lưu trực tiếp trong `study_sets` |
| `createdAt: number` → `created_at: string` (ISO) | Align với PostgreSQL `TIMESTAMPTZ` format |
| SQL migration xuất ra `plan/sql/migration.sql` | Reference file để user chạy trong Supabase Dashboard |
| `.env.local.example` thay vì `.env.local` | Không expose credentials; user tự copy + điền |

### File đã tạo mới:
```
src/
  vite-env.d.ts           ← Vite env type declarations (thêm mới, không có trong plan)
  lib/
    supabase.ts           ✅
  contexts/
    AuthContext.tsx       ✅
  pages/
    AuthPage.tsx          ✅
  components/
    layout/
      ProtectedRoute.tsx  ✅ (dùng Outlet pattern)
plan/
  sql/
    migration.sql         ✅ (thêm mới, không có trong plan)
.env.local.example        ✅
```

### File đã sửa:
```
src/
  types/index.ts          ✅ Updated
  mockData.ts             ✅ Updated (user_id, flashcards, is_starred, position, timestamps)
  App.tsx                 ✅ React Router + AuthProvider + DashboardLayout
  main.tsx                ✅ BrowserRouter
  pages/
    Dashboard.tsx         ✅ useNavigate (bỏ props)
    SetEditor.tsx         ✅ useNavigate + useParams (bỏ onBack prop)
    FlashcardView.tsx     ✅ useNavigate + useParams (bỏ setId + onBack props)
    MatchGame.tsx         ✅ useNavigate + useParams (bỏ setId + onBack props)
  components/
    layout/
      Navbar.tsx          ✅ useNavigate, signOut, email avatar (bỏ onCreate prop)
      Sidebar.tsx         ✅ useNavigate (bỏ static active state)
    dashboard/
      StudySetCard.tsx    ✅ flashcards?.length, progressPercent (bỏ author, progress)
```

### Còn cần làm (user action):
1. **Tạo Supabase project** tại supabase.com
2. **Copy** `.env.local.example` → `.env.local` và điền URL + ANON_KEY
3. **Chạy** `plan/sql/migration.sql` trong Supabase SQL Editor

---

## Chú ý kỹ thuật
- **Bảo mật:** Không bao giờ expose `SERVICE_ROLE_KEY` lên frontend, chỉ dùng `ANON_KEY`
- **RLS là bắt buộc:** Mọi bảng đều phải có policy để users không đọc được data của nhau
- **Loading state:** Luôn xử lý loading khi fetch data từ Supabase để tránh flash của trang trống
- **Error handling:** Wrap tất cả Supabase calls trong try/catch và hiển thị lỗi user-friendly
