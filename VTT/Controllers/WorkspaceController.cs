using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VTT.Data;
using VTT.Models;
using VTT.Services;

namespace VTT.Controllers;

/// <summary>
/// Mỗi người dùng có workspace riêng. Người khác chỉ vào chung khi được quản trị viên mời.
/// Quyền (Admin/Member) luôn lấy từ CSDL theo workspace đang chọn, không dùng claim trong cookie.
/// </summary>
[Authorize]
public class WorkspaceController : Controller
{
    private const int MaxName = 100;
    private const int MaxDescription = 500;
    private const int MaxWorkspacesPerUser = 20;

    private readonly AppDbContext _db;
    private readonly AccessService _access;

    public WorkspaceController(AppDbContext db, AccessService access)
    { _db = db; _access = access; }

    private IActionResult NoAdminRights(string message = "Chỉ quản trị viên của không gian làm việc mới có quyền thực hiện thao tác này.")
    {
        TempData["Error"] = message;
        return RedirectToAction(nameof(Members));
    }

    // ------------------------------------------------------------------
    // Thành viên
    // ------------------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> Members()
    {
        var current = await _access.GetOrCreateCurrentAsync();
        if (current == null) return NotFound("Không tìm thấy không gian làm việc.");

        var ws = await _db.Workspaces.AsNoTracking().Include(w => w.Owner)
            .FirstAsync(w => w.Id == current.WorkspaceId);

        var members = await _db.WorkspaceMembers.AsNoTracking()
            .Where(m => m.WorkspaceId == ws.Id)
            .Include(m => m.User)
            .OrderBy(m => m.Role == AccessService.Admin ? 0 : 1)
            .ThenBy(m => m.JoinedAt)
            .ToListAsync();

        ViewBag.Workspace = ws;
        ViewBag.IsAdmin = current.Role == AccessService.Admin;
        ViewBag.MeId = _access.UserId;
        return View(members);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Invite(string emailOrUsername, string role = AccessService.Member)
    {
        var current = await _access.GetCurrentAsync();
        if (current == null) return NotFound();
        if (current.Role != AccessService.Admin) return NoAdminRights();

        var account = InputRules.Clean(emailOrUsername);
        if (account.Length == 0)
        {
            TempData["Error"] = "Vui lòng nhập Email hoặc Tên người dùng.";
            return RedirectToAction(nameof(Members));
        }
        if (account.Length > InputRules.MaxEmail)
        {
            TempData["Error"] = "Email hoặc tên người dùng quá dài.";
            return RedirectToAction(nameof(Members));
        }
        if (!InputRules.WorkspaceRoles.Contains(role))
        {
            TempData["Error"] = "Vai trò không hợp lệ.";
            return RedirectToAction(nameof(Members));
        }

        var normalized = account.ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Email.ToLower() == normalized || u.UserName.ToLower() == normalized);

        // Không tiết lộ thêm thông tin về tài khoản ngoài việc có tồn tại hay không.
        if (user == null)
        {
            TempData["Error"] = "Không tìm thấy người dùng với tài khoản đã nhập.";
            return RedirectToAction(nameof(Members));
        }

        if (await _db.WorkspaceMembers.AnyAsync(m => m.WorkspaceId == current.WorkspaceId && m.UserId == user.Id))
        {
            TempData["Error"] = "Người dùng này đã là thành viên của không gian làm việc.";
            return RedirectToAction(nameof(Members));
        }

        _db.WorkspaceMembers.Add(new WorkspaceMember
        {
            WorkspaceId = current.WorkspaceId,
            UserId = user.Id,
            Role = role,
            JoinedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        TempData["Success"] = $"Đã mời '{user.FullName}' ({user.Email}) vào không gian làm việc.";
        return RedirectToAction(nameof(Members));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateRole(int userId, string role)
    {
        var current = await _access.GetCurrentAsync();
        if (current == null) return NotFound();
        if (current.Role != AccessService.Admin) return NoAdminRights();
        if (!InputRules.WorkspaceRoles.Contains(role))
        {
            TempData["Error"] = "Vai trò không hợp lệ.";
            return RedirectToAction(nameof(Members));
        }

        var ws = await _db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == current.WorkspaceId);
        if (ws.OwnerId == userId)
        {
            TempData["Error"] = "Không thể đổi vai trò của chủ sở hữu không gian làm việc.";
            return RedirectToAction(nameof(Members));
        }

        var member = await _db.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == ws.Id && m.UserId == userId);
        if (member == null) return NotFound();

        member.Role = role;
        await _db.SaveChangesAsync();

        TempData["Success"] = "Đã cập nhật vai trò thành viên thành công!";
        return RedirectToAction(nameof(Members));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RemoveMember(int userId)
    {
        var current = await _access.GetCurrentAsync();
        if (current == null) return NotFound();
        if (current.Role != AccessService.Admin) return NoAdminRights();

        var ws = await _db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == current.WorkspaceId);
        if (ws.OwnerId == userId)
        {
            TempData["Error"] = "Không thể xóa người sáng lập / chủ sở hữu không gian làm việc.";
            return RedirectToAction(nameof(Members));
        }
        if (userId == _access.UserId)
        {
            TempData["Error"] = "Để rời khỏi không gian làm việc, hãy dùng nút \"Rời khỏi không gian\".";
            return RedirectToAction(nameof(Members));
        }

        if (await DetachMemberAsync(ws.Id, userId))
            TempData["Success"] = "Đã xóa thành viên khỏi không gian làm việc.";
        return RedirectToAction(nameof(Members));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Leave()
    {
        var current = await _access.GetCurrentAsync();
        if (current == null) return NotFound();

        var ws = await _db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == current.WorkspaceId);
        if (ws.OwnerId == _access.UserId)
        {
            TempData["Error"] = "Chủ sở hữu không thể rời khỏi không gian làm việc của chính mình.";
            return RedirectToAction(nameof(Members));
        }

        await DetachMemberAsync(ws.Id, _access.UserId);
        _access.Reset();
        TempData["Success"] = $"Bạn đã rời khỏi không gian \"{ws.Name}\".";
        return RedirectToAction("Index", "Boards");
    }

    /// <summary>Xóa thành viên khỏi workspace và thu hồi quyền trên các bảng/thẻ của workspace đó.</summary>
    private async Task<bool> DetachMemberAsync(int workspaceId, int userId)
    {
        var member = await _db.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId);
        if (member == null) return false;

        await using var tx = await _db.Database.BeginTransactionAsync();
        await _db.BoardMembers.Where(m => m.UserId == userId && m.Board!.WorkspaceId == workspaceId).ExecuteDeleteAsync();
        await _db.BoardStars.Where(s => s.UserId == userId && s.Board!.WorkspaceId == workspaceId).ExecuteDeleteAsync();
        await _db.CardMembers.Where(m => m.UserId == userId && m.Card!.List!.Board!.WorkspaceId == workspaceId).ExecuteDeleteAsync();
        _db.WorkspaceMembers.Remove(member);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return true;
    }

