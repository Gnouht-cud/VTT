using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VTT.Data;
using VTT.Models;

namespace VTT.Controllers;

public class AccountController : Controller
{
    private readonly AppDbContext _db;

    public AccountController(AppDbContext db) => _db = db;

    private static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static bool VerifyPassword(string inputPassword, string storedHash)
    {
        if (string.IsNullOrEmpty(storedHash) || storedHash == "-")
            return true; // Hỗ trợ đăng nhập nhanh tài khoản seed mặc định

        var inputHash = HashPassword(inputPassword);
        return string.Equals(inputHash, storedHash, StringComparison.OrdinalIgnoreCase);
    }

    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
            return RedirectToAction("Index", "Boards");

        ViewData["ReturnUrl"] = returnUrl;
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(string emailOrUsername, string password, bool rememberMe = false, string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;

        if (string.IsNullOrWhiteSpace(emailOrUsername) || string.IsNullOrWhiteSpace(password))
        {
            ViewBag.Error = "Vui lòng nhập đầy đủ tên đăng nhập/email và mật khẩu.";
            return View();
        }

        var normalized = emailOrUsername.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Email.ToLower() == normalized || u.UserName.ToLower() == normalized);

        if (user == null || !VerifyPassword(password, user.PasswordHash))
        {
            ViewBag.Error = "Tài khoản hoặc mật khẩu không chính xác.";
            return View();
        }

        // Lấy vai trò trong workspace nếu có
        var role = await _db.WorkspaceMembers
            .Where(m => m.UserId == user.Id)
            .Select(m => m.Role)
            .FirstOrDefaultAsync() ?? "Member";

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email),
            new("UserName", user.UserName),
            new(ClaimTypes.Role, role)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var authProperties = new AuthenticationProperties
        {
            IsPersistent = rememberMe,
            ExpiresUtc = rememberMe ? DateTimeOffset.UtcNow.AddDays(14) : DateTimeOffset.UtcNow.AddHours(8)
        };

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity), authProperties);

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction("Index", "Boards");
    }

    [HttpGet]
    public IActionResult Register()
    {
        if (User.Identity?.IsAuthenticated == true)
            return RedirectToAction("Index", "Boards");

        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(string fullName, string email, string userName, string password, string confirmPassword)
    {
        if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
        {
            ViewBag.Error = "Vui lòng điền đầy đủ tất cả các trường.";
            return View();
        }

        if (password != confirmPassword)
        {
            ViewBag.Error = "Mật khẩu xác nhận không khớp.";
            return View();
        }

        if (password.Length < 4)
        {
            ViewBag.Error = "Mật khẩu phải có ít nhất 4 ký tự.";
            return View();
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedUserName = userName.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail))
        {
            ViewBag.Error = "Email này đã được sử dụng. Vui lòng chọn email khác.";
            return View();
        }

        if (await _db.Users.AnyAsync(u => u.UserName.ToLower() == normalizedUserName))
        {
            ViewBag.Error = "Tên đăng nhập này đã tồn tại. Vui lòng chọn tên khác.";
            return View();
        }

        var newUser = new User
        {
            FullName = fullName.Trim(),
            Email = normalizedEmail,
            UserName = normalizedUserName,
            PasswordHash = HashPassword(password),
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(newUser);
        await _db.SaveChangesAsync();

        // Gán vào Workspace mặc định
        var defaultWs = await _db.Workspaces.OrderBy(w => w.Id).FirstOrDefaultAsync();
        if (defaultWs != null)
        {
            _db.WorkspaceMembers.Add(new WorkspaceMember
            {
                WorkspaceId = defaultWs.Id,
                UserId = newUser.Id,
                Role = "Member",
                JoinedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }

        // Tự động đăng nhập
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, newUser.Id.ToString()),
            new(ClaimTypes.Name, newUser.FullName),
            new(ClaimTypes.Email, newUser.Email),
            new("UserName", newUser.UserName),
            new(ClaimTypes.Role, "Member")
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

        return RedirectToAction("Index", "Boards");
    }

    [HttpGet, HttpPost]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction("Login");
    }

    [HttpGet]
    public async Task<IActionResult> Profile()
    {
        int userId;
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(idClaim, out userId))
        {
            var firstUser = await _db.Users.OrderBy(u => u.Id).FirstOrDefaultAsync();
            if (firstUser == null) return RedirectToAction("Login");
            userId = firstUser.Id;
        }

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        var memberInfo = await _db.WorkspaceMembers
            .Include(m => m.Workspace)
            .FirstOrDefaultAsync(m => m.UserId == userId);

        ViewBag.WorkspaceName = memberInfo?.Workspace?.Name ?? "Không gian làm việc VTT";
        ViewBag.Role = memberInfo?.Role ?? "Member";

        return View(user);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Profile(string fullName, string? newPassword)
    {
        int userId;
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(idClaim, out userId))
        {
            var firstUser = await _db.Users.OrderBy(u => u.Id).FirstOrDefaultAsync();
            if (firstUser == null) return RedirectToAction("Login");
            userId = firstUser.Id;
        }

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(fullName))
            user.FullName = fullName.Trim();

        if (!string.IsNullOrWhiteSpace(newPassword))
        {
            if (newPassword.Length < 4)
            {
                ViewBag.Error = "Mật khẩu mới phải có ít nhất 4 ký tự.";
                return View(user);
            }
            user.PasswordHash = HashPassword(newPassword);
        }

        await _db.SaveChangesAsync();
        ViewBag.Success = "Cập nhật thông tin hồ sơ thành công!";

        var memberInfo = await _db.WorkspaceMembers
            .Include(m => m.Workspace)
            .FirstOrDefaultAsync(m => m.UserId == userId);
        ViewBag.WorkspaceName = memberInfo?.Workspace?.Name ?? "Không gian làm việc VTT";
        ViewBag.Role = memberInfo?.Role ?? "Member";

        return View(user);
    }
}
