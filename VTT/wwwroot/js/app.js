/**
 * VTT Global Application Controller - Sidebar, Dropdowns, Create Board Modal, Search
 */
document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // 1. Sidebar Toggle & Persistence
  // --------------------------------------------------------------------------
  const sidebar = document.querySelector('.app-sidebar');
  const toggleBtn = document.querySelector('.sidebar-toggle-btn');

  if (sidebar && toggleBtn) {
    const isCollapsed = localStorage.getItem('vtt_sidebar_collapsed') === 'true';
    if (isCollapsed) sidebar.classList.add('collapsed');

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const collapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('vtt_sidebar_collapsed', String(collapsed));
    });
  }

  // --------------------------------------------------------------------------
  // 2. Profile Dropdown Menu
  // --------------------------------------------------------------------------
  const profileTrigger = document.querySelector('.user-avatar-btn');
  const profileDropdown = document.querySelector('.profile-dropdown-wrapper .dropdown-menu');

  if (profileTrigger && profileDropdown) {
    profileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.profile-dropdown-wrapper')) {
        profileDropdown.classList.remove('show');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 3. Notification Bell Popover
  // --------------------------------------------------------------------------
  const bellBtn = document.querySelector('#header-bell-btn');
  const bellPopover = document.querySelector('#header-bell-dropdown');

  if (bellBtn && bellPopover) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bellPopover.classList.toggle('show');
      // Tắt chấm đỏ sau khi mở
      const dot = bellBtn.querySelector('.badge-dot');
      if (dot) dot.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#header-bell-btn') && !e.target.closest('#header-bell-dropdown')) {
        bellPopover.classList.remove('show');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 4. Modal "Tạo Bảng Mới"
  // --------------------------------------------------------------------------
  const createBoardBtns = document.querySelectorAll('[data-open-create-board]');
  createBoardBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      Modal.open('create-board-modal');
    });
  });

  const swatches = document.querySelectorAll('.palette-swatch');
  const bgInput = document.getElementById('new-board-bg-val');

  swatches.forEach(s => {
    s.addEventListener('click', () => {
      swatches.forEach(item => item.classList.remove('active'));
      s.classList.add('active');
      if (bgInput) bgInput.value = s.dataset.bg;
    });
  });

  const createBoardForm = document.getElementById('create-board-form');
  if (createBoardForm) {
    createBoardForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('new-board-title');
      const title = titleInput.value.trim();
      const bg = bgInput ? bgInput.value : 'linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%)';

      if (!title) {
        Toast.warning('Vui lòng nhập tiêu đề bảng.');
        titleInput.focus();
        return;
      }

      const submitBtn = createBoardForm.querySelector('button[type="submit"]');
      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner spinner-white"></span> Đang tạo...';
        const res = await Api.createBoard(title, bg);
        Toast.success('Tạo bảng thành công! Đang chuyển hướng...');
        setTimeout(() => {
          window.location.href = `/Boards/Details/${res.id}`;
        }, 400);
      } catch (err) {
        Toast.error('Không thể tạo bảng mới. Vui lòng thử lại.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Tạo bảng';
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. Tìm kiếm bảng trên Dashboard
  // --------------------------------------------------------------------------
  const globalSearchInput = document.getElementById('global-search-input');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const boardCards = document.querySelectorAll('.board-card:not(.board-card-new)');
      let matchedCount = 0;

      boardCards.forEach(card => {
        const title = (card.querySelector('.board-card-title')?.textContent || '').toLowerCase();
        if (!q || title.includes(q)) {
          card.style.display = '';
          matchedCount++;
        } else {
          card.style.display = 'none';
        }
      });

      const emptySearch = document.getElementById('dashboard-search-empty');
      if (emptySearch) {
        emptySearch.style.display = (q && matchedCount === 0) ? 'block' : 'none';
      }
    });
  }

  // --------------------------------------------------------------------------
  // 6. Gắn sao nhanh trên Board Tiles ở Dashboard
  // --------------------------------------------------------------------------
  const tileStarBtns = document.querySelectorAll('.board-star-btn');
  tileStarBtns.forEach(btn => {
    const boardId = btn.dataset.boardId;
    if (localStorage.getItem(`vtt_board_starred_${boardId}`) === 'true') {
      btn.textContent = '★';
      btn.classList.add('starred');
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = btn.textContent === '★';
      const next = !current;
      btn.textContent = next ? '★' : '☆';
      btn.classList.toggle('starred', next);
      localStorage.setItem(`vtt_board_starred_${boardId}`, String(next));
      Toast.info(next ? 'Đã gắn sao bảng!' : 'Đã bỏ gắn sao');

      // Cập nhật section Starred nếu có
      updateStarredSection();
    });
  });

  const updateStarredSection = () => {
    const starredSection = document.getElementById('starred-boards-section');
    const starredGrid = document.getElementById('starred-boards-grid');
    if (!starredSection || !starredGrid) return;

    const allCards = document.querySelectorAll('#all-boards-grid .board-card:not(.board-card-new)');
    starredGrid.innerHTML = '';
    let hasStarred = false;

    allCards.forEach(c => {
      const bId = c.dataset.boardId;
      if (localStorage.getItem(`vtt_board_starred_${bId}`) === 'true') {
        hasStarred = true;
        const clone = c.cloneNode(true);
        // Gán lại sự kiện star
        const starBtn = clone.querySelector('.board-star-btn');
        if (starBtn) {
          starBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            localStorage.setItem(`vtt_board_starred_${bId}`, 'false');
            // Cập nhật cả nút gốc
            const originalBtn = document.querySelector(`#all-boards-grid .board-star-btn[data-board-id="${bId}"]`);
            if (originalBtn) {
              originalBtn.textContent = '☆';
              originalBtn.classList.remove('starred');
            }
            updateStarredSection();
            Toast.info('Đã bỏ gắn sao');
          });
        }
        starredGrid.appendChild(clone);
      }
    });

    starredSection.style.display = hasStarred ? 'block' : 'none';
  };

  updateStarredSection();

  // Khởi tạo Board nếu đang ở trang chi tiết
  if (typeof BoardApp !== 'undefined') {
    BoardApp.init();
  }
});
