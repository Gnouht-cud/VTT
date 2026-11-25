using System.Globalization;
using System.Net.Mail;
using System.Text.RegularExpressions;

namespace VTT.Services;

/// <summary>Quy tắc kiểm tra dữ liệu đầu vào dùng chung cho MVC và API.</summary>
public static class InputRules
{
    public const int MaxEmail = 256;
    public const int MaxFullName = 100;
    public const int MaxPassword = 128;
    public const int MinPassword = 8;

    private static readonly Regex UserNameRegex = new(@"^[a-z0-9._-]{3,30}$", RegexOptions.Compiled);

    // Chỉ cho phép màu hex hoặc linear-gradient hai màu hex để tránh chèn CSS tùy ý (url(), expression...).
    private static readonly Regex BackgroundRegex = new(
        @"^(#[0-9a-fA-F]{3,8}|linear-gradient\(\s*\d{1,3}deg\s*,\s*#[0-9a-fA-F]{3,8}(\s+\d{1,3}%)?\s*,\s*#[0-9a-fA-F]{3,8}(\s+\d{1,3}%)?\s*\))$",
        RegexOptions.Compiled);

    private static readonly string[] DueFormats =
        { "yyyy-MM-ddTHH:mm", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd" };

    public static readonly string[] BoardVisibilities = { "Workspace", "Private" };
    public static readonly string[] WorkspaceRoles = { "Admin", "Member" };

    /// <summary>Cắt khoảng trắng hai đầu và gộp khoảng trắng liên tiếp.</summary>
    public static string Clean(string? value) =>
        Regex.Replace((value ?? "").Trim(), @"\s+", " ");

    public static bool IsValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > MaxEmail) return false;
        return MailAddress.TryCreate(email.Trim(), out var addr) && addr.Address == email.Trim();
    }

    public static bool IsValidUserName(string? userName) =>
        !string.IsNullOrEmpty(userName) && UserNameRegex.IsMatch(userName);

    /// <summary>Trả về thông báo lỗi tiếng Việt hoặc null nếu mật khẩu hợp lệ.</summary>
    public static string? ValidatePassword(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinPassword)
            return $"Mật khẩu phải có ít nhất {MinPassword} ký tự.";
        if (password.Length > MaxPassword)
            return $"Mật khẩu tối đa {MaxPassword} ký tự.";
        if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
            return "Mật khẩu phải chứa cả chữ cái và chữ số.";
        return null;
    }

    public static bool IsValidBackground(string? background) =>
        !string.IsNullOrWhiteSpace(background) && background.Length <= 200 && BackgroundRegex.IsMatch(background);

    /// <summary>
    /// Phân tích ngày hết hạn từ chuỗi do client gửi. Chuỗi rỗng nghĩa là xóa hạn.
    /// Trả về false nếu định dạng sai hoặc ngoài khoảng 2000-2100.
    /// </summary>
    public static bool TryParseDue(string? raw, out DateTime? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(raw)) return true;
        if (!DateTime.TryParseExact(raw.Trim(), DueFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            return false;
        if (parsed.Year < 2000 || parsed.Year > 2100) return false;
        value = parsed;
        return true;
    }
}
