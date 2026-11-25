using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using VTT.Data;
using VTT.Models;
using VTT.Services;

namespace VTT.Controllers;

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
public class ApiController : ControllerBase
{
    private const string DueFmt = "yyyy-MM-ddTHH:mm";
    private const int MaxListsPerBoard = 50;
    private const int MaxCardsPerList = 500;

    private readonly AppDbContext _db;
    private readonly AccessService _access;

    public ApiController(AppDbContext db, AccessService access)
    { _db = db; _access = access; }

    private int MeId => _access.UserId;

    // ------------------------------------------------------------------
    // Phản hồi lỗi thống nhất: { "message": "..." }
    // ------------------------------------------------------------------
    private ObjectResult Fail(int status, string message) => StatusCode(status, new { message });
    private ObjectResult NotFoundMsg() => Fail(404, "Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.");
    private ObjectResult Forbidden(string message) => Fail(403, message);

    // ------------------------------------------------------------------
    // DTO + ràng buộc dữ liệu đầu vào
    // ------------------------------------------------------------------
    public class NewBoard
    {
        [Required(ErrorMessage = "Vui lòng nhập tiêu đề bảng.")]
        [StringLength(100, ErrorMessage = "Tiêu đề bảng tối đa 100 ký tự.")]
        public string Title { get; set; } = "";

        [StringLength(200, ErrorMessage = "Màu nền không hợp lệ.")]
        public string? Background { get; set; }

        [StringLength(20)]
        public string? Visibility { get; set; }
    }

    public class NewList
    {
        [Range(1, int.MaxValue, ErrorMessage = "Mã bảng không hợp lệ.")]
        public int BoardId { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập tên danh sách.")]
        [StringLength(100, ErrorMessage = "Tên danh sách tối đa 100 ký tự.")]
        public string Title { get; set; } = "";
    }

    public class EditList
    {
        [Required(ErrorMessage = "Vui lòng nhập tên danh sách.")]
        [StringLength(100, ErrorMessage = "Tên danh sách tối đa 100 ký tự.")]
        public string Title { get; set; } = "";
    }

    public class NewCard
    {
        [Range(1, int.MaxValue, ErrorMessage = "Mã danh sách không hợp lệ.")]
        public int ListId { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập tiêu đề thẻ.")]
        [StringLength(200, ErrorMessage = "Tiêu đề thẻ tối đa 200 ký tự.")]
        public string Title { get; set; } = "";
    }

    public class EditCard
    {
        [StringLength(200, ErrorMessage = "Tiêu đề thẻ tối đa 200 ký tự.")]
        public string? Title { get; set; }

        [StringLength(10000, ErrorMessage = "Mô tả tối đa 10.000 ký tự.")]
        public string? Description { get; set; }

        [StringLength(32, ErrorMessage = "Ngày hết hạn không hợp lệ.")]
        public string? Due { get; set; }

        public bool? DueDone { get; set; }
        public int? ListId { get; set; }
        public double? Position { get; set; }
        public bool? Archive { get; set; }
    }

    public class NewComment
    {
        [Required(ErrorMessage = "Vui lòng nhập nội dung bình luận.")]
        [StringLength(2000, ErrorMessage = "Bình luận tối đa 2.000 ký tự.")]
        public string Content { get; set; } = "";
    }

    // ------------------------------------------------------------------
    // Bảng
    // ------------------------------------------------------------------
    [HttpGet("api/boards/{id:int}")]
    public async Task<IActionResult> GetBoard(int id)
    {
        var access = await _access.GetBoardAccessAsync(id);
        if (access is not { CanView: true }) return NotFoundMsg();

        var data = await _db.Boards.AsNoTracking().Where(b => b.Id == id).Select(b => new
        {
            b.Id,
            b.Title,
            Lists = b.Lists.Where(l => !l.IsArchived).OrderBy(l => l.Position).Select(l => new
            {
                l.Id,
                l.Title,
                Cards = l.Cards.Where(c => !c.IsArchived).OrderBy(c => c.Position).Select(c => new
                {
                    c.Id,
                    c.Title,
                    c.Position,
                    c.DueDate,
                    c.IsDueDone,
                    c.CreatedBy,
                    HasDesc = c.Description != null && c.Description != "",
                    Comments = c.Comments.Count
                })
            })
        }).FirstOrDefaultAsync();

        if (data == null) return NotFoundMsg();
        return Ok(new
        {
            data.Id,
            data.Title,
            CanManage = access.CanManage,
            Me = MeId,
            data.Lists
        });
    }

