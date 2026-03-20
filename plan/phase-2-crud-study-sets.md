# Giai đoạn 2: Quản lý Học liệu (CRUD Operations)

## Tổng quan
Kết nối `SetEditor` và hệ thống folders với Supabase. Bổ sung tính năng upload ảnh cho từng thẻ, hoàn thiện bulk import, và xây dựng giao diện quản lý thư mục.

**Phụ thuộc:** Giai đoạn 1 phải hoàn thành (Supabase + Auth hoạt động).

---

## Trạng thái hiện tại (Đã làm)

### SetEditor (`src/pages/SetEditor.tsx`) — UI hoàn chỉnh, chưa có DB
Form nhập Title + Description
Danh sách card rows (term + definition) có thể thêm/xóa động
Validation: không cho save nếu term/definition trống
Sticky header khi scroll
Nút "Import" mở BulkImportModal
`handleSave()` hiện chỉ `console.log` rồi navigate về, **chưa lưu vào DB** (dùng `useNavigate` từ Phase 1)
Nút upload ảnh (ImageIcon) trong mỗi row — **chưa hoạt động**
`useParams<{ setId }>()` đã có — `editSetId` sẵn sàng nhận khi edit mode

### BulkImportModal (`src/components/editor/BulkImportModal.tsx`) — Cơ bản
Textarea nhận paste text
Tự động parse theo dấu `,` `\t` `;`
Preview 5 cards đầu tiên
Callback `onImport(data)` trả về array `{term, definition}`
- [ ] **Chưa:** Upload file CSV
- [ ] **Chưa:** Kiểm tra trùng lặp khi import

### Dashboard — Folders section
Hiển thị "Your Folders" nhưng chỉ có nút "New Folder" tĩnh
MOCK_FOLDERS đã có `user_id`, `created_at` (cập nhật Phase 1)
- [ ] **Chưa:** Load folders từ DB
- [ ] **Chưa:** Tạo/Xóa folder
- [ ] **Chưa:** Assign study set vào folder

---

## Việc cần làm (TODO)

### 2.1 Kết nối SetEditor với Supabase

#### Thêm routes mới vào `App.tsx` (đã có React Router từ Phase 1)

> **Phase 1 đã setup React Router** với `ProtectedRoute` dùng `<Outlet>` pattern.
> Để thêm routes mới, chỉ cần thêm `<Route>` vào group `<Route element={<ProtectedRoute />}>` trong `App.tsx`.

Routes hiện có:
```
/editor          → SetEditor (create mode)
/editor/:setId   → SetEditor (edit mode — useParams đã có, chưa load data)
```
```ts
// Custom hooks để thao tác với study_sets + flashcards
export function useStudySets() {
  // createStudySet(title, description, folderId?) → insert study_sets + flashcards
  // updateStudySet(setId, title, description, cards) → upsert
  // deleteStudySet(setId) → delete (cascade xóa flashcards, progress)
  // getStudySet(setId) → fetch 1 set + flashcards
  // getStudySets() → fetch tất cả sets của current user
}
```

#### Cập nhật `handleSave()` trong SetEditor
```
1. Lấy user từ AuthContext
2. INSERT vào bảng study_sets → nhận lại id
3. Batch INSERT các cards vào bảng flashcards (set_id = id vừa tạo)
4. Nếu đang edit set có sẵn: UPDATE study_sets + UPSERT flashcards + DELETE cards bị xóa
5. Navigate về Dashboard sau khi save thành công
6. Hiển thị toast thông báo thành công/lỗi
```

**Phân biệt Create vs Edit mode:**
- Route `/editor` → tạo mới
- Route `/editor/:setId` → load data set có sẵn, sau đó UPDATE khi save

#### Fetch set để edit
Khi SetEditor nhận `setId` prop:
```
1. Load study_sets WHERE id = setId AND user_id = auth.uid()
2. Load flashcards WHERE set_id = setId ORDER BY position
3. Populate form với data đã load
4. Track các card bị xóa để DELETE khi save
```

### 2.2 Xử lý Image Upload

**Setup Supabase Storage Bucket:**
```
- Tên bucket: `flashcard-images`
- Public bucket (để dùng public URL)
- Giới hạn file: max 5MB, chỉ allow image/*
```

**Cập nhật card row trong SetEditor:**
```tsx
// Khi user click nút ImageIcon:
1. Mở file input dialog (accept="image/*")
2. Upload file lên Supabase Storage:
   supabase.storage.from('flashcard-images')
     .upload(`${userId}/${setId}/${cardId}-${Date.now()}`, file)
3. Lấy public URL
4. Cập nhật state: row.image_url = publicUrl
5. Hiển thị thumbnail (40x40px) cạnh nút upload
6. Nút X để xóa ảnh (cũng xóa file trên Storage)
```

**UI cho image upload:**
```
- Loading spinner trong khi upload
- Error message nếu file quá lớn hoặc sai format
- Thumbnail preview 48x48, border radius, object-cover
- Hover thumbnail để xem nút xóa ảnh
```

### 2.3 Hoàn thiện BulkImportModal

