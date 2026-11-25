using VTT.Data;
using VTT.Models;

namespace VTT.Services;

public static class WorkspaceFactory
{
    /// <summary>Tạo workspace mới (chủ sở hữu là Admin) kèm một bảng mặc định có 3 danh sách.</summary>
    public static Workspace CreateWithDefaultBoard(int ownerId, string name)
    {
        var workspace = new Workspace { Name = name, OwnerId = ownerId };
        workspace.Members.Add(new WorkspaceMember { UserId = ownerId, Role = AccessService.Admin });

        var board = new Board
        {
            Title = "Công việc của tôi",
            Background = DbInitializer.DefaultBackground,
            CreatedBy = ownerId
        };
        board.Members.Add(new BoardMember { UserId = ownerId, Role = AccessService.Admin });
        var i = 0;
        foreach (var title in new[] { "Cần làm", "Đang làm", "Hoàn thành" })
            board.Lists.Add(new BoardList { Title = title, Position = ++i * 1024 });

        workspace.Boards.Add(board);
        return workspace;
    }
}