    [HttpGet("api/boards/{id:int}/archived")]
    public async Task<IActionResult> GetArchivedCards(int id)
    {
        var access = await _access.GetBoardAccessAsync(id);
        if (access is not { CanView: true }) return NotFoundMsg();

        var me = MeId;
        var canManage = access.CanManage;
        var cards = await _db.Cards.AsNoTracking()
            .Where(c => c.List!.BoardId == id && c.IsArchived)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new
            {
                c.Id,
                c.Title,
                c.Position,
                c.ListId,
                ListTitle = c.List!.Title,
                CanDelete = canManage || c.CreatedBy == me,
                c.UpdatedAt
            })
            .ToListAsync();

        return Ok(cards.Select(c => new
        {
            c.Id,
            c.Title,
            c.Position,
            c.ListId,
            c.ListTitle,
            c.CanDelete,
            UpdatedAt = c.UpdatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm")
        }));
    }

    [HttpPost("api/boards")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateBoard(NewBoard dto)
    {
        var me = MeId;
        if (me == 0) return Fail(401, "Phiên đăng nhập đã hết hạn.");

        var title = InputRules.Clean(dto.Title);
        if (title.Length == 0) return Fail(400, "Vui lòng nhập tiêu đề bảng.");

        var background = string.IsNullOrWhiteSpace(dto.Background) ? DbInitializer.DefaultBackground : dto.Background.Trim();
        if (!InputRules.IsValidBackground(background)) return Fail(400, "Màu nền không hợp lệ.");

        var visibility = string.IsNullOrWhiteSpace(dto.Visibility) ? "Workspace" : dto.Visibility.Trim();
        if (!InputRules.BoardVisibilities.Contains(visibility)) return Fail(400, "Quyền xem của bảng không hợp lệ.");

        // Bảng luôn thuộc workspace đang làm việc của người dùng.
        var current = await _access.GetOrCreateCurrentAsync();
        if (current == null) return Fail(403, "Bạn chưa thuộc không gian làm việc nào.");

        var board = new Board
        {
            WorkspaceId = current.WorkspaceId,
            Title = title,
            Background = background,
            Visibility = visibility,
            CreatedBy = me
        };
        board.Members.Add(new BoardMember { UserId = me, Role = AccessService.Admin });
        _db.Boards.Add(board);
        await _db.SaveChangesAsync();
        return Ok(new { board.Id });
    }

    [HttpDelete("api/boards/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteBoard(int id)
    {
        var access = await _access.GetBoardAccessAsync(id);
        if (access is not { CanView: true }) return NotFoundMsg();
        if (!access.CanManage)
            return Forbidden("Chỉ quản trị viên của bảng hoặc của không gian làm việc mới được xóa bảng.");

        var board = await _db.Boards.FirstOrDefaultAsync(b => b.Id == id);
        if (board == null) return NotFoundMsg();

        await using var tx = await _db.Database.BeginTransactionAsync();
        // Thông báo tham chiếu Activity bằng khóa Restrict nên phải xóa trước.
        await _db.Notifications.Where(n => n.Activity != null && n.Activity.BoardId == id).ExecuteDeleteAsync();
        _db.Boards.Remove(board); // Danh sách, thẻ, bình luận... được xóa theo cascade ở CSDL.
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return NoContent();
    }

    // ------------------------------------------------------------------
    // Danh sách (list)
    // ------------------------------------------------------------------
    [HttpPost("api/lists")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateList(NewList dto)
    {
        var access = await _access.GetBoardAccessAsync(dto.BoardId);
        if (access is not { CanView: true }) return NotFoundMsg();

        var title = InputRules.Clean(dto.Title);
        if (title.Length == 0) return Fail(400, "Vui lòng nhập tên danh sách.");

        var count = await _db.Lists.CountAsync(l => l.BoardId == dto.BoardId && !l.IsArchived);
        if (count >= MaxListsPerBoard) return Fail(400, $"Mỗi bảng chỉ có tối đa {MaxListsPerBoard} danh sách.");

        var max = await _db.Lists.Where(l => l.BoardId == dto.BoardId).MaxAsync(l => (double?)l.Position) ?? 0;
        var list = new BoardList { BoardId = dto.BoardId, Title = title, Position = max + 1024 };
        _db.Lists.Add(list);
        await _db.SaveChangesAsync();
        return Ok(new { list.Id, list.Title, Cards = Array.Empty<object>() });
    }

    [HttpPut("api/lists/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RenameList(int id, EditList dto)
    {
        var list = await _db.Lists.FirstOrDefaultAsync(x => x.Id == id);
        if (list == null) return NotFoundMsg();
        var access = await _access.GetBoardAccessAsync(list.BoardId);
        if (access is not { CanView: true }) return NotFoundMsg();

        var title = InputRules.Clean(dto.Title);
        if (title.Length == 0) return Fail(400, "Vui lòng nhập tên danh sách.");

        list.Title = title;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("api/lists/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteList(int id)
    {
        var list = await _db.Lists.FirstOrDefaultAsync(x => x.Id == id);
        if (list == null) return NotFoundMsg();
        var access = await _access.GetBoardAccessAsync(list.BoardId);
        if (access is not { CanView: true }) return NotFoundMsg();
        if (!access.CanManage)
            return Forbidden("Chỉ quản trị viên mới được xóa danh sách.");

        _db.Lists.Remove(list); // Các thẻ trong danh sách bị xóa theo cascade.
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ------------------------------------------------------------------
    // Thẻ (card)
    // ------------------------------------------------------------------
    [HttpPost("api/cards")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateCard(NewCard dto)
    {
        var me = MeId;
        if (me == 0) return Fail(401, "Phiên đăng nhập đã hết hạn.");

        var list = await _db.Lists.AsNoTracking().FirstOrDefaultAsync(l => l.Id == dto.ListId);
        if (list == null) return NotFoundMsg();
        var access = await _access.GetBoardAccessAsync(list.BoardId);
        if (access is not { CanView: true }) return NotFoundMsg();

        var title = InputRules.Clean(dto.Title);
        if (title.Length == 0) return Fail(400, "Vui lòng nhập tiêu đề thẻ.");

        var count = await _db.Cards.CountAsync(c => c.ListId == dto.ListId && !c.IsArchived);
        if (count >= MaxCardsPerList) return Fail(400, $"Mỗi danh sách chỉ có tối đa {MaxCardsPerList} thẻ.");

        var max = await _db.Cards.Where(c => c.ListId == dto.ListId).MaxAsync(c => (double?)c.Position) ?? 0;
        var card = new Card { ListId = dto.ListId, Title = title, Position = max + 1024, CreatedBy = me };
        _db.Cards.Add(card);
        await _db.SaveChangesAsync();
        return Ok(new
        {
            card.Id,
            card.Title,
            card.Position,
            DueDate = (DateTime?)null,
            IsDueDone = false,
            CreatedBy = me,
            HasDesc = false,
            Comments = 0
        });
    }

    [HttpGet("api/cards/{id:int}")]
    public async Task<IActionResult> GetCard(int id)
    {
        var c = await _db.Cards.AsNoTracking()
            .Include(x => x.List)
            .Include(x => x.Comments).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return NotFoundMsg();
        var access = await _access.GetBoardAccessAsync(c.List!.BoardId);
        if (access is not { CanView: true }) return NotFoundMsg();

        return Ok(new
        {
            c.Id,
            c.Title,
            c.Description,
            ListTitle = c.List!.Title,
            Due = c.DueDate?.ToString(DueFmt),
            c.IsDueDone,
            CanDelete = access.CanManage || c.CreatedBy == MeId,
            Comments = c.Comments.OrderByDescending(m => m.CreatedAt)
                .Select(m => new
                {
                    m.Id,
                    User = m.User!.FullName,
                    m.Content,
                    CreatedAt = m.CreatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm")
                })
        });
    }

    [HttpPut("api/cards/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateCard(int id, EditCard dto)
    {
        var c = await _db.Cards.Include(x => x.List).FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return NotFoundMsg();
        var access = await _access.GetBoardAccessAsync(c.List!.BoardId);
        if (access is not { CanView: true }) return NotFoundMsg();

        if (dto.Title != null)
        {
            var title = InputRules.Clean(dto.Title);
            if (title.Length == 0) return Fail(400, "Tiêu đề thẻ không được để trống.");
            c.Title = title;
        }

        if (dto.Description != null) c.Description = dto.Description.Trim();

        if (dto.Due != null)
        {
            if (!InputRules.TryParseDue(dto.Due, out var due))
                return Fail(400, "Ngày hết hạn không hợp lệ. Vui lòng chọn ngày trong khoảng năm 2000 - 2100.");
            c.DueDate = due;
            if (due == null) c.IsDueDone = false;
        }

        if (dto.DueDone.HasValue)
        {
            if (c.DueDate == null && dto.DueDone.Value)
                return Fail(400, "Thẻ chưa có ngày hết hạn để đánh dấu hoàn thành.");
            c.IsDueDone = dto.DueDone.Value;
        }

        if (dto.ListId.HasValue && dto.ListId.Value != c.ListId)
        {
            var target = await _db.Lists.AsNoTracking().FirstOrDefaultAsync(l => l.Id == dto.ListId.Value);
            if (target == null) return Fail(404, "Không tìm thấy danh sách đích.");
            if (target.BoardId != c.List!.BoardId) return Fail(400, "Chỉ có thể di chuyển thẻ trong cùng một bảng.");
            c.ListId = target.Id;
        }

        if (dto.Position.HasValue)
        {
            if (!double.IsFinite(dto.Position.Value) || Math.Abs(dto.Position.Value) > 1e12)
                return Fail(400, "Vị trí thẻ không hợp lệ.");
            c.Position = dto.Position.Value;
        }

        if (dto.Archive.HasValue) c.IsArchived = dto.Archive.Value;

        c.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("api/cards/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteCard(int id)
    {
        var c = await _db.Cards.Include(x => x.List).FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return NotFoundMsg();
        var access = await _access.GetBoardAccessAsync(c.List!.BoardId);
        if (access is not { CanView: true }) return NotFoundMsg();
        if (!access.CanManage && c.CreatedBy != MeId)
            return Forbidden("Chỉ người tạo thẻ hoặc quản trị viên mới được xóa thẻ này.");

        _db.Cards.Remove(c); // Bình luận, checklist, tệp đính kèm... xóa theo cascade.
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("api/cards/{id:int}/comments")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddComment(int id, NewComment dto)
    {
        var me = MeId;
        if (me == 0) return Fail(401, "Phiên đăng nhập đã hết hạn.");

        var card = await _db.Cards.AsNoTracking().Include(x => x.List).FirstOrDefaultAsync(x => x.Id == id);
        if (card == null) return NotFoundMsg();
        var access = await _access.GetBoardAccessAsync(card.List!.BoardId);
        if (access is not { CanView: true }) return NotFoundMsg();

        var content = dto.Content.Trim();
        if (content.Length == 0) return Fail(400, "Vui lòng nhập nội dung bình luận.");

        var comment = new Comment { CardId = id, UserId = me, Content = content };
        _db.Comments.Add(comment);
        await _db.SaveChangesAsync();
        var name = await _db.Users.Where(u => u.Id == me).Select(u => u.FullName).FirstAsync();
        return Ok(new
        {
            comment.Id,
            User = name,
            comment.Content,
            CreatedAt = comment.CreatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm")
        });
    }
}
