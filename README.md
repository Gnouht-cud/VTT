# VTT - Hệ Thống Quản Lý Công Việc Phân Tán Kiểu Trello

Dự án được xây dựng với kiến trúc hiện đại, hỗ trợ đồng bộ dữ liệu thời gian thực giữa nhiều máy trạm:
- **Phần Giao diện (Frontend)**: Xây dựng hoàn toàn bằng **Node.js** (Express, EJS, Socket.IO, CSS pastel pink `#fd79a8`).
- **Phần Backend**: **ASP.NET Core (.NET 8)** & SQL Server trong thư mục `VTT/`.
- **Cấu trúc thư mục View**: Đã chuẩn hóa chỉ dùng **duy nhất 1 thư mục `views/`** (đã loại bỏ junction `View` trùng lặp trước đây).

---

## 1. Khởi chạy nhanh Giao diện Website (Node.js)

Tại thư mục dự án `d:\He_Phan_Tan\VTT`:

```bash
# Cách 1: Chạy ngay tại thư mục gốc
npm start

# Cách 2: Vào thư mục frontend
cd frontend
npm start
```

Mở trình duyệt truy cập: **`http://localhost:3000`**

---

## 2. Danh sách tài khoản thử nghiệm có sẵn

| Tên người dùng | Email / Tài khoản | Mật khẩu | Vai trò | Trạng thái ban đầu |
|---|---|---|---|---|
| **Demo User** | `demo@vtt.local` hoặc `demo` | `demo` | Quản trị viên (Admin) | Hoạt động (Có nút bấm 1-click đăng nhập nhanh) |
| **Quản Trị Viên** | `admin@vtt.local` hoặc `admin` | `123456` | Quản trị viên (Admin) | Hoạt động |
| **Trần Thị Mai** | `mai.tran@vtt.local` hoặc `maitran` | `123456` | Thành viên (Member) | Hoạt động |
| **Lê Hoàng Nam** | `nam.le@vtt.local` hoặc `namle` | `123456` | Thành viên (Member) | Hoạt động |
| **Người Bị Khóa** | `khoa.user@vtt.local` hoặc `userbikhoa` | `123456` | Thành viên (Member) | 🔒 **Đã bị khóa** (Dùng để test tính năng chặn đăng nhập) |

---

## 3. Tổng hợp 7 Nhóm chức năng đã hoàn thiện

### Nhóm 1: Quản lý tài khoản
- **Đăng ký**: Tại `/register`, kiểm tra email, username trùng, độ dài mật khẩu.
- **Đăng nhập**: Tại `/login`, hỗ trợ ghi nhớ đăng nhập và nút "⚡ Đăng nhập bằng tài khoản Demo".
- **Đăng xuất**: Tại `/logout`, xóa phiên làm việc an toàn.
- **Cập nhật hồ sơ & Đổi mật khẩu**: Tại `/account/profile`, sửa họ tên, đổi mật khẩu mới.
- **Khóa / Mở khóa tài khoản**:
  - Dành cho Quản trị viên tại menu `/admin/users` (hoặc bấm pill Admin trên Header).
  - Admin có thể bấm nút **Khóa** hoặc **Mở khóa** bất kỳ tài khoản nào.
  - Tài khoản bị khóa sẽ **bị chặn đăng nhập ngay lập tức** kèm thông báo rõ ràng; nếu đang online sẽ nhận tín hiệu đăng xuất từ máy chủ.

### Nhóm 2: Quản lý nhóm và thành viên
- **Tạo nhóm**: Tại `/workspace/create`, nhập tên nhóm, mô tả, chọn phân loại lĩnh vực.
- **Sửa thông tin nhóm**: Tại `/workspace/settings`, chỉnh sửa tên và mục tiêu của không gian làm việc.
- **Mời / thêm thành viên**: Tại `/workspace/members`, thêm thành viên theo email hoặc username, gán vai trò ban đầu.
- **Phân quyền trong nhóm**: Hỗ trợ 4 cấp độ: *Quản trị viên (Admin)*, *Quản lý (Manager)*, *Thành viên (Member)*, *Quan sát viên (Viewer)* với dropdown cập nhật trực tiếp.
- **Xóa thành viên & Rời nhóm**: Admin có thể xóa thành viên; người dùng thông thường có nút **🚪 Rời nhóm**.

### Nhóm 3: Quản lý công việc
- **Tạo, sửa, xóa công việc**:
  - Tạo nhanh dưới chân cột Kanban (+ Thêm thẻ) hoặc tạo chi tiết.
  - Chỉnh sửa tiêu đề, mô tả chi tiết, ngày hết hạn trong Modal chi tiết.
  - Xóa vĩnh viễn công việc với hộp thoại xác nhận.
