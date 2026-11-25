using System.Data.Common;
using Microsoft.EntityFrameworkCore;

namespace VTT.Middleware;

/// <summary>
/// Bắt mọi lỗi chưa xử lý trong /api/* và trả về JSON { message, traceId } thân thiện,
/// thay vì trang lỗi HTML hoặc stack trace.
/// </summary>
public class ApiExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiExceptionMiddleware> _log;

    public ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> log)
    { _next = next; _log = log; }

    public async Task InvokeAsync(HttpContext ctx)
    {
        if (!ctx.Request.Path.StartsWithSegments("/api"))
        {
            await _next(ctx);
            return;
        }

        try
        {
            await _next(ctx);
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
        {
            // Client đã ngắt kết nối, không cần phản hồi.
        }
        catch (Exception ex)
        {
            if (ctx.Response.HasStarted) throw;

            var (status, message) = ex switch
            {
                DbUpdateConcurrencyException => (StatusCodes.Status409Conflict,
                    "Dữ liệu đã được người khác thay đổi hoặc không còn tồn tại. Vui lòng tải lại trang."),
                DbUpdateException => (StatusCodes.Status409Conflict,
                    "Không thể lưu dữ liệu do xung đột hoặc ràng buộc dữ liệu. Vui lòng tải lại trang và thử lại."),
                DbException => (StatusCodes.Status503ServiceUnavailable,
                    "Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau."),
                BadHttpRequestException => (StatusCodes.Status400BadRequest,
                    "Yêu cầu không hợp lệ."),
                _ => (StatusCodes.Status500InternalServerError,
                    "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.")
            };

            _log.LogError(ex, "Lỗi API {Method} {Path} (trace {TraceId})",
                ctx.Request.Method, ctx.Request.Path, ctx.TraceIdentifier);

            ctx.Response.Clear();
            ctx.Response.StatusCode = status;
            await ctx.Response.WriteAsJsonAsync(new { message, traceId = ctx.TraceIdentifier });
        }
    }
}
