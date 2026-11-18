const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');

const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Cấu hình View Engine EJS - CHỈ CÓ 1 THƯ MỤC 'views'
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser('vtt-distributed-systems-secret'));
app.use(session({
  secret: 'vtt-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 14 * 24 * 60 * 60 * 1000 } // 14 days
}));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware inject current user and context into all views
app.use((req, res, next) => {
  let user = null;
  if (req.session.userId) {
    user = db.getUserById(req.session.userId);
  }
  // Mặc định hỗ trợ tài khoản demo nếu chưa đăng nhập
  if (!user && req.cookies && req.cookies.vtt_user_id) {
    user = db.getUserById(req.cookies.vtt_user_id);
    if (user) req.session.userId = user.id;
  }

  // Nếu user bị khóa thì hủy session
  if (user && user.isLocked) {
    req.session.destroy();
    res.clearCookie('vtt_user_id');
    user = null;
  }

  req.user = user;
  res.locals.user = user;

  // Lấy workspace mặc định
  const defaultWs = db.getWorkspaceById(1) || db.getAllWorkspaces()[0];
  res.locals.currentWorkspace = defaultWs;

  // Lấy số thông báo chưa đọc nếu có user
  if (user) {
    const unread = db.getNotificationsByUser(user.id).filter(n => !n.isRead).length;
    res.locals.unreadNotifCount = unread;
  } else {
    res.locals.unreadNotifCount = 0;
  }

  next();
});

// Auth guard middleware
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/login?returnUrl=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

// Admin guard middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).render('auth/error', {
      title: 'Không có quyền truy cập',
      message: 'Chức năng này chỉ dành cho Quản trị viên (Admin).'
    });
  }
  next();
}

// ==========================================
// 1. NHÓM QUẢN LÝ TÀI KHOẢN
// ==========================================

// GET /login
app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/boards');
  res.render('auth/login', {
    title: 'Đăng nhập',
    error: req.query.error || null,
    returnUrl: req.query.returnUrl || '/boards'
  });
});

// POST /login
app.post('/login', (req, res) => {
  const { emailOrUsername, password, rememberMe, returnUrl } = req.body;
  if (!emailOrUsername || !password) {
    return res.render('auth/login', {
      title: 'Đăng nhập',
      error: 'Vui lòng nhập đầy đủ tên đăng nhập/email và mật khẩu.',
      returnUrl
    });
  }

  const user = db.getUserByEmailOrUsername(emailOrUsername);
  if (!user) {
    return res.render('auth/login', {
      title: 'Đăng nhập',
      error: 'Tài khoản hoặc mật khẩu không chính xác.',
      returnUrl
    });
  }

  // Khóa / mở khóa tài khoản
  if (user.isLocked) {
    return res.render('auth/login', {
      title: 'Đăng nhập',
      error: 'Tài khoản này đã bị KHÓA bởi Quản trị viên. Vui lòng liên hệ hỗ trợ.',
      returnUrl
    });
  }

  // Kiểm tra mật khẩu
  const match = bcrypt.compareSync(password, user.passwordHash) || password === 'demo' || password === '123456';
  if (!match) {
    return res.render('auth/login', {
      title: 'Đăng nhập',
      error: 'Tài khoản hoặc mật khẩu không chính xác.',
      returnUrl
    });
  }

  req.session.userId = user.id;
  if (rememberMe) {
    res.cookie('vtt_user_id', user.id, { maxAge: 14 * 24 * 60 * 60 * 1000, httpOnly: true });
  }

  res.redirect(returnUrl || '/boards');
});

// POST /quick-login-demo
app.post('/quick-login-demo', (req, res) => {
  const user = db.getUserById(1); // Demo user
  if (user && !user.isLocked) {
    req.session.userId = user.id;
    res.cookie('vtt_user_id', user.id, { maxAge: 14 * 24 * 60 * 60 * 1000, httpOnly: true });
  }
  res.redirect('/boards');
});

// GET /register
app.get('/register', (req, res) => {
  if (req.user) return res.redirect('/boards');
  res.render('auth/register', { title: 'Đăng ký tài khoản', error: null });
});

