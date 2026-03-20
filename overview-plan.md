Dưới đây là bản kế hoạch và yêu cầu kỹ thuật chi tiết được thiết kế theo từng bước, tối ưu hóa để làm "prompt" (lệnh) hướng dẫn cho AI Agent thực hiện code dự án web app học tập cá nhân này. 

Về câu hỏi của bạn ở cuối: **Rất khuyến khích bạn cung cấp danh sách Tech Stack dự kiến.** Khi bạn cung cấp sẵn Tech Stack (ví dụ: Next.js, Tailwind CSS, Supabase/Firebase, PostgreSQL...), AI Agent có thể ngay lập tức thiết lập cấu trúc thư mục chuẩn, chọn đúng thư viện UI và viết mã tương thích thay vì phải tự phỏng đoán.

---

### KẾ HOẠCH VÀ YÊU CẦU KỸ THUẬT TRIỂN KHAI (DÀNH CHO AI AGENT)

#### Giai đoạn 1: Thiết lập nền tảng & Cơ sở dữ liệu (Database & Auth)
**Mục tiêu:** Xây dựng khung ứng dụng và kiến trúc dữ liệu cốt lõi để lưu trữ học liệu cá nhân.[1]

*   **1.1 Đăng ký/Đăng nhập (Auth):**
    *   Thiết lập hệ thống xác thực cơ bản (Email/Password).
    *   Bảo vệ các route: Chỉ người dùng đã đăng nhập mới truy cập được vào trang Dashboard và các trang học tập.
*   **1.2 Thiết kế Lược đồ Dữ liệu (Schema):**
    *   Bảng `Users`: Lưu `id`, `email`, `created_at`.
    *   Bảng `Folders`: Lưu `id`, `user_id`, `name`.
    *   Bảng `Study_Sets`: Lưu `id`, `user_id`, `folder_id` (có thể null), `title`, `description`, `last_accessed`.
    *   Bảng `Flashcards`: Lưu `id`, `set_id`, `term`, `definition`, `image_url`, `is_starred` (boolean).
    *   Bảng `Progress`: Lưu `user_id`, `card_id`, `mastery_level` (thang điểm 0-5) để theo dõi độ thành thạo.[2]
    *   Bảng `Match_Records`: Lưu `user_id`, `set_id`, `best_time_ms`.

#### Giai đoạn 2: Quản lý Học liệu (CRUD Operations)
**Mục tiêu:** Cho phép người dùng tạo và tổ chức bộ thẻ.

*   **2.1 Trình tạo & Chỉnh sửa bộ thẻ (Set Creator / Editor):**
    *   **UI:** Form nhập liệu gồm Tiêu đề, Mô tả và danh sách các hàng (term - definition).[2] 
    *   **Logic:** Nút "Thêm thẻ mới" để thêm hàng động. Xác thực dữ liệu (validation) không cho phép lưu thẻ trống.
*   **2.2 Tải lên hình ảnh (Image Upload):**
    *   Tích hợp dịch vụ lưu trữ (Storage).
    *   Tại mỗi hàng thẻ, có nút upload ảnh. Khi upload xong, lưu trả về `image_url` và hiển thị ảnh thumbnail thu nhỏ cạnh thuật ngữ.
*   **2.3 Nhập dữ liệu hàng loạt (Bulk Import):**
    *   Cung cấp một `textarea` để người dùng dán văn bản (Word, Excel) hoặc upload file CSV.
    *   **Logic AI cần xử lý:** Phân tách dữ liệu dựa trên ký tự phân cách (dấu phẩy, tab, hoặc ký tự tùy chỉnh). Bỏ qua các hàng trống hoặc dữ liệu rác, kiểm tra và ngăn chặn các thẻ bị trùng lặp trước khi import vào form.
*   **2.4 Hệ thống Thư mục (Folders):**
    *   Tạo giao diện quản lý thư mục, cho phép người dùng gom nhóm các `Study_Sets` vào thư mục tương ứng.

#### Giai đoạn 3: Các Chế độ Học tập (Study Modes)
**Mục tiêu:** Xây dựng logic UI và thuật toán tương tác cho việc ghi nhớ.