    // ------------------------------------------------------------------
    // Tạo / chuyển workspace
    // ------------------------------------------------------------------
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(string name)
    {
        var me = _access.UserId;
        var title = InputRules.Clean(name);
        if (title.Length == 0 || title.Length > MaxName)
        {
            TempData["Error"] = $"Tên không gian làm việc phải từ 1 đến {MaxName} ký tự.";
            return RedirectToAction("Index", "Boards");
        }

        var owned = await _db.Workspaces.CountAsync(w => w.OwnerId == me);
        if (owned >= MaxWorkspacesPerUser)
        {
            TempData["Error"] = $"Bạn chỉ có thể tạo tối đa {MaxWorkspacesPerUser} không gian làm việc.";
            return RedirectToAction("Index", "Boards");
        }

        var ws = WorkspaceFactory.CreateWithDefaultBoard(me, title);
        _db.Workspaces.Add(ws);
        await _db.SaveChangesAsync();

        _access.Reset();
        _access.SetCurrent(ws.Id);
        TempData["Success"] = $"Đã tạo không gian làm việc \"{title}\".";
        return RedirectToAction("Index", "Boards");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Switch(int id)
    {
        var memberships = await _access.GetMembershipsAsync();
        // Chỉ chuyển được sang workspace mà mình là thành viên.
        if (memberships.Any(m => m.WorkspaceId == id))
            _access.SetCurrent(id);
        else
            TempData["Error"] = "Bạn không thuộc không gian làm việc này.";
        return RedirectToAction("Index", "Boards");
    }

    // ------------------------------------------------------------------
    // Cài đặt
    // ------------------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> Settings()
    {
        var current = await _access.GetCurrentAsync();
        if (current == null) return NotFound();
        var ws = await _db.Workspaces.AsNoTracking().Include(w => w.Owner).FirstAsync(w => w.Id == current.WorkspaceId);
        ViewBag.IsAdmin = current.Role == AccessService.Admin;
        return View(ws);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Settings(string name, string? description)
    {
        var current = await _access.GetCurrentAsync();
        if (current == null) return NotFound();
        if (current.Role != AccessService.Admin)
        {
            TempData["Error"] = "Chỉ quản trị viên mới được thay đổi cài đặt không gian làm việc.";
            return RedirectToAction(nameof(Settings));
        }

        var ws = await _db.Workspaces.Include(w => w.Owner).FirstAsync(w => w.Id == current.WorkspaceId);
        ViewBag.IsAdmin = true;

        var title = InputRules.Clean(name);
        var desc = (description ?? "").Trim();
        if (title.Length == 0)
        {
            ViewBag.Error = "Tên không gian làm việc không được để trống.";
            return View(ws);
        }
        if (title.Length > MaxName)
        {
            ViewBag.Error = $"Tên không gian làm việc tối đa {MaxName} ký tự.";
            return View(ws);
        }
        if (desc.Length > MaxDescription)
        {
            ViewBag.Error = $"Mô tả tối đa {MaxDescription} ký tự.";
            return View(ws);
        }

        ws.Name = title;
        ws.Description = desc.Length == 0 ? null : desc;
        await _db.SaveChangesAsync();
        _access.Reset();

        ViewBag.Success = "Đã lưu cài đặt Không gian làm việc thành công!";
        return View(ws);
    }
}
