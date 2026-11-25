# VTT – Hệ thống quản lý công việc nhóm

VTT hiện sử dụng **một backend duy nhất: ASP.NET Core MVC (.NET 8) + Entity Framework Core + SQL Server**. Ứng dụng Node.js/Express và cơ sở dữ liệu JSON cũ đã được loại khỏi gói chạy để tránh hai hệ thống tài khoản và dữ liệu độc lập. Giao diện Razor/CSS/JavaScript hiện có được giữ lại.

## Yêu cầu
- .NET 8 SDK
- SQL Server 2019+ hoặc SQL Server Express/LocalDB

## Cấu hình SQL Server
Mặc định trong `VTT/appsettings.json` dùng SQL Server LocalDB trên Windows. Có thể ghi đè bằng biến môi trường `ConnectionStrings__DefaultConnection`. Ví dụ SQL Server đăng nhập SQL:

```powershell
$env:ConnectionStrings__DefaultConnection = "Server=localhost;Database=VTT;User Id=sa;Password=YOUR_STRONG_PASSWORD;Encrypt=True;TrustServerCertificate=True"
```

Không lưu mật khẩu SQL thật vào Git hoặc `appsettings.json`.

## HTTPS (bắt buộc)
Ứng dụng chạy bằng HTTPS: cookie đăng nhập và chống CSRF đều ở chế độ `Secure`, địa chỉ http tự chuyển sang https. Lần đầu trên máy mới, tạo và tin cậy chứng chỉ phát triển:

```powershell
dotnet dev-certs https --clean
dotnet dev-certs https --trust
```

Mở **https://localhost:7100** và gõ đủ `https://` (Chrome tự hiểu `localhost:7100` là http nên sẽ lỗi). http://localhost:5100 sẽ tự chuyển sang https. Đổi cổng bằng `HttpsPort` hoặc `--urls`. Khi triển khai thật, dùng chứng chỉ thật hoặc reverse proxy và đặt `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true`.

## Chạy ứng dụng

```powershell
cd VTT
dotnet restore
dotnet run
```

Ứng dụng tự áp dụng các EF Core migrations đã có khi khởi động. SQL Server phải được bật và chuỗi kết nối hợp lệ. Mở URL HTTPS được in trong terminal.

## Không gian làm việc (workspace) và phân quyền
- Mỗi tài khoản đăng ký mới có **workspace riêng** (kèm bảng "Công việc của tôi"). Người khác **chỉ vào chung khi được quản trị viên mời** ở trang *Thành viên nhóm*.
- Một người có thể thuộc nhiều workspace; chọn/tạo workspace ở thanh bên. Có thể rời workspace (trừ chủ sở hữu).
- Vai trò `Admin`/`Member` theo từng workspace, luôn đọc từ CSDL (không lưu trong cookie). Bị xóa khỏi workspace thì mất quyền ngay, kể cả quyền trên bảng và thẻ.
- Bảng có quyền xem `Workspace` (mọi thành viên) hoặc `Private` (chỉ thành viên bảng và Admin workspace).
- Xóa thẻ: người tạo thẻ hoặc quản trị viên. Xóa danh sách/bảng: quản trị viên bảng hoặc workspace.

## Dữ liệu mẫu
Tự thêm khi chạy ở môi trường **Development** (hoặc đặt `Seed:DemoData=true`); tắt bằng `Seed:DemoData=false`. Mật khẩu mẫu lấy từ `Seed:DemoPassword` (mặc định `Vtt@12345`; **đừng bật ở production**).

| Tài khoản | Workspace |
|---|---|
| an.nguyen@vtt.local (Admin, chủ sở hữu) | Nhóm Đồ án Phân tán + riêng |
| binh.tran@vtt.local (Admin) | Nhóm Đồ án Phân tán + riêng |
| chi.le@vtt.local (Member) | Nhóm Đồ án Phân tán + riêng (không thấy bảng Riêng tư) |
| dung.pham@vtt.local | Chỉ workspace riêng (không thấy nhóm) |

Tài khoản đăng ký thật không có dữ liệu mẫu. Mật khẩu tối thiểu 8 ký tự, gồm chữ và số.

## Kiến trúc
- `Controllers/`: MVC và API; mọi route yêu cầu đăng nhập theo fallback authorization policy.
- `Models/Entities.cs`: mô hình dữ liệu.
- `Data/AppDbContext.cs`: quan hệ và ràng buộc EF Core.
- `Migrations/`: lịch sử schema SQL Server.
- `Views/` và `wwwroot/`: giao diện hiện tại.

## Ghi chú bảo mật
- Cookie xác thực HttpOnly, Secure, SameSite=Lax.
- Login/register có giới hạn tốc độ; API giới hạn theo người dùng (HTTP 429).
- Mọi API thay đổi dữ liệu (POST/PUT/DELETE) yêu cầu token chống CSRF.
- Kiểm tra dữ liệu phía server (độ dài, định dạng ngày, màu nền, vai trò); lỗi API trả JSON `{ "message": "..." }` bằng tiếng Việt.
- Header bảo mật (CSP, X-Frame-Options, nosniff...). Đổi mật khẩu cần mật khẩu hiện tại.
- Khi triển khai thật, đặt `AllowedHosts` đúng tên miền (liên kết đặt lại mật khẩu dùng host của request).
- API kiểm tra quyền truy cập board và token chống CSRF cho thao tác ghi.
- Không có đăng nhập nhanh demo hoặc fallback tự động vào tài khoản đầu tiên.
- Cần cấu hình HTTPS và sao lưu SQL Server trước khi triển khai production.

## Kiểm thử
Máy phát triển cần chạy `dotnet build` và thử các luồng đăng ký, đăng nhập, tạo bảng, thêm danh sách/thẻ, bình luận, phân quyền và truy cập API bằng tài khoản khác nhau.