- **Giao việc**: Giao cho một hoặc nhiều thành viên trong nhóm trực tiếp từ checkbox trong modal; hiển thị avatar người phụ trách ngay trên thẻ Kanban.
- **Đặt mức ưu tiên**: 4 cấp độ trực quan có màu sắc nổi bật: 🔴 *Khẩn cấp*, 🟠 *Cao*, 🟡 *Trung bình*, 🟢 *Thấp*.
- **Đặt thời hạn**: Chọn ngày giờ hết hạn; tự động cảnh báo màu đỏ nếu quá hạn, màu cam nếu sắp đến hạn (<24h).
- **Tìm kiếm, lọc**: Ô tìm kiếm live search từ khóa; bộ lọc theo mức ưu tiên và lọc theo hạn chót (quá hạn / sắp đến hạn).
- **Hiển thị dạng bảng Kanban**: Bố cục 4 cột tiêu chuẩn mượt mà, hỗ trợ kéo thả thẻ và thêm danh sách mới.

### Nhóm 4: Cập nhật tiến độ
- **Đổi trạng thái**:
  - 4 trạng thái chuẩn: **Cần làm**, **Đang làm**, **Chờ duyệt**, **Hoàn thành**.
  - Đổi trạng thái bằng cách kéo thả giữa các cột hoặc chọn dropdown trạng thái trong Modal chi tiết thẻ.
- **Cập nhật phần trăm hoàn thành (0% - 100%)**:
  - Thanh trượt % trong Modal chi tiết; tự động đặt 100% khi thẻ chuyển sang cột "Hoàn thành".
  - Hiển thị thanh tiến độ (Progress bar) trực quan trên từng thẻ Kanban.
- **Xem lịch sử thay đổi (Audit Trail)**:
  - Tab "🕒 Lịch sử thay đổi" trong Modal thẻ ghi lại chi tiết ai đã tạo, ai chuyển cột, ai cập nhật %, ai đổi độ ưu tiên và thời gian chính xác.

### Nhóm 5: Thông báo và trao đổi
- **Hệ thống thông báo**:
  - Tự động tạo thông báo khi được giao việc, khi trạng thái công việc thay đổi, khi công việc sắp đến hạn.
  - Nút chuông trên Header có chấm đỏ báo số lượng chưa đọc, popup danh sách thông báo và nút "Đọc tất cả".
- **Bình luận theo công việc**: Tab "💬 Bình luận" trong Modal thẻ cho phép trao đổi, gửi nhanh bằng phím `Ctrl + Enter`.
- **Trò chuyện nhóm (Team Chat)**:
  - Cửa sổ chat nổi góc dưới màn hình và menu thanh bên.
  - Trao đổi tin nhắn tức thì giữa tất cả các thành viên qua Socket.IO.

### Nhóm 6: Đồng bộ và thời gian thực
- **Đẩy thay đổi tới các Client đang mở**: Sử dụng Socket.IO; khi mở 2 tab/trình duyệt song song, thao tác tạo thẻ, kéo thẻ, đổi tiến độ, bình luận, chat đều hiển thị ngay lập tức ở các tab khác.
- **Phát hiện xung đột (Conflict Detection)**:
  - Thẻ được quản lý theo số hiệu `version`.
  - Khi 2 người cùng sửa 1 thẻ, server phát hiện xung đột và trả về HTTP 409.
  - Giao diện bật hộp thoại cảnh báo xung đột cho phép: **Tải lại dữ liệu mới nhất** hoặc **Ghi đè thay đổi**.
- **Đồng bộ lại sau khi mất kết nối**:
  - Thanh trạng thái kết nối hiển thị góc dưới: *Đã kết nối* (Xanh) / *Mất kết nối - Đang thử lại* (Vàng) / *Ngoại tuyến* (Đỏ).
  - Khi kết nối được khôi phục, hệ thống tự động gọi API đồng bộ lại toàn bộ dữ liệu bảng mới nhất.
  - Có nút "Đồng bộ ngay" để ép đồng bộ thủ công bất kỳ lúc nào.

### Nhóm 7: Thống kê, báo cáo
- Trang Báo cáo Thống kê tại `/reports`:
  - **Thẻ chỉ số tổng quan**: Tổng số việc, tỷ lệ hoàn thành (%), số việc đang làm, chờ duyệt, quá hạn.
  - **Biểu đồ phân bổ trạng thái**: Thanh tỷ lệ phần trăm phân bổ trực quan 4 trạng thái.
  - **Bảng thống kê theo thành viên**: Đếm số việc được giao, đã xong, đang làm, quá hạn và tỷ lệ hoàn thành của từng cá nhân.
  - **Danh sách công việc quá hạn**: Bảng cảnh báo đỏ chi tiết các việc quá hạn chót, người phụ trách và số ngày bị trễ.
