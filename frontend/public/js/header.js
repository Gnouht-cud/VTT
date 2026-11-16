/**
 * VTT Header & Notification Dropdown Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Profile Dropdown
  const avatarBtn = document.querySelector('.user-avatar-btn');
  const profileDropdown = document.querySelector('.profile-dropdown-wrapper .dropdown-menu');

  if (avatarBtn && profileDropdown) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('show');
      if (bellDropdown) bellDropdown.classList.remove('show');
    });
  }

  // 2. Bell Notification Dropdown
  const bellBtn = document.getElementById('header-bell-btn');
  const bellDropdown = document.getElementById('header-bell-dropdown');
  const notifList = document.getElementById('header-notifications-list');
  const notifDot = document.getElementById('header-notif-dot');
  const btnMarkAll = document.getElementById('btn-mark-all-read');

  const renderNotification = (n) => `
    <div class="dropdown-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}" style="font-size: 12.5px; padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-light); ${n.isRead ? '' : 'background: var(--primary-subtle);'}">
      <div style="font-weight: 700; color: var(--text-main); margin-bottom: 2px;">${n.title}</div>
      <div style="color: var(--text-muted); line-height: 1.35;">${n.message}</div>
      <div style="font-size: 10.5px; color: var(--text-subtle); margin-top: 4px;">
        ${new Date(n.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
      </div>
    </div>
  `;

  const loadNotifications = async () => {
    if (!notifList) return;
    try {
      const res = await fetch('/api/notifications');
      const list = await res.json();
      if (list && list.length > 0) {
        notifList.innerHTML = list.map(renderNotification).join('');
      } else {
        notifList.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-subtle); font-size:12.5px;">Không có thông báo mới.</div>';
      }
    } catch (e) {
      notifList.innerHTML = '<div style="text-align:center; padding:12px; color:var(--danger); font-size:12px;">Lỗi tải thông báo.</div>';
    }
  };

  if (bellBtn && bellDropdown) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bellDropdown.classList.toggle('show');
      if (profileDropdown) profileDropdown.classList.remove('show');
      if (bellDropdown.classList.contains('show')) {
        loadNotifications();
      }
    });

    if (notifList) {
      notifList.addEventListener('click', async (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        const id = item.getAttribute('data-id');
        if (id) {
          try {
            await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
            item.style.background = 'transparent';
          } catch (err) {}
        }
      });
    }

    if (btnMarkAll) {
      btnMarkAll.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await fetch('/api/notifications/read-all', { method: 'POST' });
          if (notifDot) notifDot.style.display = 'none';
          document.querySelectorAll('#header-notifications-list .dropdown-item').forEach(el => {
            el.style.background = 'transparent';
          });
          Toast.success('Đã đánh dấu tất cả thông báo là đã đọc.');
        } catch (err) {}
      });
    }
  }

  // Click outside to close dropdowns
  document.addEventListener('click', () => {
    if (profileDropdown) profileDropdown.classList.remove('show');
    if (bellDropdown) bellDropdown.classList.remove('show');
  });

  // Sidebar toggle button
  const toggleBtn = document.querySelector('.sidebar-toggle-btn');
  const sidebar = document.querySelector('.app-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      sidebar.classList.toggle('show-mobile');
    });
  }
});
