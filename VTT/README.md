# VTT – Hệ thống quản lý công việc nhóm

VTT hiện sử dụng **một backend duy nhất: ASP.NET Core MVC (.NET 10 LTS) + Entity Framework Core + SQL Server**. Ứng dụng Node.js/Express và cơ sở dữ liệu JSON cũ đã được loại khỏi gói chạy để tránh hai hệ thống tài khoản và dữ liệu độc lập. Giao diện Razor/CSS/JavaScript hiện có được giữ lại.

## Yêu cầu
- .NET 10 LTS SDK
- SQL Server 2019+ hoặc SQL Server Express/LocalDB

## Cấu hình SQL Server
Mặc định trong `VTT/appsettings.json` dùng SQL Server LocalDB trên Windows. Có thể ghi đè bằng biến môi trường `ConnectionStrings__DefaultConnection`. Ví dụ SQL Server đăng nhập SQL:

```powershell
$env:ConnectionStrings__DefaultConnection = "Server=localhost;Database=VTT;User Id=sa;Password=YOUR_STRONG_PASSWORD;Encrypt=True;TrustServerCertificate=True"
```

Không lưu mật khẩu SQL thật vào Git hoặc `appsettings.json`.

## Chạy ứng dụng

```powershell
cd VTT
dotnet restore
dotnet run
```

Ứng dụng tự áp dụng các EF Core migrations đã có khi khởi động. SQL Server phải được bật và chuỗi kết nối hợp lệ. Mở URL HTTPS được in trong terminal.

## Tài khoản đầu tiên
Không còn tài khoản demo, mật khẩu mặc định hoặc dữ liệu nghiệp vụ giả. Đăng ký tài khoản đầu tiên qua `/Account/Register`; tài khoản đầu tiên được tạo workspace riêng và vai trò Admin. Các tài khoản đăng ký sau được thêm vào workspace hiện có với vai trò Member. Mật khẩu mới tối thiểu 8 ký tự và được băm bằng ASP.NET Core `PasswordHasher`. Tài khoản cũ dùng SHA-256 sẽ được nâng cấp hash khi đăng nhập thành công.

## Kiến trúc
- `Controllers/`: MVC và API; mọi route yêu cầu đăng nhập theo fallback authorization policy.
- `Models/Entities.cs`: mô hình dữ liệu.
- `Data/AppDbContext.cs`: quan hệ và ràng buộc EF Core.
- `Migrations/`: lịch sử schema SQL Server.
- `Views/` và `wwwroot/`: giao diện hiện tại.

## Ghi chú bảo mật
- Cookie xác thực HttpOnly, Secure, SameSite=Lax.
- Login/register có giới hạn tốc độ.
- API kiểm tra quyền truy cập board và token chống CSRF cho thao tác ghi.
- Không có đăng nhập nhanh demo hoặc fallback tự động vào tài khoản đầu tiên.
- Cần cấu hình HTTPS và sao lưu SQL Server trước khi triển khai production.

## Kiểm thử
Máy phát triển cần chạy `dotnet build` và thử các luồng đăng ký, đăng nhập, tạo bảng, thêm danh sách/thẻ, bình luận, phân quyền và truy cập API bằng tài khoản khác nhau.


## Cấu hình chức năng quên mật khẩu

Chức năng quên mật khẩu gửi liên kết dùng một lần qua SMTP. Cấu hình các khóa sau trong `appsettings.json` hoặc biến môi trường tương ứng (`Smtp__Host`, `Smtp__Port`, ...):

- `Smtp:Host`: máy chủ SMTP
- `Smtp:Port`: cổng SMTP (thường 587)
- `Smtp:EnableSsl`: bật TLS
- `Smtp:From`: địa chỉ gửi
- `Smtp:Username` và `Smtp:Password`: thông tin xác thực SMTP

Không lưu mật khẩu SMTP thật trong mã nguồn khi triển khai; hãy dùng User Secrets hoặc biến môi trường. Liên kết đặt lại có hiệu lực 30 phút, chỉ dùng được một lần. Khi chạy Development và chưa cấu hình SMTP, trang quên mật khẩu hiển thị liên kết thử nghiệm trực tiếp.

Migration `20261119100000_AddPasswordResetTokens` được áp dụng tự động khi ứng dụng khởi động thông qua `Database.Migrate()`.
