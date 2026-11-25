using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using VTT.Models;
using VTT.Services;

namespace VTT.Data;

// Cấu trúc CSDL do EF Core migrations quản lý. Lớp này chỉ thêm dữ liệu MẪU để chạy thử/demo,
// được bật bằng cấu hình Seed:DemoData (mặc định chỉ bật khi chạy ở môi trường Development).
public static class DbInitializer
{
    public const string DefaultBackground = "linear-gradient(135deg,#0c66e4,#8f7ee7)";
    public const string DefaultDemoPassword = "Vtt@12345";

    private const string Sunrise = "linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%)";
    private const string Lavender = "linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%)";
    private const string Mint = "linear-gradient(135deg, #55efc4 0%, #81ecec 100%)";
    private const string Ocean = "linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%)";

    /// <summary>
    /// Thêm 4 tài khoản mẫu, mỗi người một workspace riêng, cùng một workspace nhóm
    /// (chỉ An, Bình, Chi tham gia) để minh họa việc tách workspace và mời thành viên.
    /// Chỉ chạy nếu tài khoản mẫu chưa tồn tại nên có thể gọi nhiều lần.
    /// </summary>
    public static async Task SeedDemoDataAsync(AppDbContext db, IPasswordHasher<User> hasher, string password, ILogger logger)
    {
        if (await db.Users.AnyAsync(u => u.Email == "an.nguyen@vtt.local")) return;

        await using var tx = await db.Database.BeginTransactionAsync();

        User NewUser(string userName, string fullName)
        {
            var u = new User { UserName = userName, FullName = fullName, Email = $"{userName}@vtt.local" };
            u.PasswordHash = hasher.HashPassword(u, password);
            return u;
        }

        var an = NewUser("an.nguyen", "Nguyễn Văn An");
        var binh = NewUser("binh.tran", "Trần Thị Bình");
        var chi = NewUser("chi.le", "Lê Minh Chi");
        var dung = NewUser("dung.pham", "Phạm Quốc Dũng");
        db.Users.AddRange(an, binh, chi, dung);
        await db.SaveChangesAsync();

        var now = DateTime.Now;
        DateTime Day(int days, int hour = 17) => now.Date.AddDays(days).AddHours(hour);

        // ---- Workspace nhóm: An (chủ sở hữu), Bình & Chi được mời ----
        var team = new Workspace
        {
            Name = "Nhóm Đồ án Phân tán",
            Description = "Không gian chung của nhóm thực hiện đồ án Hệ thống quản lý công việc VTT.",
            OwnerId = an.Id
        };
        team.Members.Add(new WorkspaceMember { UserId = an.Id, Role = AccessService.Admin, JoinedAt = now.AddDays(-30).ToUniversalTime() });
        team.Members.Add(new WorkspaceMember { UserId = binh.Id, Role = AccessService.Admin, JoinedAt = now.AddDays(-28).ToUniversalTime() });
        team.Members.Add(new WorkspaceMember { UserId = chi.Id, Role = AccessService.Member, JoinedAt = now.AddDays(-21).ToUniversalTime() });

        var sprint = NewBoard("Đồ án VTT - Sprint 1", Sunrise, "Workspace", an.Id, new[] { an.Id, binh.Id, chi.Id });
        sprint.Lists.Add(NewList("Backlog", 1,
            NewCard("Viết tài liệu đặc tả yêu cầu", an.Id, "Tổng hợp yêu cầu chức năng và phi chức năng của hệ thống.", Day(5)),
            NewCard("Thiết kế sơ đồ ERD / UML", binh.Id, "Vẽ ERD cho CSDL và sơ đồ use case, sequence cho các chức năng chính.", Day(3)),
            NewCard("Chuẩn bị bản demo cuối kỳ", an.Id, null, Day(14))));

        var doing = NewList("Đang thực hiện", 2,
            NewCard("Tách workspace theo từng người dùng", an.Id, "Mỗi tài khoản có workspace riêng, chỉ vào chung khi được mời.", now.AddHours(10)),
            NewCard("Chức năng xóa thẻ, danh sách và bảng", binh.Id, "Phân quyền: chỉ quản trị viên hoặc người tạo thẻ mới được xóa.", Day(-2)),
            NewCard("Cập nhật giao diện ngày hết hạn", chi.Id, "Hiển thị trạng thái quá hạn / sắp đến hạn / đã hoàn thành.", Day(2)));
        doing.Cards[0].Comments.Add(new Comment { UserId = binh.Id, Content = "Nhớ kiểm tra trường hợp người dùng bị xóa khỏi workspace nhé.", CreatedAt = DateTime.UtcNow.AddHours(-5) });
        doing.Cards[0].Comments.Add(new Comment { UserId = an.Id, Content = "Ok, mình đã thu hồi quyền trên bảng khi xóa thành viên.", CreatedAt = DateTime.UtcNow.AddHours(-3) });
        doing.Cards[1].Comments.Add(new Comment { UserId = an.Id, Content = "Đã quá hạn 2 ngày, Bình cập nhật tiến độ giúp mình.", CreatedAt = DateTime.UtcNow.AddHours(-1) });
        sprint.Lists.Add(doing);

        sprint.Lists.Add(NewList("Đang review", 3,
            NewCard("Kiểm tra dữ liệu đầu vào và xử lý lỗi API", chi.Id, "Validate phía server, trả thông báo lỗi tiếng Việt thống nhất.", Day(1, 9))));

        var done = NewList("Hoàn thành", 4,
            NewCard("Khởi tạo cấu trúc CSDL SQL Server", an.Id, "Migration KhoiTao đã chạy thành công.", Day(-7), done: true),
            NewCard("Đăng nhập / đăng ký / quên mật khẩu", binh.Id, null, Day(-4), done: true));
        sprint.Lists.Add(done);

        // Một thẻ đã lưu trữ để thử chức năng khôi phục / xóa vĩnh viễn.
        var archivedCard = NewCard("Ý tưởng cũ: dùng Node.js + Socket.IO", an.Id, "Đã thay bằng ASP.NET Core MVC.", null, archived: true, position: 3 * 1024);
        done.Cards.Add(archivedCard);

        var marketing = NewBoard("Kế hoạch Truyền thông ra mắt", Lavender, "Workspace", binh.Id, new[] { binh.Id, an.Id, chi.Id });
        marketing.Lists.Add(NewList("Ý tưởng", 1,
            NewCard("Chuỗi bài viết giới thiệu tính năng", chi.Id, null, Day(6)),
            NewCard("Video demo 60 giây", binh.Id, null, Day(10))));
        marketing.Lists.Add(NewList("Đang làm", 2,
            NewCard("Thiết kế banner và poster", chi.Id, "Tông hồng pastel #fd79a8 theo nhận diện của VTT.", Day(1))));
        marketing.Lists.Add(NewList("Đã đăng", 3,
            NewCard("Bài đăng thông báo kế hoạch đồ án", binh.Id, null, Day(-3), done: true)));

        // Bảng riêng tư: chỉ An & Bình (Chi là thành viên workspace nhưng không thấy bảng này).
        var internalBoard = NewBoard("Hồ sơ nội bộ (Riêng tư)", Ocean, "Private", an.Id, new[] { an.Id, binh.Id });
        internalBoard.Lists.Add(NewList("Chi phí & tài khoản", 1,
            NewCard("Gia hạn tên miền và hosting", an.Id, "Chỉ quản trị viên xem được bảng này.", Day(20)),
            NewCard("Tổng hợp chi phí đồ án", binh.Id, null, Day(12))));
        internalBoard.Lists.Add(NewList("Biên bản họp", 2,
            NewCard("Biên bản họp nhóm tuần 3", an.Id, "Thống nhất tách workspace và bổ sung phân quyền.", Day(-5), done: true)));

        team.Boards.Add(sprint);
        team.Boards.Add(marketing);
        team.Boards.Add(internalBoard);
        db.Workspaces.Add(team);

        // ---- Mỗi người một workspace cá nhân (không ai khác nhìn thấy) ----
        foreach (var (user, tasks) in new[]
        {
            (an, new[] { "Đọc tài liệu ASP.NET Core Identity", "Ôn tập môn Hệ thống phân tán" }),
            (binh, new[] { "Hoàn thiện báo cáo chương 3", "Tập thể dục buổi sáng" }),
            (chi, new[] { "Soạn slide thuyết trình", "Đặt lịch họp nhóm" }),
            (dung, new[] { "Làm bài tập Cơ sở dữ liệu", "Chuẩn bị phỏng vấn thực tập", "Đọc sách 20 trang" })
        })
        {
            var personal = WorkspaceFactory.CreateWithDefaultBoard(user.Id, $"Không gian của {user.FullName}");
            var todo = personal.Boards[0].Lists[0];
            var i = 0;
            foreach (var t in tasks)
                todo.Cards.Add(NewCard(t, user.Id, null, i == 0 ? Day(2) : null, position: ++i * 1024));
            db.Workspaces.Add(personal);
        }

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        logger.LogInformation(
            "Đã thêm dữ liệu mẫu. Tài khoản: an.nguyen / binh.tran / chi.le / dung.pham (@vtt.local), mật khẩu mẫu theo cấu hình Seed:DemoPassword.");
    }

    private static Board NewBoard(string title, string background, string visibility, int creatorId, IEnumerable<int> memberIds)
    {
        var board = new Board { Title = title, Background = background, Visibility = visibility, CreatedBy = creatorId };
        foreach (var id in memberIds)
            board.Members.Add(new BoardMember { UserId = id, Role = id == creatorId ? AccessService.Admin : AccessService.Member });
        return board;
    }

    private static BoardList NewList(string title, int index, params Card[] cards)
    {
        var list = new BoardList { Title = title, Position = index * 1024 };
        var i = 0;
        foreach (var c in cards)
        {
            c.Position = ++i * 1024;
            list.Cards.Add(c);
        }
        return list;
    }

    private static Card NewCard(string title, int createdBy, string? description = null, DateTime? due = null,
        bool done = false, bool archived = false, double position = 1024) =>
        new()
        {
            Title = title,
            Description = description,
            DueDate = due,
            IsDueDone = done,
            IsArchived = archived,
            CreatedBy = createdBy,
            Position = position
        };
}
