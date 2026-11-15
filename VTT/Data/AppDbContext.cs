using Microsoft.EntityFrameworkCore;
using VTT.Models;

namespace VTT.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();
    public DbSet<Board> Boards => Set<Board>();
    public DbSet<BoardMember> BoardMembers => Set<BoardMember>();
    public DbSet<BoardStar> BoardStars => Set<BoardStar>();
    public DbSet<BoardList> Lists => Set<BoardList>();
    public DbSet<Card> Cards => Set<Card>();
    public DbSet<CardMember> CardMembers => Set<CardMember>();
    public DbSet<Label> Labels => Set<Label>();
    public DbSet<CardLabel> CardLabels => Set<CardLabel>();
    public DbSet<Checklist> Checklists => Set<Checklist>();
    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

    
        foreach (var fk in b.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.Restrict;

    
        b.Entity<WorkspaceMember>().HasKey(x => new { x.WorkspaceId, x.UserId });
        b.Entity<BoardMember>().HasKey(x => new { x.BoardId, x.UserId });
        b.Entity<BoardStar>().HasKey(x => new { x.BoardId, x.UserId });
        b.Entity<CardMember>().HasKey(x => new { x.CardId, x.UserId });
        b.Entity<CardLabel>().HasKey(x => new { x.CardId, x.LabelId });

       
        b.Entity<WorkspaceMember>().HasOne(x => x.Workspace).WithMany(x => x.Members).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Board>().HasOne(x => x.Workspace).WithMany(x => x.Boards).OnDelete(DeleteBehavior.Cascade);
        b.Entity<BoardMember>().HasOne(x => x.Board).WithMany(x => x.Members).OnDelete(DeleteBehavior.Cascade);
        b.Entity<BoardStar>().HasOne(x => x.Board).WithMany().OnDelete(DeleteBehavior.Cascade);
        b.Entity<BoardList>().HasOne(x => x.Board).WithMany(x => x.Lists).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Label>().HasOne(x => x.Board).WithMany(x => x.Labels).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Card>().HasOne(x => x.List).WithMany(x => x.Cards).OnDelete(DeleteBehavior.Cascade);
        b.Entity<CardMember>().HasOne(x => x.Card).WithMany(x => x.Members).OnDelete(DeleteBehavior.Cascade);
        b.Entity<CardLabel>().HasOne(x => x.Card).WithMany(x => x.CardLabels).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Checklist>().HasOne(x => x.Card).WithMany(x => x.Checklists).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ChecklistItem>().HasOne(x => x.Checklist).WithMany(x => x.Items).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Comment>().HasOne(x => x.Card).WithMany(x => x.Comments).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Attachment>().HasOne(x => x.Card).WithMany(x => x.Attachments).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Activity>().HasOne(x => x.Board).WithMany().OnDelete(DeleteBehavior.Cascade);
        b.Entity<Notification>().HasOne(x => x.User).WithMany().OnDelete(DeleteBehavior.Cascade);

        b.Entity<Board>().HasOne(x => x.Creator).WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Card>().HasOne(x => x.Creator).WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Attachment>().HasOne(x => x.Uploader).WithMany().HasForeignKey(x => x.UploadedBy).OnDelete(DeleteBehavior.Restrict);

       
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
        b.Entity<User>().HasIndex(x => x.UserName).IsUnique();
        b.Entity<BoardList>().HasIndex(x => new { x.BoardId, x.Position });
        b.Entity<Card>().HasIndex(x => new { x.ListId, x.Position });
        b.Entity<Activity>().HasIndex(x => new { x.BoardId, x.CreatedAt });
        b.Entity<Notification>().HasIndex(x => new { x.UserId, x.IsRead });
    }
}