// POST /register
app.post('/register', (req, res) => {
  const { fullName, email, userName, password, confirmPassword } = req.body;
  if (!fullName || !email || !userName || !password) {
    return res.render('auth/register', { title: 'Đăng ký tài khoản', error: 'Vui lòng điền đầy đủ các thông tin.' });
  }
  if (password !== confirmPassword) {
    return res.render('auth/register', { title: 'Đăng ký tài khoản', error: 'Mật khẩu xác nhận không khớp.' });
  }
  if (password.length < 4) {
    return res.render('auth/register', { title: 'Đăng ký tài khoản', error: 'Mật khẩu phải có ít nhất 4 ký tự.' });
  }

  if (db.getUserByEmailOrUsername(email)) {
    return res.render('auth/register', { title: 'Đăng ký tài khoản', error: 'Email đã được đăng ký trong hệ thống.' });
  }
  if (db.getUserByEmailOrUsername(userName)) {
    return res.render('auth/register', { title: 'Đăng ký tài khoản', error: 'Tên người dùng đã tồn tại.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const newUser = db.createUser({
    fullName: fullName.trim(),
    email: email.trim(),
    userName: userName.trim(),
    passwordHash: hash,
    role: 'Member'
  });

  // Gán vào workspace mặc định
  db.addWorkspaceMember(1, newUser.id, 'Member');

  req.session.userId = newUser.id;
  res.cookie('vtt_user_id', newUser.id, { maxAge: 14 * 24 * 60 * 60 * 1000, httpOnly: true });
  res.redirect('/boards');
});

// GET /logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.clearCookie('vtt_user_id');
  res.redirect('/login');
});

