/**
 * VTT Real-Time Socket.IO Client & Sync Manager
 */
const SocketClient = (() => {
  let socket = null;
  let currentBoardId = null;
  let currentWorkspaceId = 1;

  const init = () => {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO library not loaded.');
      return;
    }

    socket = io();

    const boardViewEl = document.querySelector('.board-view');
    if (boardViewEl) {
      currentBoardId = Number(boardViewEl.getAttribute('data-board-id'));
    }

    const statusBar = document.getElementById('vtt-sync-status-bar');
    const statusText = document.getElementById('sync-status-text');

    const updateStatus = (status, text) => {
      if (!statusBar || !statusText) return;
      statusBar.className = `sync-status-bar status-${status}`;
      statusText.textContent = text;
    };

    // 1. Khi kết nối thành công
    socket.on('connect', () => {
      updateStatus('online', 'Đã kết nối (Thời gian thực)');
      
      // Join workspace room
      socket.emit('workspace:join', { workspaceId: currentWorkspaceId });

      // Join board room if on a board page
      if (currentBoardId) {
        socket.emit('board:join', { boardId: currentBoardId });
      }
    });

    // 2. Mất kết nối
    socket.on('disconnect', () => {
      updateStatus('reconnecting', 'Mất kết nối - Đang thử lại...');
    });

    // 3. Kết nối lại (Reconnection & State Re-sync)
    socket.io.on('reconnect', () => {
      updateStatus('online', 'Đã kết nối lại (Thời gian thực)');
      Toast.success('Đã khôi phục kết nối! Đang đồng bộ lại dữ liệu...');

      // Tự động gọi đồng bộ lại
      if (currentBoardId && typeof BoardApp !== 'undefined' && BoardApp.refreshBoard) {
        BoardApp.refreshBoard();
      }
    });

    // 4. Lắng nghe cập nhật bảng từ các client khác
    socket.on('board:card_moved', (data) => {
      if (typeof BoardApp !== 'undefined' && BoardApp.handleRemoteCardMoved) {
        BoardApp.handleRemoteCardMoved(data);
      }
    });

    socket.on('board:card_created', (data) => {
      if (typeof BoardApp !== 'undefined' && BoardApp.handleRemoteCardCreated) {
        BoardApp.handleRemoteCardCreated(data);
      }
    });

    socket.on('board:card_updated', (data) => {
      if (typeof BoardApp !== 'undefined' && BoardApp.handleRemoteCardUpdated) {
        BoardApp.handleRemoteCardUpdated(data);
      }
    });

    socket.on('board:card_deleted', (data) => {
      if (typeof BoardApp !== 'undefined' && BoardApp.handleRemoteCardDeleted) {
        BoardApp.handleRemoteCardDeleted(data);
      }
    });

    socket.on('board:list_created', (data) => {
      if (typeof BoardApp !== 'undefined' && BoardApp.handleRemoteListCreated) {
        BoardApp.handleRemoteListCreated(data);
      }
    });

    socket.on('board:comment_added', (data) => {
      if (typeof CardDetail !== 'undefined' && CardDetail.handleRemoteComment) {
        CardDetail.handleRemoteComment(data);
      }
    });

    // 5. Thông báo mới
    socket.on('notification:new', (data) => {
      Toast.info('Bạn có thông báo mới từ hệ thống!');
      const dot = document.getElementById('header-notif-dot');
      if (dot) dot.style.display = 'block';
    });

    // 6. Tài khoản bị khóa từ Admin
    socket.on('user:lock_status_changed', (data) => {
      if (data.isLocked) {
        alert(data.message || 'Tài khoản của bạn đã bị quản trị viên khóa.');
        window.location.href = '/login';
      }
    });

    // Nút đồng bộ thủ công
    const btnManualSync = document.getElementById('btn-manual-sync');
    if (btnManualSync) {
      btnManualSync.addEventListener('click', () => {
        if (currentBoardId && typeof BoardApp !== 'undefined' && BoardApp.refreshBoard) {
          BoardApp.refreshBoard();
          Toast.success('Đã đồng bộ lại dữ liệu mới nhất từ máy chủ.');
        } else {
          window.location.reload();
        }
      });
    }
  };

  // Trigger hiển thị Modal cảnh báo xung đột (Conflict Resolution)
  const showConflictDialog = (conflictData, onReload, onOverwrite) => {
    const modal = document.getElementById('conflict-modal');
    if (!modal) return;

    const sTitle = modal.querySelector('#conflict-server-title');
    const sPrio = modal.querySelector('#conflict-server-priority');
    const sProg = modal.querySelector('#conflict-server-progress');

    if (conflictData && conflictData.serverCard) {
      const sc = conflictData.serverCard;
      if (sTitle) sTitle.textContent = sc.title || '...';
      if (sPrio) {
        sPrio.textContent = sc.priority || 'Medium';
        sPrio.className = `badge badge-${(sc.priority || 'Medium').toLowerCase()}`;
      }
      if (sProg) sProg.textContent = sc.progressPercent ?? 0;
    }

    const btnReload = modal.querySelector('#btn-conflict-reload');
    const btnOverwrite = modal.querySelector('#btn-conflict-overwrite');

    const handleReload = () => {
      Modal.close('conflict-modal');
      btnReload.removeEventListener('click', handleReload);
      btnOverwrite.removeEventListener('click', handleOverwrite);
      if (onReload) onReload();
    };

    const handleOverwrite = () => {
      Modal.close('conflict-modal');
      btnReload.removeEventListener('click', handleReload);
      btnOverwrite.removeEventListener('click', handleOverwrite);
      if (onOverwrite) onOverwrite();
    };

    btnReload.addEventListener('click', handleReload);
    btnOverwrite.addEventListener('click', handleOverwrite);

    Modal.open('conflict-modal');
  };

  return {
    init,
    getSocket: () => socket,
    showConflictDialog,
    emitCardMove: (data) => {
      if (socket) socket.emit('card:move', { ...data, boardId: currentBoardId });
    }
  };
})();

document.addEventListener('DOMContentLoaded', SocketClient.init);
