/**
 * VTT Kanban Board Controller - Lists, Cards, Drag & Drop, Filtering
 */
const BoardApp = (() => {
  let boardId = null;
  let canvas = null;
  let draggingCard = null;
  let placeholder = null;
  let canManage = false;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const trashIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

  const renderCard = (c) => {
    const badges = [];
    const duePill = DueUtil.pillHtml(c.dueDate, c.isDueDone);
    if (duePill) badges.push(duePill);
    if (c.hasDesc) {
      badges.push('<span class="badge-has-desc" title="Có mô tả chi tiết">≡</span>');
    }
    if (c.comments) {
      badges.push(`<span class="badge-comments-count" data-count="${c.comments}">💬 ${c.comments}</span>`);
    }

    return `
      <div class="card-item" draggable="true" data-id="${c.id}" data-pos="${c.position ?? 0}">
        <div class="card-title-text">${esc(c.title)}</div>
        <div class="card-badges-row">${badges.join('')}</div>
      </div>
    `;
  };

  const renderList = (l) => `
    <div class="kanban-list" data-id="${l.id}">
      <div class="list-header">
        <input class="list-title-input" value="${esc(l.title)}" data-title="${esc(l.title)}" maxlength="100" aria-label="Tên danh sách">
        <span class="list-badge-count">${(l.cards || []).length}</span>
        ${canManage ? `<button type="button" class="list-delete-btn" title="Xóa danh sách" aria-label="Xóa danh sách">${trashIcon}</button>` : ''}
      </div>
      <div class="list-cards-container">
        ${(l.cards || []).map(renderCard).join('')}
      </div>
      <div class="list-footer">
        <div class="card-composer-box" hidden>
          <textarea placeholder="Nhập tiêu đề cho thẻ này..."></textarea>
          <div class="composer-actions">
            <button type="button" class="btn btn-primary btn-sm btn-submit-card">Thêm thẻ</button>
            <button type="button" class="btn btn-ghost btn-sm btn-cancel-card">✕</button>
          </div>
        </div>
        <button type="button" class="btn-open-composer">+ Thêm thẻ</button>
      </div>
    </div>
  `;

  const addListHtml = `
    <div class="add-list-wrapper">
      <button type="button" class="btn-open-add-list">
        <span style="font-size:16px;">+</span> Thêm danh sách khác
      </button>
      <form class="add-list-form" hidden>
        <input type="text" placeholder="Nhập tên danh sách..." maxlength="100" required>
        <div class="composer-actions">
          <button type="submit" class="btn btn-primary btn-sm">Thêm danh sách</button>
          <button type="button" class="btn btn-ghost btn-sm btn-cancel-list">✕</button>
        </div>
      </form>
    </div>
  `;

  const renderBoard = (data) => {
    canManage = !!data.canManage;
    canvas.innerHTML = (data.lists || []).map(renderList).join('') + addListHtml;
  };

  const reloadBoard = async () => {
    try {
      renderBoard(await Api.getBoard(boardId));
    } catch (err) {
      Toast.error(err.message || 'Không thể tải lại bảng.');
    }
  };

  const updateListCount = (listEl) => {
    if (!listEl) return;
    const countEl = listEl.querySelector('.list-badge-count');
    const cards = listEl.querySelectorAll('.card-item');
    if (countEl) countEl.textContent = cards.length;
  };

  const setupDragAndDrop = () => {
    placeholder = document.createElement('div');
    placeholder.className = 'card-drop-placeholder';

    canvas.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.card-item');
      if (!card) return;
      draggingCard = card;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.id);

      setTimeout(() => card.classList.add('card-dragging'), 0);
    });

    canvas.addEventListener('dragover', (e) => {
      if (!draggingCard) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const listCardsBox = e.target.closest('.list-cards-container');
      if (!listCardsBox) return;

      const afterCard = [...listCardsBox.querySelectorAll('.card-item:not(.card-dragging)')].find(c => {
        const box = c.getBoundingClientRect();
        return e.clientY < box.top + box.height / 2;
      });

      if (afterCard) {
        listCardsBox.insertBefore(placeholder, afterCard);
      } else {
        listCardsBox.appendChild(placeholder);
      }
    });

    canvas.addEventListener('dragend', async () => {
      if (!draggingCard) return;
      const card = draggingCard;
      draggingCard = null;
      card.classList.remove('card-dragging');

      if (placeholder.parentNode) {
        const targetContainer = placeholder.parentNode;
        const targetList = targetContainer.closest('.kanban-list');
        targetContainer.insertBefore(card, placeholder);
        placeholder.remove();

        // Tính vị trí mới
        const prev = card.previousElementSibling;
        const next = card.nextElementSibling;
        const prevPos = prev && prev.classList.contains('card-item') ? parseFloat(prev.dataset.pos) : null;
        const nextPos = next && next.classList.contains('card-item') ? parseFloat(next.dataset.pos) : null;

        let newPos = 1024;
        if (prevPos !== null && nextPos !== null) {
          newPos = (prevPos + nextPos) / 2;
        } else if (prevPos !== null) {
          newPos = prevPos + 1024;
        } else if (nextPos !== null) {
          newPos = nextPos / 2;
        }

        card.dataset.pos = newPos;
        const targetListId = parseInt(targetList.dataset.id, 10);
        const cardId = parseInt(card.dataset.id, 10);

        // Cập nhật số lượng đếm trên các danh sách
        document.querySelectorAll('.kanban-list').forEach(updateListCount);

        try {
          await Api.updateCard(cardId, { listId: targetListId, position: newPos });
        } catch (err) {
          Toast.error(err.message || 'Không thể lưu thứ tự thẻ.');
          await reloadBoard(); // đồng bộ lại với dữ liệu thật trên máy chủ
        }
      } else {
        placeholder.remove();
      }
    });
  };

  const setupEventListeners = () => {
    // Click events trên canvas
    canvas.addEventListener('click', (e) => {
      const target = e.target;
      const listEl = target.closest('.kanban-list');

      // Xóa danh sách
      if (target.closest('.list-delete-btn')) {
        deleteList(listEl);
      }

      // Mở Card Composer
      else if (target.closest('.btn-open-composer')) {
        const composer = listEl.querySelector('.card-composer-box');
        const openBtn = listEl.querySelector('.btn-open-composer');
        composer.hidden = false;
        openBtn.hidden = true;
        const textarea = composer.querySelector('textarea');
        textarea.focus();
      }

      // Đóng Card Composer
      else if (target.closest('.btn-cancel-card')) {
        const composer = listEl.querySelector('.card-composer-box');
        const openBtn = listEl.querySelector('.btn-open-composer');
        composer.hidden = true;
        openBtn.hidden = false;
      }

      // Thêm thẻ mới
      else if (target.closest('.btn-submit-card')) {
        submitNewCard(listEl);
      }

      // Mở Form thêm danh sách
      else if (target.closest('.btn-open-add-list')) {
        const wrapper = target.closest('.add-list-wrapper');
        target.closest('.btn-open-add-list').hidden = true;
        const form = wrapper.querySelector('.add-list-form');
        form.hidden = false;
        form.querySelector('input').focus();
      }

      // Đóng Form thêm danh sách
      else if (target.closest('.btn-cancel-list')) {
        const wrapper = target.closest('.add-list-wrapper');
        wrapper.querySelector('.add-list-form').hidden = true;
        wrapper.querySelector('.btn-open-add-list').hidden = false;
      }

      // Mở Modal chi tiết thẻ khi click vào card-item
      else if (target.closest('.card-item')) {
        const cardItem = target.closest('.card-item');
        CardDetail.open(parseInt(cardItem.dataset.id, 10));
      }
    });

    // Keydown events trên canvas
    canvas.addEventListener('keydown', (e) => {
      if (e.target.matches('.card-composer-box textarea')) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submitNewCard(e.target.closest('.kanban-list'));
        } else if (e.key === 'Escape') {
          const listEl = e.target.closest('.kanban-list');
          listEl.querySelector('.card-composer-box').hidden = true;
          listEl.querySelector('.btn-open-composer').hidden = false;
        }
      } else if (e.target.matches('.list-title-input') && e.key === 'Enter') {
        e.target.blur();
      }
    });

    // Đổi tên danh sách khi blur hoặc change
    canvas.addEventListener('change', async (e) => {
      if (e.target.matches('.list-title-input')) {
        const listEl = e.target.closest('.kanban-list');
        const listId = parseInt(listEl.dataset.id, 10);
        const title = e.target.value.trim();
        if (!title) {
          e.target.value = e.target.dataset.title || '';
          Toast.warning('Tên danh sách không được để trống.');
          return;
        }

        try {
          await Api.renameList(listId, title);
          e.target.dataset.title = title;
          Toast.success(`Đã đổi tên danh sách thành "${title}"`);
        } catch (err) {
          e.target.value = e.target.dataset.title || '';
          Toast.error(err.message || 'Không thể cập nhật tên danh sách.');
        }
      }
    });

    // Submit form thêm danh sách
    canvas.addEventListener('submit', async (e) => {
      if (e.target.matches('.add-list-form')) {
        e.preventDefault();
        const input = e.target.querySelector('input');
        const title = input.value.trim();
        if (!title) return;

        try {
          const submitBtn = e.target.querySelector('button[type="submit"]');
          submitBtn.disabled = true;
          const newList = await Api.createList(boardId, title);

          // Thêm cột danh sách mới vào trước addListWrapper
          const addListWrapper = canvas.querySelector('.add-list-wrapper');
          addListWrapper.insertAdjacentHTML('beforebegin', renderList(newList));

          input.value = '';
          input.focus();
          Toast.success(`Đã tạo danh sách "${title}"`);
        } catch (err) {
          Toast.error(err.message || 'Không thể tạo danh sách mới.');
        } finally {
          e.target.querySelector('button[type="submit"]').disabled = false;
        }
      }
    });

    // Bộ lọc thẻ theo từ khóa
    const searchInput = document.querySelector('.board-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        const allCards = canvas.querySelectorAll('.card-item');

        allCards.forEach(c => {
          const title = (c.querySelector('.card-title-text')?.textContent || '').toLowerCase();
          if (!query || title.includes(query)) {
            c.style.display = '';
          } else {
            c.style.display = 'none';
          }
        });
      });
    }

    // Nút đổi hình nền bảng (Palette)
    const btnChangeBg = document.getElementById('btn-change-board-bg');
    if (btnChangeBg) {
      btnChangeBg.addEventListener('click', () => {
        Modal.open('board-bg-modal');
      });
    }

    const bgOptions = document.querySelectorAll('.board-bg-option');
    bgOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const bgVal = opt.dataset.bg;
        const boardEl = document.querySelector('.board-view');
        if (boardEl && bgVal) {
          boardEl.style.background = bgVal;
          localStorage.setItem(`vtt_board_bg_${boardId}`, bgVal);
          Toast.success('Đã cập nhật giao diện bảng!');
          Modal.close('board-bg-modal');
        }
      });
    });

    // Nút đánh dấu sao cho bảng
    const starBtn = document.querySelector('.star-icon-btn');
    if (starBtn) {
      const isStarred = localStorage.getItem(`vtt_board_starred_${boardId}`) === 'true';
      if (isStarred) {
        starBtn.textContent = '★';
        starBtn.classList.add('starred');
      }

      starBtn.addEventListener('click', () => {
        const current = starBtn.textContent === '★';
        const next = !current;
        starBtn.textContent = next ? '★' : '☆';
        starBtn.classList.toggle('starred', next);
        localStorage.setItem(`vtt_board_starred_${boardId}`, String(next));
        Toast.info(next ? 'Đã thêm vào mục gắn sao' : 'Đã bỏ gắn sao');
      });
    }

    // Nút mở danh sách thẻ đã lưu trữ
    const btnOpenArchived = document.getElementById('btn-open-archived');
    const archivedListEl = document.getElementById('archived-cards-list');

    const loadArchivedCards = async () => {
      if (!archivedListEl) return;
      archivedListEl.innerHTML = '<div style="text-align:center; padding:20px;"><span class="spinner"></span></div>';

      try {
        const cards = await Api.getArchivedCards(boardId);
        if (!cards || cards.length === 0) {
          archivedListEl.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13.5px;">Không có thẻ nào trong mục lưu trữ.</div>';
          return;
        }

        archivedListEl.innerHTML = cards.map(c => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--bg-subtle); border:1px solid var(--border-light); border-radius:var(--radius-sm); margin-bottom:8px;">
            <div>
              <div style="font-weight:600; color:var(--text-main); font-size:13.5px;">${esc(c.title)}</div>
              <div style="font-size:11.5px; color:var(--text-muted);">trong danh sách <b>${esc(c.listTitle)}</b> • ${esc(c.updatedAt)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn btn-secondary btn-sm btn-restore-card" data-id="${c.id}">Khôi phục</button>
              ${c.canDelete ? `<button type="button" class="btn btn-danger btn-sm btn-purge-card" data-id="${c.id}" data-title="${esc(c.title)}">Xóa</button>` : ''}
            </div>
          </div>
        `).join('');

        archivedListEl.querySelectorAll('.btn-restore-card').forEach(btn => {
          btn.addEventListener('click', async () => {
            const cardId = parseInt(btn.dataset.id, 10);
            try {
              btn.disabled = true;
              await Api.updateCard(cardId, { archive: false });
              Toast.success('Đã khôi phục thẻ về lại bảng!');
              await loadArchivedCards();
              await reloadBoard();
            } catch (err) {
              Toast.error(err.message || 'Không thể khôi phục thẻ.');
              btn.disabled = false;
            }
          });
        });

        archivedListEl.querySelectorAll('.btn-purge-card').forEach(btn => {
          btn.addEventListener('click', () => {
            const cardId = parseInt(btn.dataset.id, 10);
            ConfirmDialog.show({
              title: 'Xóa thẻ vĩnh viễn?',
              message: `Thẻ "${btn.dataset.title}" sẽ bị xóa và không thể khôi phục.`,
              confirmText: 'Xóa thẻ',
              onConfirm: async () => {
                try {
                  await Api.deleteCard(cardId);
                  Toast.success('Đã xóa thẻ.');
                  await loadArchivedCards();
                } catch (err) {
                  Toast.error(err.message || 'Không thể xóa thẻ.');
                }
              }
            });
          });
        });
      } catch (err) {
        archivedListEl.innerHTML = `<div style="color:var(--danger); text-align:center; padding:16px;">${esc(err.message || 'Lỗi khi tải danh sách thẻ lưu trữ.')}</div>`;
      }
    };

    // Nút xóa bảng (chỉ hiển thị với quản trị viên)
    const btnDeleteBoard = document.getElementById('btn-delete-board');
    if (btnDeleteBoard) {
      btnDeleteBoard.addEventListener('click', () => {
        const boardTitle = document.querySelector('.board-title-h1')?.textContent?.trim() || 'này';
        ConfirmDialog.show({
          title: 'Xóa bảng vĩnh viễn?',
          message: `Bảng "${boardTitle}" cùng toàn bộ danh sách, thẻ và bình luận sẽ bị xóa và không thể khôi phục.`,
          confirmText: 'Xóa bảng',
          onConfirm: async () => {
            try {
              await Api.deleteBoard(boardId);
              Toast.success('Đã xóa bảng. Đang quay về danh sách bảng...');
              setTimeout(() => { window.location.href = '/Boards'; }, 500);
            } catch (err) {
              Toast.error(err.message || 'Không thể xóa bảng.');
            }
          }
        });
      });
    }

    if (btnOpenArchived) {
      btnOpenArchived.addEventListener('click', () => {
        Modal.open('archived-cards-modal');
        loadArchivedCards();
      });
    }
  };

  const deleteList = (listEl) => {
    if (!listEl) return;
    const listId = parseInt(listEl.dataset.id, 10);
    const title = listEl.querySelector('.list-title-input')?.value || '';
    const count = listEl.querySelectorAll('.card-item').length;
    ConfirmDialog.show({
      title: 'Xóa danh sách?',
      message: count > 0
        ? `Danh sách "${title}" và ${count} thẻ bên trong sẽ bị xóa vĩnh viễn.`
        : `Danh sách "${title}" sẽ bị xóa vĩnh viễn.`,
      confirmText: 'Xóa danh sách',
      onConfirm: async () => {
        try {
          await Api.deleteList(listId);
          listEl.remove();
          Toast.success('Đã xóa danh sách.');
        } catch (err) {
          Toast.error(err.message || 'Không thể xóa danh sách.');
        }
      }
    });
  };

  const submitNewCard = async (listEl) => {
    const textarea = listEl.querySelector('.card-composer-box textarea');
    const title = textarea.value.trim();
    if (!title) return;

    const listId = parseInt(listEl.dataset.id, 10);
    const submitBtn = listEl.querySelector('.btn-submit-card');

    try {
      submitBtn.disabled = true;
      const newCard = await Api.createCard(listId, title);

      const cardsContainer = listEl.querySelector('.list-cards-container');
      cardsContainer.insertAdjacentHTML('beforeend', renderCard(newCard));

      textarea.value = '';
      textarea.focus();
      updateListCount(listEl);
      Toast.success(`Đã thêm thẻ "${title}"`);
    } catch (err) {
      Toast.error(err.message || 'Không thể tạo thẻ mới.');
    } finally {
      submitBtn.disabled = false;
    }
  };

  const init = async () => {
    canvas = document.getElementById('board-canvas');
    if (!canvas) return;

    const boardEl = canvas.closest('[data-board-id]');
    if (!boardEl) return;

    boardId = parseInt(boardEl.dataset.boardId, 10);

    // Kiểm tra background đã lưu
    const savedBg = localStorage.getItem(`vtt_board_bg_${boardId}`);
    if (savedBg) {
      boardEl.style.background = savedBg;
    }

    // Hiển thị trạng thái loading
    canvas.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px; padding:20px;">
        <div class="kanban-list skeleton" style="height:300px; width:280px;"></div>
        <div class="kanban-list skeleton" style="height:240px; width:280px;"></div>
        <div class="kanban-list skeleton" style="height:180px; width:280px;"></div>
      </div>
    `;

    try {
      renderBoard(await Api.getBoard(boardId));

      setupDragAndDrop();
      setupEventListeners();
      CardDetail.initEvents();
    } catch (err) {
      canvas.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✕</div>
          <h3 class="empty-state-title">Không thể tải dữ liệu bảng</h3>
          <p class="empty-state-text">${esc(err.message || 'Vui lòng kiểm tra kết nối mạng và thử lại.')}</p>
          <button type="button" class="btn btn-primary" onclick="location.reload()">Tải lại trang</button>
        </div>
      `;
    }
  };

  return { init };
})();
