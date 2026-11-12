using VTT.Models;

namespace VTT.Data;

public static class DbInitializer
{
    public const string DefaultBackground = "linear-gradient(135deg,#0c66e4,#8f7ee7)";

    // Tạo dữ liệu mẫu khi CSDL còn trống
    public static void Seed(AppDbContext db)
    {
        if (db.Users.Any()) return;

        var u = new User { Email = "demo@vtt.local", UserName = "demo", FullName = "Demo", PasswordHash = "-" };
        var w = new Workspace { Name = "Không gian làm việc VTT", Owner = u };
        w.Members.Add(new WorkspaceMember { User = u, Role = "Admin" });

        var b = new Board { Workspace = w, Title = "Bảng việc đầu tiên", Background = DefaultBackground, Creator = u };
        b.Members.Add(new BoardMember { User = u, Role = "Admin" });

        string[] names = { "Cần làm", "Đang làm", "Hoàn thành" };
        for (var i = 0; i < names.Length; i++)
            b.Lists.Add(new BoardList { Title = names[i], Position = (i + 1) * 1024 });

        b.Lists[0].Cards.Add(new Card { Title = "Thiết kế giao diện", Position = 1024, Creator = u });
        b.Lists[0].Cards.Add(new Card { Title = "Dựng API", Position = 2048, Creator = u });
        b.Lists[1].Cards.Add(new Card { Title = "Viết báo cáo đồ án", Position = 1024, Creator = u });

        db.Boards.Add(b);
        db.SaveChanges();
    }
}