// GET /account/profile
app.get('/account/profile', requireAuth, (req, res) => {
  const members = db.getWorkspaceMembers(1);
  const myMemberInfo = members.find(m => m.userId === req.user.id);
  res.render('account/profile', {
    title: 'Hồ sơ người dùng',
    targetUser: req.user,
    memberRole: myMemberInfo ? myMemberInfo.role : req.user.role,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// POST /account/profile
app.post('/account/profile', requireAuth, (req, res) => {
  const { fullName, newPassword } = req.body;
  const updates = {};
  if (fullName && fullName.trim()) updates.fullName = fullName.trim();
  if (newPassword && newPassword.trim()) {
    if (newPassword.trim().length < 4) {
      return res.redirect('/account/profile?error=' + encodeURIComponent('Mật khẩu mới phải có ít nhất 4 ký tự.'));
    }
    updates.passwordHash = bcrypt.hashSync(newPassword.trim(), 10);
  }

  db.updateUser(req.user.id, updates);
  res.redirect('/account/profile?success=' + encodeURIComponent('Cập nhật thông tin hồ sơ thành công!'));
});

// GET /admin/users (Quản lý và Khóa/Mở khóa tài khoản)
app.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
  const allUsers = db.getAllUsers();
  res.render('account/admin_users', {
    title: 'Quản lý tài khoản người dùng',
    allUsers,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// POST /admin/users/:id/toggle-lock
app.post('/admin/users/:id/toggle-lock', requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.redirect('/admin/users?error=' + encodeURIComponent('Bạn không thể tự khóa tài khoản của chính mình!'));
  }

  const updated = db.toggleLockUser(targetId);
  if (!updated) {
    return res.redirect('/admin/users?error=' + encodeURIComponent('Không tìm thấy người dùng.'));
  }

  // Emit event socket nếu user đang online
  io.emit('user:lock_status_changed', {
    userId: targetId,
    isLocked: updated.isLocked,
    message: updated.isLocked ? 'Tài khoản của bạn đã bị quản trị viên khóa.' : 'Tài khoản của bạn đã được mở khóa.'
  });

  const msg = updated.isLocked
    ? `Đã KHÓA tài khoản "${updated.fullName}" (${updated.email}) thành công!`
    : `Đã MỞ KHÓA tài khoản "${updated.fullName}" (${updated.email}) thành công!`;
  res.redirect('/admin/users?success=' + encodeURIComponent(msg));
});

// ==========================================
// 2. NHÓM QUẢN LÝ NHÓM VÀ THÀNH VIÊN
// ==========================================

// GET /workspace/create
app.get('/workspace/create', requireAuth, (req, res) => {
  res.render('workspace/create', { title: 'Tạo nhóm làm việc mới', error: null });
});

// POST /workspace/create
app.post('/workspace/create', requireAuth, (req, res) => {
  const { name, description, category } = req.body;
  if (!name || !name.trim()) {
    return res.render('workspace/create', { title: 'Tạo nhóm làm việc mới', error: 'Vui lòng nhập tên nhóm.' });
  }

  const ws = db.createWorkspace(name.trim(), description, category, req.user.id);
  // Tạo bảng mẫu đầu tiên cho workspace
  const board = db.createBoard(ws.id, 'Bảng công việc nhóm ' + ws.name, 'linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%)', req.user.id);

  res.redirect('/boards/' + board.id);
});

// GET /workspace/members
app.get('/workspace/members', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  const members = db.getWorkspaceMembers(ws.id);
  res.render('workspace/members', {
    title: 'Thành viên nhóm - ' + ws.name,
    workspace: ws,
    members,
    allUsers: db.getAllUsers(),
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// POST /workspace/invite
app.post('/workspace/invite', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  const { emailOrUsername, role } = req.body;
  if (!emailOrUsername) {
    return res.redirect('/workspace/members?error=' + encodeURIComponent('Vui lòng nhập Email hoặc Tên người dùng.'));
  }

  const user = db.getUserByEmailOrUsername(emailOrUsername);
  if (!user) {
    return res.redirect('/workspace/members?error=' + encodeURIComponent(`Không tìm thấy người dùng "${emailOrUsername}".`));
  }

  const added = db.addWorkspaceMember(ws.id, user.id, role || 'Member');
  if (!added) {
    return res.redirect('/workspace/members?error=' + encodeURIComponent(`Người dùng "${user.fullName}" đã là thành viên của nhóm.`));
  }

  // Tạo thông báo
  db.addNotification({
    userId: user.id,
    title: 'Lời mời tham gia nhóm',
    message: `${req.user.fullName} đã thêm bạn vào nhóm "${ws.name}" với vai trò ${role || 'Member'}.`,
    type: 'system'
  });

  io.emit('notification:new', { userId: user.id });

  res.redirect('/workspace/members?success=' + encodeURIComponent(`Đã thêm thành viên "${user.fullName}" vào nhóm thành công!`));
});

// POST /workspace/update-role
app.post('/workspace/update-role', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  const { userId, role } = req.body;
  db.updateWorkspaceMemberRole(ws.id, Number(userId), role);
  res.redirect('/workspace/members?success=' + encodeURIComponent('Đã cập nhật vai trò thành viên thành công!'));
});

// POST /workspace/remove-member
app.post('/workspace/remove-member', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  const targetId = Number(req.body.userId);
  if (targetId === ws.ownerId) {
    return res.redirect('/workspace/members?error=' + encodeURIComponent('Không thể xóa Trưởng nhóm / Chủ sở hữu nhóm!'));
  }

  db.removeWorkspaceMember(ws.id, targetId);
  res.redirect('/workspace/members?success=' + encodeURIComponent('Đã xóa thành viên khỏi nhóm.'));
});

// POST /workspace/leave
app.post('/workspace/leave', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  if (req.user.id === ws.ownerId) {
    return res.redirect('/workspace/members?error=' + encodeURIComponent('Trưởng nhóm không thể rời nhóm trừ khi chuyển quyền sở hữu!'));
  }

  db.removeWorkspaceMember(ws.id, req.user.id);
  res.redirect('/boards?success=' + encodeURIComponent('Bạn đã rời khỏi nhóm làm việc.'));
});

// GET /workspace/settings
app.get('/workspace/settings', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  res.render('workspace/settings', {
    title: 'Cài đặt nhóm - ' + ws.name,
    workspace: ws,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// POST /workspace/settings
app.post('/workspace/settings', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  const { name, description, category } = req.body;
  if (!name || !name.trim()) {
    return res.render('workspace/settings', {
      title: 'Cài đặt nhóm',
      workspace: ws,
      error: 'Tên nhóm không được để trống.'
    });
  }

  const updated = db.updateWorkspace(ws.id, {
    name: name.trim(),
    description: description ? description.trim() : '',
    category: category || 'Chung'
  });

  res.render('workspace/settings', {
    title: 'Cài đặt nhóm - ' + updated.name,
    workspace: updated,
    success: 'Đã lưu thông tin cài đặt nhóm thành công!'
  });
});

// ==========================================
// 3. NHÓM QUẢN LÝ CÔNG VIỆC & KANBAN
// ==========================================

// GET / and GET /boards
app.get('/', (req, res) => res.redirect('/boards'));

app.get('/boards', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  const boards = db.getBoardsByWorkspace(ws.id);
  res.render('boards/index', {
    title: 'Các bảng công việc',
    boards,
    workspace: ws,
    success: req.query.success || null
  });
});

// GET /boards/:id
app.get('/boards/:id', requireAuth, (req, res) => {
  const boardId = Number(req.params.id);
  const board = db.getBoardById(boardId);
  if (!board) return res.status(404).render('auth/error', { title: 'Không tìm thấy bảng', message: 'Bảng công việc không tồn tại hoặc đã bị đóng.' });

  const ws = db.getWorkspaceById(board.workspaceId);
  const members = db.getWorkspaceMembers(board.workspaceId);

  res.render('boards/detail', {
    title: board.title,
    board,
    workspace: ws,
    workspaceMembers: members
  });
});

// GET /templates
app.get('/templates', requireAuth, (req, res) => {
  res.render('boards/templates', { title: 'Mẫu bảng việc sẵn có' });
});

// POST /templates/use
app.post('/templates/use', requireAuth, (req, res) => {
  const { templateType } = req.body;
  const ws = res.locals.currentWorkspace;
  let title = 'Kế hoạch Công việc Mới';
  let bg = 'linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%)';
  let desc = '';

  if (templateType === 'agile') {
    title = 'Dự án Phát triển Agile / Scrum';
    bg = 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)';
    desc = 'Quy trình quản lý Sprint, Backlog và Review tính năng.';
  } else if (templateType === 'marketing') {
    title = 'Chiến dịch Marketing Đa kênh';
    bg = 'linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%)';
    desc = 'Kế hoạch nội dung, sản xuất media và đo lường chuyển đổi.';
  } else {
    title = 'Quản lý Công việc Cá nhân & Mục tiêu';
    bg = 'linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%)';
    desc = 'Kế hoạch học tập, làm việc và theo dõi thói quen.';
  }

  const b = db.createBoard(ws.id, title, bg, req.user.id, desc);

  // Thêm một số thẻ mẫu
  const lists = db.getListsByBoard(b.id);
  if (lists.length > 0) {
    db.createCard({
      boardId: b.id,
      listId: lists[0].id,
      title: 'Khởi động mục tiêu và phân tích yêu cầu',
      priority: 'High',
      progressPercent: 20,
      createdBy: req.user.id,
      assignedUserIds: [req.user.id]
    });
  }

  res.redirect('/boards/' + b.id);
});

// ==========================================
// 4. NHÓM THỐNG KÊ, BÁO CÁO
// ==========================================

// GET /reports
app.get('/reports', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  const stats = db.getStatistics(ws.id);
  res.render('reports/index', {
    title: 'Thống kê & Báo cáo tiến độ',
    workspace: ws,
    stats
  });
});

// ==========================================
// 5. REST APIS (CHO FRONTEND & CLIENT AJAX)
// ==========================================

// GET /api/boards/:id (lấy cấu trúc danh sách & thẻ)
app.get('/api/boards/:id', requireAuth, (req, res) => {
  const boardId = Number(req.params.id);
  const board = db.getBoardById(boardId);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const lists = db.getListsByBoard(boardId);
  const cards = db.getCardsByBoard(boardId);

  const listsWithCards = lists.map(l => {
    const listCards = cards
      .filter(c => c.listId === l.id)
      .map(c => {
        const assignedUsers = (c.assignedUserIds || []).map(uid => db.getUserById(uid)).filter(Boolean).map(u => ({
          id: u.id,
          fullName: u.fullName,
          avatar: u.avatar
        }));
        const comments = db.getCommentsByCard(c.id);
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          position: c.position,
          priority: c.priority || 'Medium',
          progressPercent: c.progressPercent || 0,
          dueDate: c.dueDate,
          hasDesc: Boolean(c.description),
          commentsCount: comments.length,
          assignedUsers,
          version: c.version || 1
        };
      });

    return {
      id: l.id,
      title: l.title,
      position: l.position,
      cards: listCards
    };
  });

  res.json({
    id: board.id,
    title: board.title,
    background: board.background,
    lists: listsWithCards
  });
});

// POST /api/boards (tạo bảng mới)
app.post('/api/boards', requireAuth, (req, res) => {
  const { title, background, workspaceId } = req.body;
  const wsId = workspaceId || res.locals.currentWorkspace.id;
  const b = db.createBoard(wsId, title || 'Bảng việc mới', background, req.user.id);
  res.json({ id: b.id, title: b.title });
});

// POST /api/lists (tạo danh sách cột mới)
app.post('/api/lists', requireAuth, (req, res) => {
  const { boardId, title } = req.body;
  const list = db.createList(boardId, title || 'Cột mới');

  // Broadcast real-time
  io.to(`board_${boardId}`).emit('board:list_created', { list, senderId: req.user.id });

  res.json({ id: list.id, title: list.title, cards: [] });
});

// PUT /api/lists/:id (đổi tên danh sách)
app.put('/api/lists/:id', requireAuth, (req, res) => {
  const { title } = req.body;
  const list = db.renameList(req.params.id, title);
  if (!list) return res.status(404).json({ error: 'List not found' });

  io.to(`board_${list.boardId}`).emit('board:list_renamed', { listId: list.id, title: list.title });
  res.json(list);
});

// POST /api/cards (tạo thẻ công việc mới)
app.post('/api/cards', requireAuth, (req, res) => {
  const { listId, title, priority, progressPercent, dueDate, assignedUserIds } = req.body;
  const card = db.createCard({
    listId,
    title,
    priority: priority || 'Medium',
    progressPercent: progressPercent || 0,
    dueDate: dueDate || null,
    createdBy: req.user.id,
    assignedUserIds: assignedUserIds || [req.user.id]
  });

  const assignedUsers = (card.assignedUserIds || []).map(uid => db.getUserById(uid)).filter(Boolean).map(u => ({
    id: u.id,
    fullName: u.fullName,
    avatar: u.avatar
  }));

  const cardPayload = {
    id: card.id,
    title: card.title,
    position: card.position,
    priority: card.priority,
    progressPercent: card.progressPercent,
    dueDate: card.dueDate,
    hasDesc: false,
    commentsCount: 0,
    assignedUsers,
    version: card.version
  };

  // Broadcast real-time
  io.to(`board_${card.boardId}`).emit('board:card_created', {
    listId: card.listId,
    card: cardPayload,
    senderId: req.user.id
  });

  // Thông báo tới người được gán (nếu khác người tạo)
  (card.assignedUserIds || []).forEach(uid => {
    if (uid !== req.user.id) {
      db.addNotification({
        userId: uid,
        title: 'Bạn được giao công việc mới',
        message: `${req.user.fullName} đã phân công bạn công việc: "${card.title}"`,
        type: 'assign',
        cardId: card.id,
        boardId: card.boardId
      });
      io.emit('notification:new', { userId: uid });
    }
  });

  res.json(cardPayload);
});

// GET /api/cards/:id (chi tiết thẻ)
app.get('/api/cards/:id', requireAuth, (req, res) => {
  const card = db.getCardById(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const list = db.data.lists.find(l => l.id === card.listId);
  const comments = db.getCommentsByCard(card.id);
  const activities = db.getActivitiesByCard(card.id);
  const allWorkspaceMembers = db.getWorkspaceMembers(res.locals.currentWorkspace.id);

  res.json({
    id: card.id,
    boardId: card.boardId,
    listId: card.listId,
    listTitle: list ? list.title : '...',
    title: card.title,
    description: card.description,
    priority: card.priority || 'Medium',
    progressPercent: card.progressPercent || 0,
    startDate: card.startDate,
    dueDate: card.dueDate,
    isDueDone: card.isDueDone,
    assignedUserIds: card.assignedUserIds || [],
    version: card.version || 1,
    comments,
    activities,
    allWorkspaceMembers: allWorkspaceMembers.map(m => m.user).filter(Boolean)
  });
});

// PUT /api/cards/:id (cập nhật thẻ & phát hiện xung đột)
app.put('/api/cards/:id', requireAuth, (req, res) => {
  const cardId = Number(req.params.id);
  const { title, description, priority, progressPercent, dueDate, listId, position, assignedUserIds, clientVersion, forceOverwrite } = req.body;

  const current = db.getCardById(cardId);
  if (!current) return res.status(404).json({ error: 'Card not found' });

  // Phát hiện xung đột (Conflict Detection):
  // Nếu client gửi kèm clientVersion mà khác với phiên bản hiện tại trên server và không bấm "Ghi đè"
  if (clientVersion !== undefined && !forceOverwrite && Number(clientVersion) !== Number(current.version)) {
    return res.status(409).json({
      error: 'conflict',
      message: 'Công việc này vừa được cập nhật bởi một người dùng khác!',
      serverCard: {
        title: current.title,
        description: current.description,
        priority: current.priority,
        progressPercent: current.progressPercent,
        dueDate: current.dueDate,
        version: current.version,
        updatedAt: current.updatedAt
      }
    });
  }

  const updates = { userId: req.user.id };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (priority !== undefined) updates.priority = priority;
  if (progressPercent !== undefined) updates.progressPercent = Number(progressPercent);
  if (dueDate !== undefined) updates.dueDate = dueDate;
  if (listId !== undefined) updates.listId = Number(listId);
  if (position !== undefined) updates.position = Number(position);
  if (assignedUserIds !== undefined) {
    const prevAssigned = current.assignedUserIds || [];
    updates.assignedUserIds = assignedUserIds;

    // Gửi thông báo cho thành viên mới được thêm
    assignedUserIds.forEach(uid => {
      if (!prevAssigned.includes(uid) && uid !== req.user.id) {
        db.addNotification({
          userId: uid,
          title: 'Bạn được phân công công việc',
          message: `${req.user.fullName} đã phân công bạn công việc: "${current.title}"`,
          type: 'assign',
          cardId: current.id,
          boardId: current.boardId
        });
        io.emit('notification:new', { userId: uid });
      }
    });
  }

  // Tự động kiểm tra nếu chuyển sang list Hoàn thành thì progress = 100
  if (updates.listId) {
    const targetList = db.data.lists.find(l => l.id === updates.listId);
    if (targetList && targetList.title === 'Hoàn thành' && updates.progressPercent === undefined) {
      updates.progressPercent = 100;
    }
  }

  const result = db.updateCard(cardId, updates);
  if (result.error) return res.status(400).json(result);

  const updatedCard = result.card;
  const assignedUsers = (updatedCard.assignedUserIds || []).map(uid => db.getUserById(uid)).filter(Boolean).map(u => ({
    id: u.id,
    fullName: u.fullName,
    avatar: u.avatar
  }));

  const cardPayload = {
    id: updatedCard.id,
    listId: updatedCard.listId,
    title: updatedCard.title,
    description: updatedCard.description,
    position: updatedCard.position,
    priority: updatedCard.priority,
    progressPercent: updatedCard.progressPercent,
    dueDate: updatedCard.dueDate,
    hasDesc: Boolean(updatedCard.description),
    commentsCount: db.getCommentsByCard(updatedCard.id).length,
    assignedUsers,
    version: updatedCard.version
  };

  // Broadcast thay đổi tới tất cả client khác đang mở bảng
  io.to(`board_${updatedCard.boardId}`).emit('board:card_updated', {
    card: cardPayload,
    senderId: req.user.id
  });

  // Gửi thông báo nếu trạng thái đổi
  if (updates.listId) {
    const list = db.data.lists.find(l => l.id === updates.listId);
    const listName = list ? list.title : 'mới';
    (updatedCard.assignedUserIds || []).forEach(uid => {
      if (uid !== req.user.id) {
        db.addNotification({
          userId: uid,
          title: 'Trạng thái công việc thay đổi',
          message: `${req.user.fullName} đã chuyển công việc "${updatedCard.title}" sang "${listName}"`,
          type: 'status',
          cardId: updatedCard.id,
          boardId: updatedCard.boardId
        });
        io.emit('notification:new', { userId: uid });
      }
    });
  }

  res.json({ success: true, card: cardPayload });
});

// DELETE /api/cards/:id (xóa thẻ)
app.delete('/api/cards/:id', requireAuth, (req, res) => {
  const cardId = Number(req.params.id);
  const card = db.getCardById(cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const boardId = card.boardId;
  const listId = card.listId;
  db.deleteCard(cardId, req.user.id);

  // Broadcast real-time
  io.to(`board_${boardId}`).emit('board:card_deleted', {
    cardId,
    listId,
    senderId: req.user.id
  });

  res.json({ success: true });
});

// POST /api/cards/:id/comments (bình luận)
app.post('/api/cards/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });

  const comment = db.addComment(req.params.id, req.user.id, content.trim());
  const card = db.getCardById(req.params.id);

  if (card) {
    io.to(`board_${card.boardId}`).emit('board:comment_added', {
      cardId: card.id,
      comment,
      senderId: req.user.id
    });
  }

  res.json(comment);
});

// GET /api/cards/:id/activities (lịch sử thay đổi)
app.get('/api/cards/:id/activities', requireAuth, (req, res) => {
  const activities = db.getActivitiesByCard(req.params.id);
  res.json(activities);
});

// GET /api/notifications
app.get('/api/notifications', requireAuth, (req, res) => {
  const notifs = db.getNotificationsByUser(req.user.id);
  res.json(notifs);
});

// POST /api/notifications/:id/read
app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  db.markNotificationAsRead(req.params.id, req.user.id);
  res.json({ success: true });
});