*   **3.1 Chế độ Flashcards (Lật thẻ):**
    *   **UI:** Hiển thị từng thẻ một ở trung tâm màn hình.
    *   **Hiệu ứng:** Sử dụng CSS Transform 3D để tạo hiệu ứng lật thẻ (flip) mượt mà khi người dùng click.
    *   **Điều hướng:** Hỗ trợ phím tắt (Space để lật, Mũi tên Trái/Phải để chuyển thẻ).[2] Cung cấp tùy chọn "Xáo trộn thẻ" (Shuffle) và "Chỉ học thẻ gắn sao" (Starring Terms).[2]
*   **3.2 Chế độ Trắc nghiệm (Learn - Multiple Choice):**
    *   **Thuật toán tạo câu hỏi:** Với mỗi thuật ngữ (đáp án đúng), AI Agent phải query lấy ngẫu nhiên 3 định nghĩa khác trong cùng bộ thẻ đó để làm câu trả lời gây nhiễu (distractors). Xáo trộn vị trí của 4 đáp án này.
    *   **Logic:** Chấm điểm tức thì, chuyển màu Xanh/Đỏ khi chọn đúng/sai.
*   **3.3 Chế độ Tự luận (Write - Text Input):**
    *   Hiển thị Định nghĩa, cung cấp ô Input để người dùng gõ Thuật ngữ.
    *   **Xác thực:** So sánh chuỗi không phân biệt hoa/thường (case-insensitive) và loại bỏ khoảng trắng thừa ở đầu/cuối (trimming).
*   **3.4 Chế độ Kiểm tra (Mock Test):**
    *   Tạo một bài thi tổng hợp bằng cách kết hợp ngẫu nhiên: 50% câu hỏi Trắc nghiệm, 50% câu hỏi Tự luận. Tính điểm số % cuối cùng.

#### Giai đoạn 4: Trò chơi & Tương tác (Match Game)
**Mục tiêu:** Trò chơi hóa việc học với áp lực thời gian.

*   **4.1 Trò chơi Ghép thẻ (Match Game):**
    *   **Thiết lập lưới:** Tách 6-8 thẻ thành các mảnh Thuật ngữ và Định nghĩa riêng biệt (tổng cộng 12-16 khối), xáo trộn ngẫu nhiên và hiển thị lên một lưới (Grid).
    *   **Tương tác:** Cho phép người dùng click lần lượt 2 khối. Nếu khớp (cùng `card_id`), cả hai khối sẽ biến mất (ẩn CSS). Nếu sai, báo viền đỏ và lắc nhẹ.
*   **4.2 Đồng hồ bấm giờ & Kỷ lục (Timer & Personal Best):**
    *   Bắt đầu đếm giây (millisecond) ngay khi người dùng click khối đầu tiên.
    *   Khi tất cả khối biến mất, dừng timer.
    *   So sánh kết quả với `best_time_ms` trong cơ sở dữ liệu. Nếu nhanh hơn, cập nhật "Kỷ lục cá nhân mới" (Personal Best) và hiển thị pháo hoa chúc mừng.

#### Giai đoạn 5: Theo dõi Tiến độ (Tracking & Dashboard)
**Mục tiêu:** Hiển thị lịch sử và mức độ hoàn thành.

*   **5.1 Lịch sử học tập (Recent Activity):**
    *   Tại trang chủ, hiển thị danh sách các bộ thẻ vừa truy cập gần nhất, sắp xếp dựa trên trường `last_accessed`.
*   **5.2 Thống kê tiến độ % (Progress Tracking):**
    *   Ghi nhận tiến độ mỗi khi người dùng hoàn thành một thẻ ở chế độ Trắc nghiệm/Tự luận (cập nhật bảng `Progress`).
    *   Tính toán phần trăm: `(Số thẻ đã thuộc / Tổng số thẻ) * 100` và hiển thị bằng thanh Progress Bar trực quan tại giao diện bộ thẻ.[2]

---
Bạn có thể chia sẻ danh sách Tech Stack mà bạn ưu tiên để tôi có thể tinh chỉnh lại yêu cầu, hoặc bạn có thể copy trực tiếp bản kế hoạch này cùng Tech Stack của bạn gửi cho AI Agent để bắt đầu code ngay!