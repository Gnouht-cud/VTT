using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VTT.Data;
using VTT.Models;

namespace VTT.Controllers;

[ApiController]
public class ApiController : ControllerBase
{
    private readonly AppDbContext _db;
    public ApiController(AppDbContext db) => _db = db;

    private async Task<int> MeAsync()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(idClaim, out var uid) && await _db.Users.AnyAsync(u => u.Id == uid))
                return uid;
        }
        return await _db.Users.OrderBy(u => u.Id).Select(u => u.Id).FirstAsync();
    }
    private const string DueFmt = "yyyy-MM-ddTHH:mm";

    [HttpGet("api/boards/{id:int}")]
    public async Task<IActionResult> GetBoard(int id)
    {
        var raw = await _db.Boards.Where(b => b.Id == id).Select(b => new
        {
            b.Id, b.Title,
            Lists = b.Lists.Where(l => !l.IsArchived).OrderBy(l => l.Position).Select(l => new
            {
                l.Id, l.Title,
                Cards = l.Cards.Where(c => !c.IsArchived).OrderBy(c => c.Position).Select(c => new
                {
                    c.Id, c.Title, c.Position, c.DueDate,
                    HasDesc = c.Description != null && c.Description != "",
                    Comments = c.Comments.Count
                })
            })
        }).FirstOrDefaultAsync();
        return raw == null ? NotFound() : Ok(raw);
    }

    [HttpGet("api/boards/{id:int}/archived")]
    public async Task<IActionResult> GetArchivedCards(int id)
    {
        var cards = await _db.Cards
            .Where(c => c.List!.BoardId == id && c.IsArchived)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new
            {
                c.Id, c.Title, c.Position, c.ListId,
                ListTitle = c.List!.Title,
                UpdatedAt = c.UpdatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm")
            })
            .ToListAsync();
        return Ok(cards);
    }

    public record NewBoard(string Title, string? Background);

    [HttpPost("api/boards")]
    public async Task<IActionResult> CreateBoard(NewBoard dto)
    {
        var me = await MeAsync();
        var ws = await _db.Workspaces.OrderBy(w => w.Id).FirstOrDefaultAsync();
        if (ws == null)
        {
            ws = new Workspace { Name = "Không gian làm việc VTT", OwnerId = me };
            _db.Workspaces.Add(ws);
        }
        var b = new Board { Workspace = ws, Title = dto.Title, Background = dto.Background ?? DbInitializer.DefaultBackground, CreatedBy = me };
        b.Members.Add(new BoardMember { UserId = me, Role = "Admin" });
        _db.Boards.Add(b);
        await _db.SaveChangesAsync();
        return Ok(new { b.Id });
    }

    public record NewList(int BoardId, string Title);
    public record EditList(string Title);

    [HttpPost("api/lists")]
    public async Task<IActionResult> CreateList(NewList dto)
    {
        var max = await _db.Lists.Where(l => l.BoardId == dto.BoardId).MaxAsync(l => (double?)l.Position) ?? 0;
        var l = new BoardList { BoardId = dto.BoardId, Title = dto.Title, Position = max + 1024 };
        _db.Lists.Add(l);
        await _db.SaveChangesAsync();
        return Ok(new { l.Id, l.Title, Cards = Array.Empty<object>() });
    }

    [HttpPut("api/lists/{id:int}")]
    public async Task<IActionResult> RenameList(int id, EditList dto)
    {
        var l = await _db.Lists.FindAsync(id);
        if (l == null) return NotFound();
        l.Title = dto.Title;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    public record NewCard(int ListId, string Title);
    public record EditCard(string? Title, string? Description, string? Due, int? ListId, double? Position, bool? Archive);
    public record NewComment(string Content);

    [HttpPost("api/cards")]
    public async Task<IActionResult> CreateCard(NewCard dto)
    {
        var me = await MeAsync();
        var max = await _db.Cards.Where(c => c.ListId == dto.ListId).MaxAsync(c => (double?)c.Position) ?? 0;
        var c = new Card { ListId = dto.ListId, Title = dto.Title, Position = max + 1024, CreatedBy = me };
        _db.Cards.Add(c);
        await _db.SaveChangesAsync();
        return Ok(new { c.Id, c.Title, c.Position, DueDate = (DateTime?)null, HasDesc = false, Comments = 0 });
    }

    [HttpGet("api/cards/{id:int}")]
    public async Task<IActionResult> GetCard(int id)
    {
        var c = await _db.Cards.Include(x => x.List).Include(x => x.Comments).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return NotFound();
        return Ok(new
        {
            c.Id, c.Title, c.Description,
            ListTitle = c.List!.Title,
            Due = c.DueDate?.ToString(DueFmt),
            Comments = c.Comments.OrderByDescending(m => m.CreatedAt)
                .Select(m => new { m.Id, User = m.User!.FullName, m.Content, CreatedAt = m.CreatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm") })
        });
    }

    [HttpPut("api/cards/{id:int}")]
    public async Task<IActionResult> UpdateCard(int id, EditCard dto)
    {
        var c = await _db.Cards.FindAsync(id);
        if (c == null) return NotFound();
        if (dto.Title != null) c.Title = dto.Title;
        if (dto.Description != null) c.Description = dto.Description;
        if (dto.Due != null) c.DueDate = DateTime.TryParse(dto.Due, out var d) ? d : null;
        if (dto.ListId != null) c.ListId = dto.ListId.Value;
        if (dto.Position != null) c.Position = dto.Position.Value;
        if (dto.Archive != null) c.IsArchived = dto.Archive.Value;
        c.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("api/cards/{id:int}/comments")]
    public async Task<IActionResult> AddComment(int id, NewComment dto)
    {
        var me = await MeAsync();
        var m = new Comment { CardId = id, UserId = me, Content = dto.Content };
        _db.Comments.Add(m);
        await _db.SaveChangesAsync();
        var name = await _db.Users.Where(u => u.Id == me).Select(u => u.FullName).FirstAsync();
        return Ok(new { m.Id, User = name, m.Content, CreatedAt = m.CreatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm") });
    }
}
