using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VTT.Data;

namespace VTT.Controllers;

public class BoardsController : Controller
{
    private readonly AppDbContext _db;

    public BoardsController(AppDbContext db) => _db = db;

    public async Task<IActionResult> Index()
    {
        var boards = await _db.Boards.Where(b => !b.IsClosed).OrderBy(b => b.Id).ToListAsync();
        return View(boards);
    }

    public async Task<IActionResult> Details(int id)
    {
        var board = await _db.Boards.FindAsync(id);
        return board == null ? NotFound() : View(board);
    }

    [HttpGet]
    public IActionResult Templates()
    {
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UseTemplate(string templateType)
    {
        int me;
        var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(idClaim, out me))
        {
            var u = await _db.Users.OrderBy(u => u.Id).FirstAsync();
            me = u.Id;
        }

        var ws = await _db.Workspaces.OrderBy(w => w.Id).FirstOrDefaultAsync();
        if (ws == null)
        {
            ws = new Models.Workspace { Name = "Không gian làm việc VTT", OwnerId = me };
            _db.Workspaces.Add(ws);
            await _db.SaveChangesAsync();
        }

        Models.Board board;
        string[] columns;
        var starterCards = new List<(int colIdx, string title)>();

        switch (templateType?.ToLowerInvariant())
        {
            case "agile":
                board = new Models.Board
                {
                    WorkspaceId = ws.Id,
                    Title = "Dự án Phát triển Agile / Scrum",
                    Background = "linear-gradient(135deg, #fd79a8 0%, #e84393 100%)",
                    CreatedBy = me
                };
                columns = new[] { "Product Backlog", "Sprint hiện tại", "Đang thực hiện", "Kiểm thử & Review", "Đã hoàn thành" };
                starterCards.Add((0, "Nghiên cứu yêu cầu người dùng"));
                starterCards.Add((1, "Dựng khung giao diện Trello"));
                starterCards.Add((2, "Kết nối API xác thực và phân quyền"));
                starterCards.Add((4, "Khởi tạo cấu trúc Database"));
                break;

            case "marketing":
                board = new Models.Board
                {
                    WorkspaceId = ws.Id,
                    Title = "Kế hoạch Chiến dịch Marketing",
                    Background = "linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%)",
                    CreatedBy = me
                };
                columns = new[] { "Ý tưởng chiến dịch", "Nội dung & Copywriting", "Thiết kế Media", "Phê duyệt & Đăng tải", "Đo lường & Báo cáo" };
                starterCards.Add((0, "Chương trình khuyến mãi mùa hè"));
                starterCards.Add((1, "Bài viết giới thiệu tính năng mới"));
                starterCards.Add((2, "Thiết kế banner poster"));
                break;

            default: // personal
                board = new Models.Board
                {
                    WorkspaceId = ws.Id,
                    Title = "Kế hoạch Công việc Cá nhân",
                    Background = "linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%)",
                    CreatedBy = me
                };
                columns = new[] { "Mục tiêu tháng", "Cần làm hôm nay", "Đang xử lý", "Hoàn thành" };
                starterCards.Add((0, "Học kiến thức ASP.NET Core & EF Core"));
                starterCards.Add((1, "Tập thể dục buổi sáng 30 phút"));
                starterCards.Add((2, "Hoàn thiện báo cáo đồ án phân tán"));
                starterCards.Add((3, "Đọc sách 20 trang"));
                break;
        }

        board.Members.Add(new Models.BoardMember { UserId = me, Role = "Admin" });

        for (var i = 0; i < columns.Length; i++)
        {
            var list = new Models.BoardList
            {
                Title = columns[i],
                Position = (i + 1) * 1024
            };
            board.Lists.Add(list);
        }

        foreach (var sc in starterCards)
        {
            if (sc.colIdx < board.Lists.Count)
            {
                board.Lists[sc.colIdx].Cards.Add(new Models.Card
                {
                    Title = sc.title,
                    Position = 1024,
                    CreatedBy = me
                });
            }
        }

        _db.Boards.Add(board);
        await _db.SaveChangesAsync();

        return RedirectToAction(nameof(Details), new { id = board.Id });
    }
}
