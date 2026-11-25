using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace VTT.Controllers;

[AllowAnonymous]
public class HomeController : Controller
{
    public IActionResult Index() => View();

    public IActionResult Error() => View();

    public IActionResult AccessDenied() => StatusCode(403, "Bạn không có quyền truy cập chức năng này.");
}
