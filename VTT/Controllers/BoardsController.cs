using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VTT.Data;

namespace VTT.Controllers;

public class BoardsController : Controller
{
    private readonly AppDbContext _db;

    public BoardsController(AppDbContext db) => _db = db;

    public async Task<IActionResult> Index()
    {
        var boards = await _db.Boards.Where(b => !b.IsClosed).OrderBy(b => b.Id).ToListAsync();
        return View(boards);
    }

    public async Task<IActionResult> Details(int id)
    {
        var board = await _db.Boards.FindAsync(id);
        return board == null ? NotFound() : View(board);
    }
}
