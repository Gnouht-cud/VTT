using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VTT.Data;
using VTT.Models;

namespace VTT.Controllers;

public class WorkspaceController : Controller
{
    private readonly AppDbContext _db;

    public WorkspaceController(AppDbContext db) => _db = db;

    private async Task<Workspace?> GetCurrentWorkspaceAsync()
    {
        return await _db.Workspaces.Include(w => w.Owner).OrderBy(w => w.Id).FirstOrDefaultAsync();
    }

    [HttpGet]
    public async Task<IActionResult> Members()
    {
        var ws = await GetCurrentWorkspaceAsync();
        if (ws == null) return NotFound("Không tìm thấy không gian làm việc.");

        var members = await _db.WorkspaceMembers
            .Where(m => m.WorkspaceId == ws.Id)
            .Include(m => m.User)
            .OrderBy(m => m.Role == "Admin" ? 0 : 1)
            .ThenBy(m => m.JoinedAt)
            .ToListAsync();

        ViewBag.Workspace = ws;
        return View(members);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Invite(string emailOrUsername, string role = "Member")
    {
        var ws = await GetCurrentWorkspaceAsync();
        if (ws == null) return NotFound();

        if (string.IsNullOrWhiteSpace(emailOrUsername))
        {
            TempData["Error"] = "Vui lòng nhập Email hoặc Tên người dùng.";
            return RedirectToAction(nameof(Members));
        }

        var normalized = emailOrUsername.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Email.ToLower() == normalized || u.UserName.ToLower() == normalized);

        if (user == null)
        {
            TempData["Error"] = $"Không tìm thấy người dùng với tài khoản '{emailOrUsername}'.";
            return RedirectToAction(nameof(Members));
        }

        var isAlreadyMember = await _db.WorkspaceMembers.AnyAsync(m => m.WorkspaceId == ws.Id && m.UserId == user.Id);
        if (isAlreadyMember)
        {
            TempData["Error"] = "Người dùng này đã là thành viên của Không gian làm việc.";
            return RedirectToAction(nameof(Members));
        }

        _db.WorkspaceMembers.Add(new WorkspaceMember
        {
            WorkspaceId = ws.Id,
            UserId = user.Id,
            Role = role == "Admin" ? "Admin" : "Member",
            JoinedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        TempData["Success"] = $"Đã thêm thành viên '{user.FullName}' ({user.Email}) thành công!";
        return RedirectToAction(nameof(Members));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateRole(int userId, string role)
    {
        var ws = await GetCurrentWorkspaceAsync();
        if (ws == null) return NotFound();

        var member = await _db.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == ws.Id && m.UserId == userId);
        if (member == null) return NotFound();

        member.Role = role == "Admin" ? "Admin" : "Member";
        await _db.SaveChangesAsync();

        TempData["Success"] = "Đã cập nhật vai trò thành viên thành công!";
        return RedirectToAction(nameof(Members));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RemoveMember(int userId)
    {
        var ws = await GetCurrentWorkspaceAsync();
        if (ws == null) return NotFound();

        if (ws.OwnerId == userId)
        {
            TempData["Error"] = "Không thể xóa người sáng lập / chủ sở hữu không gian làm việc.";
            return RedirectToAction(nameof(Members));
        }

        var member = await _db.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == ws.Id && m.UserId == userId);
        if (member != null)
        {
            _db.WorkspaceMembers.Remove(member);
            await _db.SaveChangesAsync();
            TempData["Success"] = "Đã xóa thành viên khỏi nhóm.";
        }

        return RedirectToAction(nameof(Members));
    }

    [HttpGet]
    public async Task<IActionResult> Settings()
    {
        var ws = await GetCurrentWorkspaceAsync();
        if (ws == null) return NotFound();
        return View(ws);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Settings(string name, string? description)
    {
        var ws = await GetCurrentWorkspaceAsync();
        if (ws == null) return NotFound();

        if (string.IsNullOrWhiteSpace(name))
        {
            ViewBag.Error = "Tên không gian làm việc không được để trống.";
            return View(ws);
        }

        ws.Name = name.Trim();
        ws.Description = description?.Trim();
        await _db.SaveChangesAsync();

        ViewBag.Success = "Đã lưu cài đặt Không gian làm việc thành công!";
        return View(ws);
    }
}
