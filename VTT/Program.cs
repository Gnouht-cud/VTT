using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using VTT.Data;
using VTT.Middleware;
using VTT.Models;
using VTT.Services;

var builder = WebApplication.CreateBuilder(args);

// HTTPS: ở Development luôn gắn cứng 2 cổng, bỏ qua mọi cấu hình địa chỉ bên ngoài
// (ASPNETCORE_URLS, --urls, launchSettings, IIS Express...) để cổng 7100 chắc chắn là HTTPS.
//   https://localhost:7100  (chứng chỉ phát triển: dotnet dev-certs https --trust)
//   http://localhost:5100   (tự chuyển sang https)
// Nếu chưa có chứng chỉ phát triển, ứng dụng báo lỗi rõ ràng khi khởi động.
if (builder.Environment.IsDevelopment())
{
    builder.WebHost.ConfigureKestrel(kestrel =>
    {
        kestrel.ListenLocalhost(5100);
        kestrel.ListenLocalhost(7100, listen => listen.UseHttps());
    });
}

// Cổng HTTPS dùng để chuyển hướng. Cấu hình bằng "HttpsPort" (vd khi chạy sau reverse proxy).
builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
    var port = builder.Configuration.GetValue<int?>("HttpsPort");
    if (port == null && builder.Environment.IsDevelopment()) port = 7100;
    if (port != null) options.HttpsPort = port;
});

builder.Services
    .AddControllersWithViews()
    .ConfigureApiBehaviorOptions(options =>
    {
        // Lỗi kiểm tra dữ liệu của API trả về JSON { message, errors } để giao diện hiển thị trực tiếp.
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .ToDictionary(
                    e => e.Key,
                    e => e.Value!.Errors.Select(x => string.IsNullOrWhiteSpace(x.ErrorMessage)
                        ? "Dữ liệu không hợp lệ." : x.ErrorMessage).ToArray());
            var first = errors.Values.SelectMany(v => v).FirstOrDefault() ?? "Dữ liệu gửi lên không hợp lệ.";
            return new BadRequestObjectResult(new { message = first, errors });
        };
    });

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AccessService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "RequestVerificationToken";
    options.Cookie.Name = "VTT.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
});

// LocalDB: không bật EnableRetryOnFailure vì AccountController.Register
// đang dùng transaction tường minh. Hai cơ chế này không tương thích
// nếu transaction không được chạy bên trong execution strategy.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Home/AccessDenied";
        options.Cookie.Name = "VTT.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events.OnRedirectToLogin = context =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            { context.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; }
            context.Response.Redirect(context.RedirectUri); return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            { context.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; }
            context.Response.Redirect(context.RedirectUri); return Task.CompletedTask;
        };
        // Tài khoản đã bị xóa khỏi CSDL thì cookie cũ không còn giá trị.
        options.Events.OnValidatePrincipal = async context =>
        {
            if (!int.TryParse(context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }
            var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            if (!await db.Users.AnyAsync(u => u.Id == userId))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            }
        };
    });

builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = options.DefaultPolicy);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.HttpContext.Request.Path.StartsWithSegments("/api"))
            await context.HttpContext.Response.WriteAsJsonAsync(
                new { message = "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút." }, token);
    };

    options.AddFixedWindowLimiter("auth", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
        limiter.AutoReplenishment = true;
    });

    // Giới hạn API theo từng người dùng (hoặc theo IP nếu chưa đăng nhập).
    options.AddPolicy("api", httpContext =>
    {
        var key = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous";
        return RateLimitPartition.GetSlidingWindowLimiter(key, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 240,
            Window = TimeSpan.FromMinutes(1),
            SegmentsPerWindow = 6,
            QueueLimit = 0
        });
    });
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

// Lỗi của /api/* luôn trả JSON, đặt ngoài cùng để bắt cả lỗi từ các middleware phía sau.
app.UseMiddleware<ApiExceptionMiddleware>();

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    headers["Content-Security-Policy"] =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    await next();
});

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(name: "default", pattern: "{controller=Boards}/{action=Index}/{id?}");

// Áp dụng EF Core migrations. Dữ liệu mẫu chỉ được thêm khi bật Seed:DemoData
// (mặc định bật ở môi trường Development, tắt ở môi trường khác).
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    var seed = app.Configuration.GetValue<bool?>("Seed:DemoData") ?? app.Environment.IsDevelopment();
    if (seed)
    {
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        var demoPassword = app.Configuration["Seed:DemoPassword"] ?? DbInitializer.DefaultDemoPassword;
        await DbInitializer.SeedDemoDataAsync(db, hasher, demoPassword, logger);
    }
}

app.Run();
