using Microsoft.AspNetCore.Mvc;

namespace VTT.Controllers;

public class HomeController : Controller
{
    public IActionResult Index() => View();

    public IActionResult Error() => View();
}