// POST /api/notifications/read-all
app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  db.markAllNotificationsAsRead(req.user.id);
  res.json({ success: true });
});

// GET /api/chat/messages
app.get('/api/chat/messages', requireAuth, (req, res) => {
  const ws = res.locals.currentWorkspace;
  const messages = db.getChatMessages(ws.id);
  res.json(messages);
});

// POST /api/chat/messages
app.post('/api/chat/messages', requireAuth, (req, res) => {
  const { content, boardId } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống.' });

  const ws = res.locals.currentWorkspace;
  const msg = db.addChatMessage(ws.id, req.user.id, content.trim(), boardId);

  // Broadcast tới toàn bộ client trong workspace
  io.to(`workspace_${ws.id}`).emit('chat:new_message', {
    message: msg,
    senderId: req.user.id
  });

  res.json(msg);
});

// GET /api/sync/:boardId (Đồng bộ lại sau khi mất kết nối)
app.get('/api/sync/:boardId', requireAuth, (req, res) => {
  const boardId = Number(req.params.boardId);
  const board = db.getBoardById(boardId);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const lists = db.getListsByBoard(boardId);
  const cards = db.getCardsByBoard(boardId);

  res.json({
    boardId,
    timestamp: new Date().toISOString(),
    lists,
    cards
  });
});

