const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

function getDefaultData() {
  const hashDemo = bcrypt.hashSync('demo', 10);
  const hash123 = bcrypt.hashSync('123456', 10);
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: 1,
        email: 'demo@vtt.local',
        userName: 'demo',
        fullName: 'Demo User',
        passwordHash: hashDemo,
        role: 'Admin',
        isLocked: false,
        avatar: 'D',
        createdAt: now
      },
      {
        id: 2,
        email: 'admin@vtt.local',
        userName: 'admin',
        fullName: 'Quản Trị Viên',
        passwordHash: hash123,
        role: 'Admin',
        isLocked: false,
        avatar: 'Q',
        createdAt: now
      },
      {
        id: 3,
        email: 'mai.tran@vtt.local',
        userName: 'maitran',
        fullName: 'Trần Thị Mai',
        passwordHash: hash123,
        role: 'Member',
        isLocked: false,
        avatar: 'M',
        createdAt: now
      },
      {
        id: 4,
        email: 'nam.le@vtt.local',
        userName: 'namle',
        fullName: 'Lê Hoàng Nam',
        passwordHash: hash123,
        role: 'Member',
        isLocked: false,
        avatar: 'N',
        createdAt: now
      },
      {
        id: 5,
        email: 'khoa.user@vtt.local',
        userName: 'userbikhoa',
        fullName: 'Người Dùng Bị Khóa',
        passwordHash: hash123,
        role: 'Member',
        isLocked: true,
        avatar: 'K',
        createdAt: now
      }
    ],
    workspaces: [
      {
        id: 1,
        name: 'Không gian làm việc VTT',
        description: 'Hệ thống quản lý công việc và dự án phân tán',
        category: 'Công nghệ & Kỹ thuật',
        ownerId: 1,
        createdAt: now
      }
    ],
    workspaceMembers: [
      { workspaceId: 1, userId: 1, role: 'Admin', joinedAt: now },
      { workspaceId: 1, userId: 2, role: 'Admin', joinedAt: now },
      { workspaceId: 1, userId: 3, role: 'Member', joinedAt: now },
      { workspaceId: 1, userId: 4, role: 'Member', joinedAt: now },
      { workspaceId: 1, userId: 5, role: 'Viewer', joinedAt: now }
    ],
    boards: [
      {
        id: 1,
        workspaceId: 1,
        title: 'Dự án Hệ thống Phân tán VTT',
        description: 'Quản lý tiến độ phát triển các phân hệ Web, API và Socket thời gian thực',
        background: 'linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%)',
        createdBy: 1,
        isClosed: false,
        createdAt: now
      },
      {
        id: 2,
        workspaceId: 1,
        title: 'Kế hoạch Marketing & Truyền thông',
        description: 'Chiến dịch ra mắt sản phẩm và tiếp thị khách hàng quý 4',
        background: 'linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%)',
        createdBy: 1,
        isClosed: false,
        createdAt: now
      }
    ],
    boardMembers: [
      { boardId: 1, userId: 1, role: 'Admin' },
      { boardId: 1, userId: 2, role: 'Admin' },
      { boardId: 1, userId: 3, role: 'Member' },
      { boardId: 1, userId: 4, role: 'Member' },
      { boardId: 2, userId: 1, role: 'Admin' }
    ],
    lists: [
      { id: 1, boardId: 1, title: 'Cần làm', position: 1024, isArchived: false, createdAt: now },
      { id: 2, boardId: 1, title: 'Đang làm', position: 2048, isArchived: false, createdAt: now },
      { id: 3, boardId: 1, title: 'Chờ duyệt', position: 3072, isArchived: false, createdAt: now },
      { id: 4, boardId: 1, title: 'Hoàn thành', position: 4096, isArchived: false, createdAt: now },
      // Board 2 lists
      { id: 5, boardId: 2, title: 'Cần làm', position: 1024, isArchived: false, createdAt: now },
      { id: 6, boardId: 2, title: 'Đang làm', position: 2048, isArchived: false, createdAt: now },
      { id: 7, boardId: 2, title: 'Chờ duyệt', position: 3072, isArchived: false, createdAt: now },
      { id: 8, boardId: 2, title: 'Hoàn thành', position: 4096, isArchived: false, createdAt: now }
    ],
    cards: [
      {
        id: 1,
        boardId: 1,
        listId: 1,
        title: 'Thiết kế giao diện người dùng theo bảng màu Pastel Pink',
        description: 'Tối ưu hóa UI/UX với chuẩn phối màu #fd79a8, responsive đa thiết bị, bố cục Kanban rõ ràng.',
        position: 1024,
        priority: 'High',
        progressPercent: 30,
        startDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 16),
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16),
        isDueDone: false,
        createdBy: 1,
        assignedUserIds: [1, 3],
        version: 1,
        isArchived: false,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 2,
        boardId: 1,
        listId: 2,
        title: 'Tích hợp Socket.IO đồng bộ thời gian thực và phát hiện xung đột',
        description: 'Xử lý đẩy cập nhật đa máy trạm, quản lý version và cơ chế tự động kết nối lại khi mất mạng.',
        position: 1024,
        priority: 'Urgent',
        progressPercent: 70,
        startDate: new Date(Date.now() - 86400000).toISOString().slice(0, 16),
        dueDate: new Date(Date.now() + 86400000 * 1).toISOString().slice(0, 16),
        isDueDone: false,
        createdBy: 1,
        assignedUserIds: [1, 2],
        version: 2,
        isArchived: false,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 3,
        boardId: 1,
        listId: 2,
        title: 'Xây dựng module Thống kê Báo cáo tiến độ & công việc quá hạn',
        description: 'Hiển thị tỷ lệ hoàn thành, thống kê công việc theo trạng thái, theo thành viên và danh sách trễ hạn.',
        position: 2048,
        priority: 'Medium',
        progressPercent: 50,
        startDate: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 16),
        dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 16), // quá hạn để test
        isDueDone: false,
        createdBy: 2,
        assignedUserIds: [4],
        version: 1,
        isArchived: false,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 4,
        boardId: 1,
        listId: 3,
        title: 'Kiểm thử phân quyền nhóm và khóa/mở khóa tài khoản',
        description: 'Kiểm tra role Admin, Member, Viewer, chức năng khóa tài khoản chặn đăng nhập tức thì.',
        position: 1024,
        priority: 'Medium',
        progressPercent: 90,
        startDate: new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 16),
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
        isDueDone: false,
        createdBy: 1,
        assignedUserIds: [3],
        version: 1,
        isArchived: false,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 5,
        boardId: 1,
        listId: 4,
        title: 'Khởi tạo cấu trúc cơ sở dữ liệu và xác thực danh tính',
        description: 'Cấu hình bảng Users, Workspaces, Boards, Cards, Comments và Activities.',
        position: 1024,
        priority: 'High',
        progressPercent: 100,
        startDate: new Date(Date.now() - 86400000 * 6).toISOString().slice(0, 16),
        dueDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 16),
        isDueDone: true,
        createdBy: 1,
        assignedUserIds: [1, 4],
        version: 1,
        isArchived: false,
        createdAt: now,
        updatedAt: now
      }
    ],
    comments: [
      {
        id: 1,
        cardId: 2,
        userId: 2,
        content: 'Đã hoàn thiện kiểm thử gửi tin nhắn Socket.IO giữa 2 tab trình duyệt.',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 2,
        cardId: 2,
        userId: 1,
        content: 'Rất tốt! Cần chú ý xử lý thêm popup phát hiện xung đột khi 2 người cùng sửa 1 thẻ.',
        createdAt: new Date(Date.now() - 3600000 * 1).toISOString()
      }
    ],
    activities: [
      {
        id: 1,
        boardId: 1,
        cardId: 2,
        userId: 1,
        action: 'status_changed',
        details: 'Đã chuyển thẻ sang cột Đang làm',
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
      },
      {
        id: 2,
        boardId: 1,
        cardId: 2,
        userId: 1,
        action: 'progress_updated',
        details: 'Cập nhật tiến độ hoàn thành lên 70%',
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: 3,
        boardId: 1,
        cardId: 5,
        userId: 1,
        action: 'status_changed',
        details: 'Đã chuyển thẻ sang cột Hoàn thành (100%)',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ],
    notifications: [
      {
        id: 1,
        userId: 1,
        title: 'Phân công công việc mới',
        message: 'Bạn được phân công vào công việc: Thiết kế giao diện người dùng',
        type: 'assign',
        cardId: 1,
        boardId: 1,
        isRead: false,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 2,
        userId: 1,
        title: 'Cảnh báo sắp đến hạn',
        message: 'Công việc "Tích hợp Socket.IO đồng bộ thời gian thực" sắp hết hạn trong 24 giờ tới!',
        type: 'due_soon',
        cardId: 2,
        boardId: 1,
        isRead: false,
        createdAt: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: 3,
        userId: 1,
        title: 'Trạng thái công việc thay đổi',
        message: 'Công việc "Khởi tạo cấu trúc cơ sở dữ liệu" đã được chuyển sang Hoàn thành.',
        type: 'status',
        cardId: 5,
        boardId: 1,
        isRead: true,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ],
    chatMessages: [
      {
        id: 1,
        workspaceId: 1,
        boardId: 1,
        userId: 2,
        content: 'Chào cả nhóm! Hôm nay chúng ta tập trung hoàn thiện giao diện Node.js và đồng bộ real-time nhé.',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
      },
      {
        id: 2,
        workspaceId: 1,
        boardId: 1,
        userId: 3,
        content: 'Vâng anh! Em đang kiểm tra các bảng Kanban và chức năng kéo thả.',
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: 3,
        workspaceId: 1,
        boardId: 1,
        userId: 1,
        content: 'Tuyệt vời. Mọi người có thể mở 2 tab song song để kiểm tra đẩy dữ liệu trực tiếp tức thì.',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ]
  };
}

class Database {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      this.data = getDefaultData();
      this.save();
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Lỗi đọc db.json, khởi tạo lại dữ liệu mặc định:', err);
        this.data = getDefaultData();
        this.save();
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Lỗi ghi db.json:', err);
    }
  }

  // --- Users ---
  getUserById(id) {
    return this.data.users.find(u => u.id === Number(id));
  }

  getUserByEmailOrUsername(val) {
    if (!val) return null;
    const lower = val.trim().toLowerCase();
    return this.data.users.find(u =>
      (u.email && u.email.toLowerCase() === lower) ||
      (u.userName && u.userName.toLowerCase() === lower)
    );
  }

  createUser(userData) {
    const id = this.data.users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
    const user = {
      id,
      email: userData.email,
      userName: userData.userName,
      fullName: userData.fullName,
      passwordHash: userData.passwordHash,
      role: userData.role || 'Member',
      isLocked: false,
      avatar: (userData.fullName || 'U')[0].toUpperCase(),
      createdAt: new Date().toISOString()
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id, updates) {
    const user = this.getUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  toggleLockUser(id) {
    const user = this.getUserById(id);
    if (!user) return null;
    user.isLocked = !user.isLocked;
    this.save();
    return user;
  }

  getAllUsers() {
    return this.data.users;
  }

  // --- Workspaces ---
  getWorkspaceById(id) {
    return this.data.workspaces.find(w => w.id === Number(id));
  }

  getAllWorkspaces() {
    return this.data.workspaces;
  }

  createWorkspace(name, description, category, ownerId) {
    const id = this.data.workspaces.reduce((max, w) => Math.max(max, w.id), 0) + 1;
    const ws = {
      id,
      name,
      description: description || '',
      category: category || 'Chung',
      ownerId: Number(ownerId),
      createdAt: new Date().toISOString()
    };
    this.data.workspaces.push(ws);
    // Add owner as Admin member
    this.data.workspaceMembers.push({
      workspaceId: id,
      userId: Number(ownerId),
      role: 'Admin',
      joinedAt: new Date().toISOString()
    });
    this.save();
    return ws;
  }

  updateWorkspace(id, updates) {
    const ws = this.getWorkspaceById(id);
    if (!ws) return null;
    Object.assign(ws, updates);
    this.save();
    return ws;
  }

  getWorkspaceMembers(wsId) {
    const members = this.data.workspaceMembers.filter(m => m.workspaceId === Number(wsId));
    return members.map(m => {
      const u = this.getUserById(m.userId);
      return {
        ...m,
        user: u ? { id: u.id, fullName: u.fullName, email: u.email, userName: u.userName, avatar: u.avatar, isLocked: u.isLocked } : null
      };
    });
  }

  addWorkspaceMember(wsId, userId, role = 'Member') {
    const exists = this.data.workspaceMembers.some(m => m.workspaceId === Number(wsId) && m.userId === Number(userId));
    if (exists) return false;
    this.data.workspaceMembers.push({
      workspaceId: Number(wsId),
      userId: Number(userId),
      role: role || 'Member',
      joinedAt: new Date().toISOString()
    });
    this.save();
    return true;
  }

  updateWorkspaceMemberRole(wsId, userId, newRole) {
    const member = this.data.workspaceMembers.find(m => m.workspaceId === Number(wsId) && m.userId === Number(userId));
    if (!member) return false;
    member.role = newRole;
    this.save();
    return true;
  }

  removeWorkspaceMember(wsId, userId) {
    const initialLen = this.data.workspaceMembers.length;
    this.data.workspaceMembers = this.data.workspaceMembers.filter(
      m => !(m.workspaceId === Number(wsId) && m.userId === Number(userId))
    );
    this.save();
    return this.data.workspaceMembers.length < initialLen;
  }

  // --- Boards ---
  getBoardById(id) {
    return this.data.boards.find(b => b.id === Number(id));
  }

  getBoardsByWorkspace(wsId) {
    return this.data.boards.filter(b => b.workspaceId === Number(wsId) && !b.isClosed);
  }

  createBoard(wsId, title, background, createdBy, description = '') {
    const id = this.data.boards.reduce((max, b) => Math.max(max, b.id), 0) + 1;
    const now = new Date().toISOString();
    const board = {
      id,
      workspaceId: Number(wsId),
      title,
      description,
      background: background || 'linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%)',
      createdBy: Number(createdBy),
      isClosed: false,
      createdAt: now
    };
    this.data.boards.push(board);

    // Add 4 standard columns
    const columns = ['Cần làm', 'Đang làm', 'Chờ duyệt', 'Hoàn thành'];
    let maxListId = this.data.lists.reduce((max, l) => Math.max(max, l.id), 0);
    for (let i = 0; i < columns.length; i++) {
      maxListId++;
      this.data.lists.push({
        id: maxListId,
        boardId: id,
        title: columns[i],
        position: (i + 1) * 1024,
        isArchived: false,
        createdAt: now
      });
    }

    // Add creator to board members
    this.data.boardMembers.push({
      boardId: id,
      userId: Number(createdBy),
      role: 'Admin'
    });

    this.save();
    return board;
  }

  // --- Lists & Cards ---
  getListsByBoard(boardId) {
    return this.data.lists
      .filter(l => l.boardId === Number(boardId) && !l.isArchived)
      .sort((a, b) => a.position - b.position);
  }

  createList(boardId, title) {
    const maxPos = this.data.lists
      .filter(l => l.boardId === Number(boardId))
      .reduce((max, l) => Math.max(max, l.position), 0);
    const id = this.data.lists.reduce((max, l) => Math.max(max, l.id), 0) + 1;
    const list = {
      id,
      boardId: Number(boardId),
      title,
      position: maxPos + 1024,
      isArchived: false,
      createdAt: new Date().toISOString()
    };
    this.data.lists.push(list);
    this.save();
    return list;
  }

  renameList(listId, newTitle) {
    const list = this.data.lists.find(l => l.id === Number(listId));
    if (!list) return null;
    list.title = newTitle;
    this.save();
    return list;
  }

  getCardsByBoard(boardId) {
    return this.data.cards
      .filter(c => c.boardId === Number(boardId) && !c.isArchived)
      .sort((a, b) => a.position - b.position);
  }

  getCardById(id) {
    return this.data.cards.find(c => c.id === Number(id));
  }

  createCard(cardData) {
    const id = this.data.cards.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const list = this.data.lists.find(l => l.id === Number(cardData.listId));
    const boardId = list ? list.boardId : (cardData.boardId || 1);

    const maxPos = this.data.cards
      .filter(c => c.listId === Number(cardData.listId))
      .reduce((max, c) => Math.max(max, c.position), 0);

    const now = new Date().toISOString();
    const card = {
      id,
      boardId,
      listId: Number(cardData.listId),
      title: cardData.title,
      description: cardData.description || '',
      position: maxPos + 1024,
      priority: cardData.priority || 'Medium',
      progressPercent: Number(cardData.progressPercent) || 0,
      startDate: cardData.startDate || null,
      dueDate: cardData.dueDate || null,
      isDueDone: Boolean(cardData.isDueDone),
      createdBy: Number(cardData.createdBy) || 1,
      assignedUserIds: Array.isArray(cardData.assignedUserIds) ? cardData.assignedUserIds : [],
      version: 1,
      isArchived: false,
      createdAt: now,
      updatedAt: now
    };
    this.data.cards.push(card);

    this.addActivity({
      boardId,
      cardId: id,
      userId: card.createdBy,
      action: 'created',
      details: `Đã tạo công việc "${card.title}"`
    });

    this.save();
    return card;
  }

  updateCard(id, updates, expectedVersion = null) {
    const card = this.getCardById(id);
    if (!card) return { error: 'not_found' };

    // Conflict detection: if client sent an expected version and it does not match current version
    if (expectedVersion !== null && expectedVersion !== undefined) {
      if (Number(expectedVersion) !== Number(card.version)) {
        return {
          error: 'conflict',
          currentVersion: card.version,
          serverCard: card,
          message: 'Dữ liệu công việc vừa được cập nhật bởi một người dùng khác.'
        };
      }
    }

    const prevListId = card.listId;
    const prevProgress = card.progressPercent;
    const prevPriority = card.priority;

    Object.assign(card, updates);
    card.version = (card.version || 1) + 1;
    card.updatedAt = new Date().toISOString();

    // Log activities for meaningful changes
    if (updates.listId && updates.listId !== prevListId) {
      const targetList = this.data.lists.find(l => l.id === Number(updates.listId));
      this.addActivity({
        boardId: card.boardId,
        cardId: card.id,
        userId: updates.userId || card.createdBy,
        action: 'status_changed',
        details: `Đã chuyển sang cột "${targetList ? targetList.title : updates.listId}"`
      });
    }

    if (updates.progressPercent !== undefined && updates.progressPercent !== prevProgress) {
      this.addActivity({
        boardId: card.boardId,
        cardId: card.id,
        userId: updates.userId || card.createdBy,
        action: 'progress_updated',
        details: `Cập nhật tiến độ: ${updates.progressPercent}%`
      });
    }

    if (updates.priority && updates.priority !== prevPriority) {
      this.addActivity({
        boardId: card.boardId,
        cardId: card.id,
        userId: updates.userId || card.createdBy,
        action: 'priority_changed',
        details: `Đổi mức ưu tiên thành ${updates.priority}`
      });
    }

    this.save();
    return { success: true, card };
  }

  deleteCard(id, userId = 1) {
    const card = this.getCardById(id);
    if (!card) return false;

    this.addActivity({
      boardId: card.boardId,
      cardId: null,
      userId,
      action: 'deleted',
      details: `Đã xóa vĩnh viễn công việc "${card.title}"`
    });

    this.data.cards = this.data.cards.filter(c => c.id !== Number(id));
    this.data.comments = this.data.comments.filter(m => m.cardId !== Number(id));
    this.save();
    return true;
  }

  // --- Comments ---
  getCommentsByCard(cardId) {
    return this.data.comments
      .filter(c => c.cardId === Number(cardId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(c => {
        const u = this.getUserById(c.userId);
        return {
          ...c,
          user: u ? u.fullName : 'Người dùng',
          avatar: u ? u.avatar : 'U'
        };
      });
  }

  addComment(cardId, userId, content) {
    const id = this.data.comments.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const now = new Date().toISOString();
    const comment = {
      id,
      cardId: Number(cardId),
      userId: Number(userId),
      content,
      createdAt: now
    };
    this.data.comments.push(comment);

    const card = this.getCardById(cardId);
    if (card) {
      this.addActivity({
        boardId: card.boardId,
        cardId: card.id,
        userId,
        action: 'commented',
        details: `Đã thêm bình luận: "${content.slice(0, 40)}${content.length > 40 ? '...' : ''}"`
      });
    }

    this.save();
    const u = this.getUserById(userId);
    return {
      ...comment,
      user: u ? u.fullName : 'Người dùng',
      avatar: u ? u.avatar : 'U'
    };
  }

  // --- Activities ---
  getActivitiesByBoard(boardId) {
    return this.data.activities
      .filter(a => a.boardId === Number(boardId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
      .map(a => {
        const u = this.getUserById(a.userId);
        return {
          ...a,
          userName: u ? u.fullName : 'Hệ thống',
          avatar: u ? u.avatar : 'H'
        };
      });
  }

  getActivitiesByCard(cardId) {
    return this.data.activities
      .filter(a => a.cardId === Number(cardId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 30)
      .map(a => {
        const u = this.getUserById(a.userId);
        return {
          ...a,
          userName: u ? u.fullName : 'Hệ thống',
          avatar: u ? u.avatar : 'H'
        };
      });
  }

  addActivity({ boardId, cardId, userId, action, details }) {
    const id = this.data.activities.reduce((max, a) => Math.max(max, a.id), 0) + 1;
    this.data.activities.push({
      id,
      boardId: Number(boardId),
      cardId: cardId ? Number(cardId) : null,
      userId: Number(userId),
      action,
      details,
      createdAt: new Date().toISOString()
    });
  }

  // --- Notifications ---
  getNotificationsByUser(userId) {
    return this.data.notifications
      .filter(n => n.userId === Number(userId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  addNotification({ userId, title, message, type = 'system', cardId = null, boardId = null }) {
    const id = this.data.notifications.reduce((max, n) => Math.max(max, n.id), 0) + 1;
    const notif = {
      id,
      userId: Number(userId),
      title,
      message,
      type,
      cardId: cardId ? Number(cardId) : null,
      boardId: boardId ? Number(boardId) : null,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    this.data.notifications.push(notif);
    this.save();
    return notif;
  }

  markNotificationAsRead(id, userId) {
    const notif = this.data.notifications.find(n => n.id === Number(id) && n.userId === Number(userId));
    if (notif) {
      notif.isRead = true;
      this.save();
      return true;
    }
    return false;
  }

  markAllNotificationsAsRead(userId) {
    this.data.notifications.forEach(n => {
      if (n.userId === Number(userId)) n.isRead = true;
    });
    this.save();
    return true;
  }

  // --- Team Chat ---
  getChatMessages(workspaceId, limit = 50) {
    return this.data.chatMessages
      .filter(m => m.workspaceId === Number(workspaceId))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-limit)
      .map(m => {
        const u = this.getUserById(m.userId);
        return {
          ...m,
          userName: u ? u.fullName : 'Thành viên',
          avatar: u ? u.avatar : 'U'
        };
      });
  }

  addChatMessage(workspaceId, userId, content, boardId = null) {
    const id = this.data.chatMessages.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const msg = {
      id,
      workspaceId: Number(workspaceId),
      boardId: boardId ? Number(boardId) : null,
      userId: Number(userId),
      content,
      createdAt: new Date().toISOString()
    };
    this.data.chatMessages.push(msg);
    this.save();
    const u = this.getUserById(userId);
    return {
      ...msg,
      userName: u ? u.fullName : 'Thành viên',
      avatar: u ? u.avatar : 'U'
    };
  }

  // --- Statistics & Reports ---
  getStatistics(workspaceId = null, boardId = null) {
    let cards = this.data.cards.filter(c => !c.isArchived);
    if (boardId) {
      cards = cards.filter(c => c.boardId === Number(boardId));
    } else if (workspaceId) {
      const boardIds = this.data.boards.filter(b => b.workspaceId === Number(workspaceId)).map(b => b.id);
      cards = cards.filter(c => boardIds.includes(c.boardId));
    }

    const now = new Date();

    // Trạng thái theo tên danh sách chuẩn
    const statusMap = {
      'Cần làm': 0,
      'Đang làm': 0,
      'Chờ duyệt': 0,
      'Hoàn thành': 0
    };

    const overdueList = [];
    const memberMap = {};

    // Khởi tạo thành viên
    this.data.users.forEach(u => {
      memberMap[u.id] = {
        id: u.id,
        fullName: u.fullName,
        avatar: u.avatar,
        email: u.email,
        assignedCount: 0,
        completedCount: 0,
        inProgressCount: 0,
        overdueCount: 0
      };
    });

    cards.forEach(card => {
      const list = this.data.lists.find(l => l.id === card.listId);
      const listTitle = list ? list.title : 'Cần làm';

      if (statusMap[listTitle] !== undefined) {
        statusMap[listTitle]++;
      } else {
        statusMap['Cần làm']++;
      }

      const isCompleted = listTitle === 'Hoàn thành' || card.progressPercent === 100 || card.isDueDone;
      const isOverdue = !isCompleted && card.dueDate && new Date(card.dueDate) < now;

      if (isOverdue) {
        const diffDays = Math.ceil((now - new Date(card.dueDate)) / (1000 * 60 * 60 * 24));
        overdueList.push({
          id: card.id,
          title: card.title,
          boardTitle: (this.getBoardById(card.boardId) || {}).title || 'Bảng',
          listTitle,
          priority: card.priority,
          progressPercent: card.progressPercent,
          dueDate: card.dueDate,
          daysOverdue: diffDays,
          assignedUsers: (card.assignedUserIds || []).map(uid => this.getUserById(uid)).filter(Boolean)
        });
      }

      // Thống kê theo thành viên
      (card.assignedUserIds || []).forEach(uid => {
        if (memberMap[uid]) {
          memberMap[uid].assignedCount++;
          if (isCompleted) memberMap[uid].completedCount++;
          else if (listTitle === 'Đang làm') memberMap[uid].inProgressCount++;
          if (isOverdue) memberMap[uid].overdueCount++;
        }
      });
    });

    const totalCards = cards.length;
    const completedCards = statusMap['Hoàn thành'] || 0;
    const completionRate = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

    return {
      totalCards,
      completedCards,
      inProgressCards: statusMap['Đang làm'] || 0,
      inReviewCards: statusMap['Chờ duyệt'] || 0,
      todoCards: statusMap['Cần làm'] || 0,
      overdueCards: overdueList.length,
      completionRate,
      statusBreakdown: statusMap,
      overdueList: overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue),
      membersReport: Object.values(memberMap).filter(m => m.assignedCount > 0 || m.id === 1)
    };
  }
}

module.exports = new Database();
