# VTT - Web quản lý công việc kiểu Trello

Công nghệ: ASP.NET Core MVC (.NET 8), Entity Framework Core 8, SQL Server.

## 1. Yêu cầu cài đặt
- .NET 8 SDK: https://dotnet.microsoft.com/download/dotnet/8.0
- SQL Server hoặc SQL Server LocalDB (đi kèm Visual Studio)
- Công cụ EF Core CLI:

    dotnet tool install --global dotnet-ef

## 2. Cấu hình chuỗi kết nối
Mở `appsettings.json`, sửa `DefaultConnection` nếu không dùng LocalDB.
Ví dụ SQL Server cài riêng:

    Server=localhost;Database=VTT;User Id=sa;Password=MatKhauCuaBan;TrustServerCertificate=True

## 3. Tạo cơ sở dữ liệu
    dotnet restore
    dotnet ef migrations add KhoiTao
    dotnet ef database update

## 4. Chạy ứng dụng
    dotnet run

Mở https://localhost:7100

## 5. Cấu trúc thư mục
- `Models/Entities.cs`: các lớp thực thể (17 bảng)
- `Data/AppDbContext.cs`: DbContext và cấu hình quan hệ
- `Controllers/`: HomeController, BoardsController
- `Views/`: giao diện Razor
- `wwwroot/`: CSS, JS, ảnh

## 6. Đẩy lên git
    git init
    git add .
    git commit -m "Khởi tạo dự án VTT"