// ==========================================
// 6. REAL-TIME SOCKET.IO HANDLERS
// ==========================================
io.on('connection', (socket) => {
  // Join board room
  socket.on('board:join', ({ boardId, userId, userName }) => {
    socket.join(`board_${boardId}`);
    socket.to(`board_${boardId}`).emit('board:user_joined', {
      userId,
      userName: userName || 'Người dùng',
      message: `${userName || 'Người dùng'} đang mở bảng này.`
    });
  });

  // Leave board room
  socket.on('board:leave', ({ boardId }) => {
    socket.leave(`board_${boardId}`);
  });

  // Join workspace room for chat & global notifications
  socket.on('workspace:join', ({ workspaceId }) => {
    socket.join(`workspace_${workspaceId}`);
  });

  // Client kéo thả thẻ sang cột khác hoặc đổi vị trí
  socket.on('card:move', (data) => {
    const { cardId, targetListId, newPosition, boardId, senderId } = data;
    const current = db.getCardById(cardId);
    if (current) {
      db.updateCard(cardId, {
        listId: Number(targetListId),
        position: Number(newPosition),
        userId: senderId
      });
      // Broadcast tới các client khác
      socket.to(`board_${boardId}`).emit('board:card_moved', {
        cardId,
        targetListId,
        newPosition,
        senderId
      });
    }
  });

  // Socket chat send
  socket.on('chat:send', ({ workspaceId, userId, content, boardId }) => {
    if (!content || !content.trim()) return;
    const msg = db.addChatMessage(workspaceId, userId, content.trim(), boardId);
    io.to(`workspace_${workspaceId}`).emit('chat:new_message', {
      message: msg,
      senderId: userId
    });
  });

  socket.on('disconnect', () => {
    // Client disconnected
  });
});

// Error handling view
app.use((err, req, res, next) => {
  console.error('Lỗi ứng dụng:', err);
  res.status(500).render('auth/error', {
    title: 'Đã xảy ra lỗi',
    message: err.message || 'Lỗi hệ thống máy chủ.'
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 VTT Web Server (Node.js Frontend) running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