#### Bổ sung Upload CSV File
```tsx
// Thêm tab/toggle: "Paste Text" | "Upload CSV"
// Phần Upload CSV:
- Input type="file" accept=".csv"
- Đọc file với FileReader API
- Parse CSV: xử lý quoted fields (e.g. "term with, comma", definition)
- Hiển thị preview tương tự paste text
```

#### Kiểm tra trùng lặp
```ts
// Trước khi import:
const existingTerms = new Set(rows.map(r => r.term.toLowerCase().trim()));
const deduplicated = parsedData.filter(
  item => !existingTerms.has(item.term.toLowerCase().trim())
);
const duplicateCount = parsedData.length - deduplicated.length;

// Thông báo: "3 cards were skipped (duplicates)"
```

#### Bổ sung custom separator
```
- Dropdown chọn separator: Tab | Comma | Semicolon | Custom
- Nếu chọn "Custom": hiện input để nhập ký tự phân cách
```

### 2.4 Hệ thống Folder (CRUD)

#### Tạo `src/hooks/useFolders.ts`
```ts
export function useFolders() {
  // getFolders() → load tất cả folders của user + count sets
  // createFolder(name) → INSERT
  // renameFolder(id, newName) → UPDATE
  // deleteFolder(id) → DELETE (study_sets.folder_id sẽ SET NULL)
  // assignSetToFolder(setId, folderId) → UPDATE study_sets SET folder_id
  // removeSetFromFolder(setId) → UPDATE study_sets SET folder_id = NULL
}
```

#### Cập nhật Dashboard — Folders Section
```
Hiển thị folder cards với:
- Icon folder + tên folder
- Số lượng sets trong folder
- Click để xem các sets của folder
- Menu (3 chấm): Rename, Delete

Nút "New Folder":
- Click → mở inline input hoặc modal để đặt tên
- Enter để submit, Escape để hủy
```

#### Tạo `src/components/folders/FolderCard.tsx`
```tsx
interface FolderCardProps {
  folder: Folder & { setCount: number };
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}
```

#### Folder View (trang riêng hoặc modal)
Khi click vào 1 folder:
- Hiển thị tất cả study sets thuộc folder đó
- Layout tương tự Dashboard's Recent Activity grid
- Breadcrumb: "Dashboard > Folder Name"
- Cho phép drag & drop set hoặc dùng dropdown để thay đổi folder

### 2.5 Cập nhật Dashboard — Recent Activity

Thay `MOCK_SETS` bằng data từ Supabase:
```ts
// Query: SELECT * FROM study_sets 
//   WHERE user_id = auth.uid()
//   ORDER BY last_accessed DESC
//   LIMIT 6
```

> **Lưu ý (từ Phase 1):** Field `set.flashcards` (không phải `set.cards`), `set.progressPercent` (không phải `set.progress`). `set.author` đã bị xóa — Sidebar và StudySetCard dùng email user từ `useAuth()`.

Kết hợp với `flashcards count` trong cùng 1 query:
```sql
SELECT s.*, COUNT(f.id) as card_count
FROM study_sets s
LEFT JOIN flashcards f ON f.set_id = s.id
WHERE s.user_id = auth.uid()
GROUP BY s.id
ORDER BY s.last_accessed DESC
LIMIT 6
```

---

## File cần tạo mới
```
src/
  hooks/
    useStudySets.ts       ← CRUD cho study sets
    useFolders.ts         ← CRUD cho folders
  components/
    folders/
      FolderCard.tsx      ← UI card cho folder
      FolderModal.tsx     ← Tạo/rename folder
    common/
      Toast.tsx           ← Toast notification component
```

## File cần sửa
```
src/
  pages/
    SetEditor.tsx         ← Kết nối DB + image upload
    Dashboard.tsx         ← Load data từ DB + folder management
  components/
    editor/
      BulkImportModal.tsx ← Upload CSV + dedup + custom separator
```

---

## Thứ tự thực hiện
1. Tạo `useStudySets` hook với `createStudySet` và `getStudySets`
2. Kết nối Dashboard để load sets từ DB
3. Kết nối SetEditor → save tạo mới set vào DB
4. Test create → view flow
5. Thêm edit mode cho SetEditor (load + update)
6. Setup Supabase Storage bucket
7. Implement image upload trong card rows
8. Bổ sung dedup & CSV upload vào BulkImportModal
9. Tạo `useFolders` hook
10. Update Dashboard Folders section với CRUD thật
11. Test toàn bộ flow

---

## Chú ý kỹ thuật
- **Batch insert flashcards:** Dùng `.insert(arrayOfCards)` một lần thay vì loop từng card
- **Optimistic updates:** Update UI ngay, rollback nếu server trả lỗi (UX tốt hơn)
- **Position tracking:** Khi reorder cards trong editor, cập nhật trường `position` để đảm bảo thứ tự
- **Image cleanup:** Khi xóa card hoặc set, cũng xóa ảnh trên Storage để tránh orphaned files
- **File validation:** Validate file size và MIME type ở client trước khi upload (phòng chống SSRF/malicious upload)
