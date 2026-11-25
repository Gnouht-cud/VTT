using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using VTT.Data;
using VTT.Models;

namespace VTT.Services;

/// <summary>Quyền của người dùng hiện tại đối với một bảng.</summary>
public sealed record BoardAccess(int WorkspaceId, bool CanView, bool CanManage);

/// <summary>
/// Trung tâm phân quyền: xác định workspace đang làm việc và quyền trên từng bảng.
/// Vai trò luôn đọc từ CSDL (không tin claim trong cookie) nên đổi quyền / xóa thành viên có hiệu lực ngay.
/// </summary>
public class AccessService
{
    public const string WorkspaceCookie = "VTT.Ws";
    public const string Admin = "Admin";
    public const string Member = "Member";
    public const string PrivateBoard = "Private";

    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _http;
    private List<WorkspaceMember>? _memberships;
    private WorkspaceMember? _current;
    private bool _currentLoaded;
    private int? _forcedWorkspaceId; // Giá trị vừa đặt trong request này (cookie phản hồi chưa đọc lại được).

    public AccessService(AppDbContext db, IHttpContextAccessor http)
    { _db = db; _http = http; }

    public int UserId =>
        int.TryParse(_http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    /// <summary>Tất cả workspace mà người dùng là thành viên (kèm thông tin workspace).</summary>
    public async Task<List<WorkspaceMember>> GetMembershipsAsync()
    {
        if (_memberships != null) return _memberships;
        var me = UserId;
        _memberships = me == 0
            ? new List<WorkspaceMember>()
            : await _db.WorkspaceMembers.AsNoTracking()
                .Include(m => m.Workspace)
                .Where(m => m.UserId == me)
                .OrderBy(m => m.WorkspaceId)
                .ToListAsync();
        return _memberships;
    }

    /// <summary>Workspace đang chọn (cookie đã được kiểm tra với danh sách thành viên thật).</summary>
    public async Task<WorkspaceMember?> GetCurrentAsync()
    {
        if (_currentLoaded) return _current;
        var list = await GetMembershipsAsync();
        var wsId = _forcedWorkspaceId ?? 0;
        if (_forcedWorkspaceId == null)
            int.TryParse(_http.HttpContext?.Request.Cookies[WorkspaceCookie], out wsId);
        _current = list.FirstOrDefault(m => m.WorkspaceId == wsId) ?? list.FirstOrDefault();
        _currentLoaded = true;
        return _current;
    }

    /// <summary>Giống GetCurrentAsync nhưng tự tạo workspace cá nhân nếu tài khoản cũ chưa có workspace nào.</summary>
    public async Task<WorkspaceMember?> GetOrCreateCurrentAsync()
    {
        var current = await GetCurrentAsync();
        if (current != null) return current;

        var me = UserId;
        if (me == 0) return null;
        var fullName = await _db.Users.Where(u => u.Id == me).Select(u => u.FullName).FirstOrDefaultAsync();
        if (fullName == null) return null;

        var ws = WorkspaceFactory.CreateWithDefaultBoard(me, $"Không gian của {fullName}");
        _db.Workspaces.Add(ws);
        await _db.SaveChangesAsync();
        Reset();
        SetCurrent(ws.Id);
        return await GetCurrentAsync();
    }

    public async Task<bool> IsCurrentAdminAsync() =>
        (await GetCurrentAsync())?.Role == Admin;

    public void SetCurrent(int workspaceId)
    {
        _http.HttpContext?.Response.Cookies.Append(WorkspaceCookie, workspaceId.ToString(), new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            IsEssential = true,
            MaxAge = TimeSpan.FromDays(365)
        });
        _forcedWorkspaceId = workspaceId;
        _currentLoaded = false;
        _current = null;
    }

    /// <summary>Xóa cache trong request (sau khi thay đổi thành viên).</summary>
    public void Reset()
    {
        _memberships = null;
        _current = null;
        _currentLoaded = false;
    }

    /// <summary>
    /// Quy tắc: xem được nếu là thành viên bảng, hoặc là thành viên workspace và bảng không Private,
    /// hoặc là Admin của workspace. Quản lý được nếu là Admin bảng hoặc Admin workspace (và xem được).
    /// </summary>
    public async Task<BoardAccess?> GetBoardAccessAsync(int boardId)
    {
        var me = UserId;
        if (me == 0) return null;

        var info = await _db.Boards.AsNoTracking().Where(b => b.Id == boardId).Select(b => new
        {
            b.WorkspaceId,
            b.Visibility,
            BoardRole = b.Members.Where(m => m.UserId == me).Select(m => m.Role).FirstOrDefault(),
            WsRole = b.Workspace!.Members.Where(m => m.UserId == me).Select(m => m.Role).FirstOrDefault()
        }).FirstOrDefaultAsync();

        if (info == null) return null;

        var wsAdmin = info.WsRole == Admin;
        var canView = info.BoardRole != null
                      || (info.WsRole != null && (info.Visibility != PrivateBoard || wsAdmin));
        var canManage = canView && (info.BoardRole == Admin || wsAdmin);
        return new BoardAccess(info.WorkspaceId, canView, canManage);
    }
}
