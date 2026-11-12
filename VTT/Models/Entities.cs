namespace VTT.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string UserName { get; set; } = "";
    public string FullName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Workspace
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int OwnerId { get; set; }
    public User? Owner { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Board> Boards { get; set; } = new();
    public List<WorkspaceMember> Members { get; set; } = new();
}

public class WorkspaceMember
{
    public int WorkspaceId { get; set; }
    public Workspace? Workspace { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Role { get; set; } = "Member";
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

public class Board
{
    public int Id { get; set; }
    public int WorkspaceId { get; set; }
    public Workspace? Workspace { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? Background { get; set; }
    public string Visibility { get; set; } = "Workspace";
    public bool IsClosed { get; set; }
    public int CreatedBy { get; set; }
    public User? Creator { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<BoardList> Lists { get; set; } = new();
    public List<Label> Labels { get; set; } = new();
    public List<BoardMember> Members { get; set; } = new();
}

public class BoardMember
{
    public int BoardId { get; set; }
    public Board? Board { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Role { get; set; } = "Member";
}

public class BoardStar
{
    public int BoardId { get; set; }
    public Board? Board { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
}

// Đặt tên BoardList để không trùng với System.Collections.Generic.List<T>
public class BoardList
{
    public int Id { get; set; }
    public int BoardId { get; set; }
    public Board? Board { get; set; }
    public string Title { get; set; } = "";
    public double Position { get; set; }
    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Card> Cards { get; set; } = new();
}

public class Card
{
    public int Id { get; set; }
    public int ListId { get; set; }
    public BoardList? List { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public double Position { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public bool IsDueDone { get; set; }
    public string? CoverColor { get; set; }
    public string? CoverUrl { get; set; }
    public bool IsArchived { get; set; }
    public int CreatedBy { get; set; }
    public User? Creator { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<CardMember> Members { get; set; } = new();
    public List<CardLabel> CardLabels { get; set; } = new();
    public List<Checklist> Checklists { get; set; } = new();
    public List<Comment> Comments { get; set; } = new();
    public List<Attachment> Attachments { get; set; } = new();
}

public class CardMember
{
    public int CardId { get; set; }
    public Card? Card { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
}

public class Label
{
    public int Id { get; set; }
    public int BoardId { get; set; }
    public Board? Board { get; set; }
    public string? Name { get; set; }
    public string Color { get; set; } = "green";
}

public class CardLabel
{
    public int CardId { get; set; }
    public Card? Card { get; set; }
    public int LabelId { get; set; }
    public Label? Label { get; set; }
}

public class Checklist
{
    public int Id { get; set; }
    public int CardId { get; set; }
    public Card? Card { get; set; }
    public string Title { get; set; } = "";
    public double Position { get; set; }
    public List<ChecklistItem> Items { get; set; } = new();
}

public class ChecklistItem
{
    public int Id { get; set; }
    public int ChecklistId { get; set; }
    public Checklist? Checklist { get; set; }
    public string Content { get; set; } = "";
    public bool IsChecked { get; set; }
    public double Position { get; set; }
    public int? AssigneeId { get; set; }
    public User? Assignee { get; set; }
    public DateTime? DueDate { get; set; }
}

public class Comment
{
    public int Id { get; set; }
    public int CardId { get; set; }
    public Card? Card { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Content { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }
}

public class Attachment
{
    public int Id { get; set; }
    public int CardId { get; set; }
    public Card? Card { get; set; }
    public int UploadedBy { get; set; }
    public User? Uploader { get; set; }
    public string FileName { get; set; } = "";
    public string FileUrl { get; set; } = "";
    public string? MimeType { get; set; }
    public long? SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Activity
{
    public long Id { get; set; }
    public int BoardId { get; set; }
    public Board? Board { get; set; }
    public int? CardId { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Action { get; set; } = "";
    public string? Payload { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Notification
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public long? ActivityId { get; set; }
    public Activity? Activity { get; set; }
    public string Message { get; set; } = "";
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
