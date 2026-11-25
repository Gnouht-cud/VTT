using System.Security.Claims;
using System.Security.Cryptography;
using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using VTT.Data;
using VTT.Models;
using VTT.Services;

namespace VTT.Controllers;

[Authorize]
public class AccountController : Controller
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly AccessService _access;

    public AccountController(AppDbContext db, IPasswordHasher<User> passwordHasher, AccessService access)
    { _db = db; _passwordHasher = passwordHasher; _access = access; }

    private bool IsLegacySha256(string storedHash) => storedHash.Length == 64 && storedHash.All(Uri.IsHexDigit);


    [AllowAnonymous]
    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
            return RedirectToAction("Index", "Boards");

        ViewData["ReturnUrl"] = returnUrl;
        return View();
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(string emailOrUsername, string password, bool rememberMe = false, string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;

        if (string.IsNullOrWhiteSpace(emailOrUsername) || string.IsNullOrWhiteSpace(password))
        {
            ViewBag.Error = "Vui lòng nhập đầy đủ tên đăng nhập/email và mật khẩu.";
            return View();
        }
        if (emailOrUsername.Length > InputRules.MaxEmail || password.Length > InputRules.MaxPassword)
        {
            ViewBag.Error = "Tài khoản hoặc mật khẩu không chính xác.";
            return View();
        }

        var normalized = emailOrUsername.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Email.ToLower() == normalized || u.UserName.ToLower() == normalized);

        if (user == null)
        {
            // Băm giả để thời gian phản hồi không lộ tài khoản có tồn tại hay không.
            _passwordHasher.HashPassword(new User(), password);
            ViewBag.Error = "Tài khoản hoặc mật khẩu không chính xác.";
            return View();
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        var legacyValid = IsLegacySha256(user.PasswordHash) &&
            string.Equals(Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(password))), user.PasswordHash, StringComparison.OrdinalIgnoreCase);
        if (verification == PasswordVerificationResult.Failed && !legacyValid)
        {
            ViewBag.Error = "Tài khoản hoặc mật khẩu không chính xác.";
            return View();
        }
        if (verification == PasswordVerificationResult.SuccessRehashNeeded || legacyValid)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, password);
            await _db.SaveChangesAsync();
        }

        // Vai trò (Admin/Member) phụ thuộc từng workspace nên không lưu trong cookie; luôn đọc từ CSDL.
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email),
            new("UserName", user.UserName)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var authProperties = new AuthenticationProperties
        {
            IsPersistent = rememberMe,
            ExpiresUtc = rememberMe ? DateTimeOffset.UtcNow.AddDays(14) : DateTimeOffset.UtcNow.AddHours(8)
        };

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity), authProperties);

        // Tài khoản tạo từ phiên bản cũ có thể chưa có workspace nào: tạo workspace cá nhân.
        if (!await _db.WorkspaceMembers.AnyAsync(m => m.UserId == user.Id))
        {
            var personal = WorkspaceFactory.CreateWithDefaultBoard(user.Id, $"Không gian của {user.FullName}");
            _db.Workspaces.Add(personal);
            await _db.SaveChangesAsync();
        }

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction("Index", "Boards");
    }


    [AllowAnonymous]
    [HttpGet]
    public IActionResult ForgotPassword()
    {
        if (User.Identity?.IsAuthenticated == true)
            return RedirectToAction("Index", "Boards");
        return View();
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForgotPassword(string email)
    {
        if (!InputRules.IsValidEmail(email))
        {
            ViewBag.Error = "Vui lòng nhập địa chỉ email hợp lệ.";
            return View();
        }

        // Luôn hiển thị cùng một thông báo để tránh tiết lộ email có đăng ký hay không.
        ViewBag.Success = "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn.";
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
        if (user == null) return View();

        var now = DateTime.UtcNow;
        var oldTokens = await _db.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null).ToListAsync();
        foreach (var old in oldTokens) old.UsedAt = now;

        var rawToken = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = tokenHash,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(30)
        });
        await _db.SaveChangesAsync();

        var resetUrl = Url.Action("ResetPassword", "Account",
            new { token = rawToken, email = user.Email }, Request.Scheme);

        var smtp = HttpContext.RequestServices.GetRequiredService<IConfiguration>().GetSection("Smtp");
        var host = smtp["Host"];
        if (!string.IsNullOrWhiteSpace(host) &&
            int.TryParse(smtp["Port"], out var port) &&
            !string.IsNullOrWhiteSpace(smtp["From"]))
        {
            try
            {
                using var message = new MailMessage(smtp["From"]!, user.Email)
                {
                    Subject = "Đặt lại mật khẩu VTT",
                    Body = $"Xin chào {user.FullName},\n\nĐể đặt lại mật khẩu, hãy mở liên kết sau (có hiệu lực trong 30 phút):\n{resetUrl}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.",
                    IsBodyHtml = false
                };
                using var client = new SmtpClient(host, port)
                {
                    EnableSsl = bool.TryParse(smtp["EnableSsl"], out var ssl) && ssl,
                    Credentials = !string.IsNullOrWhiteSpace(smtp["Username"])
                        ? new NetworkCredential(smtp["Username"], smtp["Password"])
                        : CredentialCache.DefaultNetworkCredentials
                };
                await client.SendMailAsync(message);
            }
            catch (Exception ex)
            {
                HttpContext.RequestServices.GetRequiredService<ILogger<AccountController>>()
                    .LogError(ex, "Không thể gửi email đặt lại mật khẩu.");
            }
        }
        else if (HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment())
        {
            // Chỉ hiển thị link trong môi trường phát triển khi chưa cấu hình SMTP.
            ViewBag.DevelopmentResetUrl = resetUrl;
        }
        else
        {
            HttpContext.RequestServices.GetRequiredService<ILogger<AccountController>>()
                .LogWarning("Chưa cấu hình SMTP; email đặt lại mật khẩu chưa được gửi.");
        }

        return View();
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult ResetPassword(string? token, string? email)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(email))
            return RedirectToAction(nameof(ForgotPassword));
        ViewBag.Token = token;
        ViewBag.Email = email;
        return View();
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ResetPassword(string email, string token, string password, string confirmPassword)
    {
        ViewBag.Token = token;
        ViewBag.Email = email;
        var pwError = InputRules.ValidatePassword(password);
        if (pwError != null)
        {
            ViewBag.Error = pwError;
            return View();
        }
        if (password != confirmPassword)
        {
            ViewBag.Error = "Mật khẩu xác nhận không khớp.";
            return View();
        }
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(token) || email.Length > InputRules.MaxEmail)
        {
            ViewBag.Error = "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.";
            return View();
        }

        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token ?? "")));
        var now = DateTime.UtcNow;
        var reset = await _db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash &&
                t.User != null && t.User.Email == email.Trim().ToLower() &&
                t.UsedAt == null && t.ExpiresAt > now);

        if (reset?.User == null)
        {
            ViewBag.Error = "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.";
            return View();
        }

        reset.User.PasswordHash = _passwordHasher.HashPassword(reset.User, password);
        reset.UsedAt = now;
        var otherTokens = await _db.PasswordResetTokens
            .Where(t => t.UserId == reset.UserId && t.Id != reset.Id && t.UsedAt == null)
            .ToListAsync();
        foreach (var other in otherTokens) other.UsedAt = now;
        await _db.SaveChangesAsync();

        ViewBag.Success = "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.";
        return View("ResetPasswordSuccess");
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult Register()
    {
        if (User.Identity?.IsAuthenticated == true)
            return RedirectToAction("Index", "Boards");

        return View();
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register(string fullName, string email, string userName, string password, string confirmPassword)
    {
        if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
        {
            ViewBag.Error = "Vui lòng điền đầy đủ tất cả các trường.";
            return View();
        }

        var cleanName = InputRules.Clean(fullName);
        if (cleanName.Length < 2 || cleanName.Length > InputRules.MaxFullName)
        {
            ViewBag.Error = $"Họ và tên phải từ 2 đến {InputRules.MaxFullName} ký tự.";
            return View();
        }

        if (!InputRules.IsValidEmail(email))
        {
            ViewBag.Error = "Địa chỉ email không hợp lệ.";
            return View();
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedUserName = userName.Trim().ToLowerInvariant();

        if (!InputRules.IsValidUserName(normalizedUserName))
        {
            ViewBag.Error = "Tên người dùng gồm 3-30 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.";
            return View();
        }

        var pwError = InputRules.ValidatePassword(password);
        if (pwError != null)
        {
            ViewBag.Error = pwError;
            return View();
        }

        if (password != confirmPassword)
        {
            ViewBag.Error = "Mật khẩu xác nhận không khớp.";
            return View();
        }

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

        User newUser;
        try
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            newUser = new User
            {
                FullName = cleanName, Email = normalizedEmail, UserName = normalizedUserName,
                CreatedAt = DateTime.UtcNow
            };
            newUser.PasswordHash = _passwordHasher.HashPassword(newUser, password);
            _db.Users.Add(newUser);
            await _db.SaveChangesAsync();

            // Mỗi tài khoản có workspace riêng. Người khác chỉ vào chung khi được quản trị viên mời.
            _db.Workspaces.Add(WorkspaceFactory.CreateWithDefaultBoard(newUser.Id, $"Không gian của {cleanName}"));
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateException)
        {
            // Hai yêu cầu đăng ký trùng email/tên đăng nhập cùng lúc: chỉ một yêu cầu thành công.
            ViewBag.Error = "Email hoặc tên đăng nhập đã được sử dụng. Vui lòng thử lại.";
            return View();
        }

        // Tự động đăng nhập
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, newUser.Id.ToString()),
            new(ClaimTypes.Name, newUser.FullName),
            new(ClaimTypes.Email, newUser.Email),
            new("UserName", newUser.UserName)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

        return RedirectToAction("Index", "Boards");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction("Login");
    }

    [HttpGet]
    public async Task<IActionResult> Profile()
    {
        var userId = _access.UserId;
        if (userId == 0) return Challenge();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return NotFound();

        await FillWorkspaceInfoAsync();
        return View(user);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Profile(string fullName, string? currentPassword, string? newPassword)
    {
        var userId = _access.UserId;
        if (userId == 0) return Challenge();

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();
        await FillWorkspaceInfoAsync();

        var cleanName = InputRules.Clean(fullName);
        if (cleanName.Length < 2 || cleanName.Length > InputRules.MaxFullName)
        {
            ViewBag.Error = $"Họ và tên phải từ 2 đến {InputRules.MaxFullName} ký tự.";
            return View(user);
        }

        if (!string.IsNullOrWhiteSpace(newPassword))
        {
            // Đổi mật khẩu phải xác nhận lại mật khẩu hiện tại.
            if (string.IsNullOrEmpty(currentPassword) ||
                (_passwordHasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword) == PasswordVerificationResult.Failed &&
                 !(IsLegacySha256(user.PasswordHash) &&
                   string.Equals(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(currentPassword))), user.PasswordHash, StringComparison.OrdinalIgnoreCase))))
            {
                ViewBag.Error = "Mật khẩu hiện tại không chính xác.";
                return View(user);
            }

            var pwError = InputRules.ValidatePassword(newPassword);
            if (pwError != null)
            {
                ViewBag.Error = pwError;
                return View(user);
            }
            user.PasswordHash = _passwordHasher.HashPassword(user, newPassword);
        }

        user.FullName = cleanName;
        await _db.SaveChangesAsync();

        // Làm mới cookie để tên hiển thị trên giao diện cập nhật ngay.
        var auth = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email),
            new("UserName", user.UserName)
        };
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)),
            auth.Properties);

        ViewBag.Success = "Cập nhật thông tin hồ sơ thành công!";
        return View(user);
    }

    private async Task FillWorkspaceInfoAsync()
    {
        var current = await _access.GetCurrentAsync();
        ViewBag.WorkspaceName = current?.Workspace?.Name ?? "Không gian làm việc VTT";
        ViewBag.Role = current?.Role ?? AccessService.Member;
    }
}
