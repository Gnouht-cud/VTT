/**
 * VTT Real-Time Team Chat Controller
 */
const TeamChat = (() => {
  let isChatOpen = false;
  let unreadCount = 0;
  const drawerId = 'vtt-chat-drawer';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const renderMessage = (m, currentUserId) => {
    const isMine = currentUserId && Number(m.userId) === Number(currentUserId);
    const timeStr = new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="chat-msg-row ${isMine ? 'mine' : ''}">
        ${!isMine ? `
          <div class="avatar avatar-xs" style="background: linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%);">
            ${esc(m.avatar || (m.userName || 'U')[0].toUpperCase())}
          </div>
        ` : ''}
        <div>
          ${!isMine ? `<div class="chat-msg-meta">${esc(m.userName)} • ${esc(timeStr)}</div>` : `<div class="chat-msg-meta">${esc(timeStr)}</div>`}
          <div class="chat-msg-bubble">${esc(m.content)}</div>
        </div>
      </div>
    `;
  };

  const scrollToBottom = () => {
    const container = document.getElementById('chat-messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  const loadMessages = async () => {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    try {
      const messages = await Api.getChatMessages();
      const currentUserId = window.VTT_CURRENT_USER_ID || null;

      if (messages && messages.length > 0) {
        container.innerHTML = messages.map(m => renderMessage(m, currentUserId)).join('');
      } else {
        container.innerHTML = '<div style="text-align:center; padding:24px 10px; color:var(--text-subtle); font-size:13px; font-style:italic;">Chưa có tin nhắn nào. Hãy gửi lời chào đến cả nhóm!</div>';
      }
      scrollToBottom();
    } catch (err) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger); font-size:12.5px;">Không thể tải tin nhắn chat.</div>';
    }
  };

  const openChat = () => {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;
    drawer.classList.add('open');
    isChatOpen = true;

    // Reset unread badge
    unreadCount = 0;
    const badge = document.getElementById('chat-unread-badge');
    if (badge) badge.style.display = 'none';

    loadMessages();
    setTimeout(() => {
      const input = document.getElementById('chat-input');
      if (input) input.focus();
    }, 200);
  };

  const closeChat = () => {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;
    drawer.classList.remove('open');
    isChatOpen = false;
  };

  const initEvents = () => {
    const btnOpen = document.getElementById('btn-open-chat');
    const btnSidebarOpen = document.getElementById('btn-sidebar-open-chat');
    const btnClose = document.getElementById('btn-close-chat');
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        if (isChatOpen) closeChat();
        else openChat();
      });
    }

    if (btnSidebarOpen) {
      btnSidebarOpen.addEventListener('click', openChat);
    }

    if (btnClose) {
      btnClose.addEventListener('click', closeChat);
    }

    if (form && input) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = input.value.trim();
        if (!content) return;

        try {
          input.value = '';
          const msg = await Api.sendChatMessage(content);
          const container = document.getElementById('chat-messages-container');
          const emptyNotice = container.querySelector('div[style*="font-style:italic"]');
          if (emptyNotice) emptyNotice.remove();

          container.insertAdjacentHTML('beforeend', renderMessage(msg, msg.userId));
          scrollToBottom();
        } catch (err) {
          Toast.error('Không thể gửi tin nhắn.');
        }
      });
    }

    // Socket realtime incoming chat message
    const socket = (typeof SocketClient !== 'undefined') ? SocketClient.getSocket() : null;
    const setupSocketListener = (s) => {
      s.on('chat:new_message', (data) => {
        const msg = data.message;
        const currentUserId = window.VTT_CURRENT_USER_ID || null;
        if (currentUserId && Number(data.senderId) === Number(currentUserId)) {
          return; // Already added locally
        }

        const container = document.getElementById('chat-messages-container');
        if (container) {
          const emptyNotice = container.querySelector('div[style*="font-style:italic"]');
          if (emptyNotice) emptyNotice.remove();

          container.insertAdjacentHTML('beforeend', renderMessage(msg, currentUserId));
          if (isChatOpen) {
            scrollToBottom();
          } else {
            unreadCount++;
            const badge = document.getElementById('chat-unread-badge');
            if (badge) {
              badge.textContent = unreadCount;
              badge.style.display = 'inline-block';
            }
            Toast.info(`Tin nhắn mới từ ${msg.userName}: "${msg.content.slice(0, 30)}..."`);
          }
        }
      });
    };

    if (socket) {
      setupSocketListener(socket);
    } else {
      setTimeout(() => {
        const s = (typeof SocketClient !== 'undefined') ? SocketClient.getSocket() : null;
        if (s) setupSocketListener(s);
      }, 500);
    }
  };

  return {
    init: initEvents,
    open: openChat,
    close: closeChat
  };
})();

document.addEventListener('DOMContentLoaded', TeamChat.init);
