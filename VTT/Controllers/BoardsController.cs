using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VTT.Data;
using VTT.Services;

namespace VTT.Controllers;

[Authorize]
public class BoardsController : Controller
{
    private readonly AppDbContext _db;
    private readonly AccessService _access;

    public BoardsController(AppDbContext db, AccessService access)
    { _db = db; _access = access; }

    public async Task<IActionResult> Index()
    {
        var me = _access.UserId;
        var current = await _access.GetOrCreateCurrentAsync();
        if (current == null) return Challenge();

        var wsId = current.WorkspaceId;
        var isAdmin = current.Role == AccessService.Admin;

        // Chỉ hiển thị bảng của workspace đang chọn mà người dùng được phép xem.
        var boards = await _db.Boards.AsNoTracking()
            .Where(b => b.WorkspaceId == wsId && !b.IsClosed &&
                (isAdmin || b.Visibility != AccessService.PrivateBoard || b.Members.Any(m => m.UserId == me)))
            .OrderBy(b => b.Id).ToListAsync();

        ViewBag.MemberCount = await _db.WorkspaceMembers.CountAsync(m => m.WorkspaceId == wsId);
        return View(boards);
    }

    public async Task<IActionResult> Details(int id)
    {
        var access = await _access.GetBoardAccessAsync(id);
        if (access is not { CanView: true }) return NotFound();

        var board = await _db.Boards.AsNoTracking().Include(b => b.Workspace).FirstOrDefaultAsync(b => b.Id == id);
        if (board == null) return NotFound();

        // Mở bảng thuộc workspace khác thì tự chuyển workspace đang làm việc cho khớp.
        var current = await _access.GetCurrentAsync();
        var memberships = await _access.GetMembershipsAsync();
        if (current?.WorkspaceId != board.WorkspaceId && memberships.Any(m => m.WorkspaceId == board.WorkspaceId))
            _access.SetCurrent(board.WorkspaceId);

        ViewBag.CanManage = access.CanManage;
        return View(board);
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
        var me = _access.UserId;
        if (me == 0) return Challenge();

        var current = await _access.GetOrCreateCurrentAsync();
        if (current == null) return Forbid();
        var ws = new { Id = current.WorkspaceId };

        Models.Board board;
        string[] columns;
        var starterCards = new List<(int colIdx, string title)>();

        switch (templateType?.Trim().ToLowerInvariant())
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
                starterCards.Add((1, "Dựng khung giao diện "));
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
