/**
 * VTT Kanban Board Controller - Drag & Drop, Filtering, Real-time Sync
 */
const BoardApp = (() => {
  let boardId = null;
  let canvas = null;
  let currentLists = [];
  let draggingCard = null;
  let placeholder = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const formatDueDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    const formatted = d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
    const now = new Date();
    const isOverdue = d < now;
    const diffHours = (d - now) / (1000 * 60 * 60);
    const isSoon = !isOverdue && diffHours <= 24;

    let pillClass = 'due-ok';
    if (isOverdue) pillClass = 'due-overdue';
    else if (isSoon) pillClass = 'due-soon';

    return { formatted, pillClass, isOverdue, isSoon };
  };

  const renderCard = (c) => {
    // 1. Mức ưu tiên (Priority)
    const prio = c.priority || 'Medium';
    let prioIcon = '🟡';
    let prioLabel = 'Trung bình';
    if (prio === 'Urgent') { prioIcon = '🔴'; prioLabel = 'Khẩn cấp'; }
    else if (prio === 'High') { prioIcon = '🟠'; prioLabel = 'Cao'; }
    else if (prio === 'Low') { prioIcon = '🟢'; prioLabel = 'Thấp'; }

    const priorityHtml = `<span class="card-priority-pill priority-${prio}">${prioIcon} ${prioLabel}</span>`;

    // 2. Hạn chót
    let dueHtml = '';
    if (c.dueDate) {
      const dueInfo = formatDueDate(c.dueDate);
      if (dueInfo) {
        dueHtml = `<span class="card-badge-pill ${dueInfo.pillClass} badge-due-date">◷ ${dueInfo.formatted}</span>`;
      }
    }

    // 3. Số bình luận
    let commentsHtml = '';
    if (c.commentsCount) {
      commentsHtml = `<span class="badge-comments-count" title="${c.commentsCount} bình luận">💬 ${c.commentsCount}</span>`;
    }

    // 4. Avatars thành viên được giao
    let avatarsHtml = '';
    if (c.assignedUsers && c.assignedUsers.length > 0) {
      avatarsHtml = `
        <div class="avatar-group" style="margin-left: auto;">
          ${c.assignedUsers.slice(0, 3).map(u => `
            <div class="avatar avatar-xs" title="${esc(u.fullName)}" style="background: linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%);">
              ${esc(u.avatar || u.fullName[0])}
            </div>
          `).join('')}
        </div>
      `;
    }

    // 5. Thanh tiến độ %
    const progress = Number(c.progressPercent) || 0;
    const progressHtml = `
      <div class="card-progress-wrap" title="Tiến độ hoàn thành: ${progress}%">
        <div class="card-progress-bar">
          <div class="card-progress-fill" style="width: ${progress}%;"></div>
        </div>
        <span class="card-progress-text">${progress}%</span>
      </div>
    `;

    return `
      <div class="card-item" draggable="true" data-id="${c.id}" data-pos="${c.position ?? 0}" data-priority="${prio}" data-due="${c.dueDate || ''}">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          ${priorityHtml}
        </div>
        <div class="card-title-text">${esc(c.title)}</div>
        ${progressHtml}
        <div class="card-badges-row" style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
          ${dueHtml}
          ${commentsHtml}
          ${avatarsHtml}
        </div>
      </div>
    `;
  };

  const renderList = (l) => `
    <div class="kanban-list" data-id="${l.id}">
      <div class="list-header">
        <input class="list-title-input" value="${esc(l.title)}" maxlength="100" aria-label="Tên danh sách">
        <span class="list-badge-count">${(l.cards || []).length}</span>
      </div>
      <div class="list-cards-container">
        ${(l.cards || []).map(renderCard).join('')}
      </div>
      <div class="list-footer">
        <div class="card-composer-box" hidden>
          <textarea placeholder="Nhập tiêu đề công việc..."></textarea>
          <div style="margin-bottom: 8px;">
            <select class="form-control composer-priority-select" style="font-size: 11.5px; height: 28px; padding: 2px 6px;">
              <option value="Urgent">🔴 Khẩn cấp</option>
              <option value="High">🟠 Cao</option>
              <option value="Medium" selected>🟡 Trung bình</option>
              <option value="Low">🟢 Thấp</option>
            </select>
          </div>
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
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
    });

    canvas.addEventListener('dragend', () => {
      if (draggingCard) {
        draggingCard.classList.remove('is-dragging');
        draggingCard = null;
      }
      if (placeholder && placeholder.parentNode) {
        placeholder.remove();
      }
    });

    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const container = e.target.closest('.list-cards-container');
      if (!container || !draggingCard) return;

      const afterElement = getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        container.appendChild(placeholder);
      } else {
        container.insertBefore(placeholder, afterElement);
      }
    });

    canvas.addEventListener('drop', async (e) => {
      e.preventDefault();
      const container = e.target.closest('.list-cards-container');
      if (!container || !draggingCard) return;

      const listEl = container.closest('.kanban-list');
      const targetListId = Number(listEl.getAttribute('data-id'));
      const cardId = Number(draggingCard.getAttribute('data-id'));

      container.insertBefore(draggingCard, placeholder);
      if (placeholder.parentNode) placeholder.remove();

      // Tính toán vị trí mới
      const prevCard = draggingCard.previousElementSibling;
      const nextCard = draggingCard.nextElementSibling;
      const prevPos = prevCard ? parseFloat(prevCard.getAttribute('data-pos') || '0') : 0;
      const nextPos = nextCard ? parseFloat(nextCard.getAttribute('data-pos') || (prevPos + 2048)) : prevPos + 2048;
      const newPos = (prevPos + nextPos) / 2;
      draggingCard.setAttribute('data-pos', newPos);

      // Cập nhật số lượng
      document.querySelectorAll('.kanban-list').forEach(updateListCount);

      // Gọi API cập nhật
      try {
        await Api.updateCard(cardId, {
          listId: targetListId,
          position: newPos
        });

        // Phát Socket tới các client khác
        SocketClient.emitCardMove({
          cardId,
          targetListId,
          newPosition: newPos
        });
      } catch (err) {
        Toast.error('Không thể lưu vị trí thẻ.');
      }
    });
  };

  const getDragAfterElement = (container, y) => {
    const draggableElements = [...container.querySelectorAll('.card-item:not(.is-dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  };

  // Áp dụng bộ lọc tìm kiếm, độ ưu tiên, hạn chót
  const applyFilters = () => {
    const searchVal = (document.getElementById('board-search-input')?.value || '').trim().toLowerCase();
    const prioVal = document.getElementById('board-filter-priority')?.value || '';
    const dueVal = document.getElementById('board-filter-due')?.value || '';

    const now = new Date();

    document.querySelectorAll('.card-item').forEach(card => {
      const title = (card.querySelector('.card-title-text')?.textContent || '').toLowerCase();
      const prio = card.getAttribute('data-priority') || '';
      const dueStr = card.getAttribute('data-due');

      let matchesSearch = !searchVal || title.includes(searchVal);
      let matchesPrio = !prioVal || prio === prioVal;
      let matchesDue = true;

      if (dueVal === 'overdue') {
        matchesDue = dueStr && new Date(dueStr) < now;
      } else if (dueVal === 'soon') {
        if (!dueStr) matchesDue = false;
        else {
          const d = new Date(dueStr);
          const diffHours = (d - now) / (1000 * 60 * 60);
          matchesDue = d >= now && diffHours <= 24;
        }
      }

      if (matchesSearch && matchesPrio && matchesDue) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  };

  const loadBoard = async () => {
    try {
      const data = await Api.getBoard(boardId);
      currentLists = data.lists || [];

      canvas.innerHTML = currentLists.map(renderList).join('') + addListHtml;
      setupDragAndDrop();
      applyFilters();
    } catch (err) {
      canvas.innerHTML = `
        <div style="padding:40px; color:#fff; text-align:center;">
          <p>Không thể tải dữ liệu bảng việc.</p>
          <button type="button" class="btn btn-secondary btn-sm" onclick="BoardApp.refreshBoard()">Thử lại</button>
        </div>
      `;
    }
  };

  const initEvents = () => {
    const boardViewEl = document.querySelector('.board-view');
    if (!boardViewEl) return;

    boardId = Number(boardViewEl.getAttribute('data-board-id'));
    canvas = document.getElementById('board-canvas');

    // 1. Mở modal chi tiết khi click thẻ
    canvas.addEventListener('click', (e) => {
      const card = e.target.closest('.card-item');
      if (card && !e.target.closest('.composer-actions')) {
        const id = card.getAttribute('data-id');
        if (id && typeof CardDetail !== 'undefined') {
          CardDetail.open(id);
        }
      }
    });

    // 2. Mở / Đóng composer thêm thẻ
    canvas.addEventListener('click', (e) => {
      const btnOpen = e.target.closest('.btn-open-composer');
      if (btnOpen) {
        const footer = btnOpen.closest('.list-footer');
        const box = footer.querySelector('.card-composer-box');
        btnOpen.hidden = true;
        box.hidden = false;
        box.querySelector('textarea').focus();
        return;
      }

      const btnCancel = e.target.closest('.btn-cancel-card');
      if (btnCancel) {
        const footer = btnCancel.closest('.list-footer');
        const box = footer.querySelector('.card-composer-box');
        const btnOpen = footer.querySelector('.btn-open-composer');
        box.hidden = true;
        btnOpen.hidden = false;
        box.querySelector('textarea').value = '';
      }
    });

    // 3. Submit thêm thẻ mới
    canvas.addEventListener('click', async (e) => {
      const btnSubmit = e.target.closest('.btn-submit-card');
      if (!btnSubmit) return;

      const footer = btnSubmit.closest('.list-footer');
      const box = footer.querySelector('.card-composer-box');
      const textarea = box.querySelector('textarea');
      const title = textarea.value.trim();
      if (!title) return;

      const prioSelect = box.querySelector('.composer-priority-select');
      const priority = prioSelect ? prioSelect.value : 'Medium';

      const listEl = footer.closest('.kanban-list');
      const listId = Number(listEl.getAttribute('data-id'));

      try {
        const card = await Api.createCard({
          listId,
          title,
          priority
        });

        const container = listEl.querySelector('.list-cards-container');
        container.insertAdjacentHTML('beforeend', renderCard(card));
        updateListCount(listEl);

        textarea.value = '';
        textarea.focus();
        applyFilters();
      } catch (err) {
        Toast.error('Không thể tạo thẻ.');
      }
    });

    // 4. Mở / Đóng form thêm danh sách cột
    canvas.addEventListener('click', (e) => {
      const btnOpen = e.target.closest('.btn-open-add-list');
      if (btnOpen) {
        const wrap = btnOpen.closest('.add-list-wrapper');
        wrap.querySelector('.add-list-form').hidden = false;
        btnOpen.hidden = true;
        wrap.querySelector('input').focus();
        return;
      }

      const btnCancel = e.target.closest('.btn-cancel-list');
      if (btnCancel) {
        const wrap = btnCancel.closest('.add-list-wrapper');
        wrap.querySelector('.add-list-form').hidden = true;
        wrap.querySelector('.btn-open-add-list').hidden = false;
        wrap.querySelector('input').value = '';
      }
    });

    // 5. Submit thêm danh sách mới
    canvas.addEventListener('submit', async (e) => {
      const form = e.target.closest('.add-list-form');
      if (!form) return;
      e.preventDefault();

      const input = form.querySelector('input');
      const title = input.value.trim();
      if (!title) return;

      try {
        const list = await Api.createList({ boardId, title });
        const wrap = form.closest('.add-list-wrapper');
        wrap.insertAdjacentHTML('beforebegin', renderList(list));
        input.value = '';
        form.hidden = true;
        wrap.querySelector('.btn-open-add-list').hidden = false;
        currentLists.push(list);
      } catch (err) {
        Toast.error('Không thể tạo danh sách.');
      }
    });

    // 6. Đổi tên danh sách
    canvas.addEventListener('change', async (e) => {
      const titleInput = e.target.closest('.list-title-input');
      if (!titleInput) return;
      const listEl = titleInput.closest('.kanban-list');
      const id = listEl.getAttribute('data-id');
      const val = titleInput.value.trim();
      if (!val) return;

      try {
        await Api.renameList(id, { title: val });
        Toast.success('Đã đổi tên danh sách.');
      } catch (err) {
        Toast.error('Lỗi khi đổi tên.');
      }
    });

    // 7. Lắng nghe lọc và tìm kiếm
    const searchInput = document.getElementById('board-search-input');
    const filterPrio = document.getElementById('board-filter-priority');
    const filterDue = document.getElementById('board-filter-due');

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterPrio) filterPrio.addEventListener('change', applyFilters);
    if (filterDue) filterDue.addEventListener('change', applyFilters);

    // 8. Đổi nền bảng
    const btnBg = document.getElementById('btn-change-board-bg');
    if (btnBg) {
      btnBg.addEventListener('click', () => Modal.open('board-bg-modal'));
    }
    document.querySelectorAll('.board-bg-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const bg = opt.getAttribute('data-bg');
        if (bg && boardViewEl) {
          boardViewEl.style.background = bg;
          Modal.close('board-bg-modal');
        }
      });
    });

    // Tải dữ liệu ban đầu
    loadBoard();
  };

  // Remote Real-Time Handlers (Nhận từ Socket.IO)
  const handleRemoteCardMoved = (data) => {
    const cardEl = document.querySelector(`.card-item[data-id="${data.cardId}"]`);
    const targetList = document.querySelector(`.kanban-list[data-id="${data.targetListId}"]`);
    if (cardEl && targetList) {
      const container = targetList.querySelector('.list-cards-container');
      if (container) {
        container.appendChild(cardEl);
        cardEl.setAttribute('data-pos', data.newPosition);
        document.querySelectorAll('.kanban-list').forEach(updateListCount);
      }
    }
  };

  const handleRemoteCardCreated = (data) => {
    const listEl = document.querySelector(`.kanban-list[data-id="${data.listId}"]`);
    if (listEl) {
      const container = listEl.querySelector('.list-cards-container');
      if (container && !container.querySelector(`.card-item[data-id="${data.card.id}"]`)) {
        container.insertAdjacentHTML('beforeend', renderCard(data.card));
        updateListCount(listEl);
        applyFilters();
      }
    }
  };

  const handleRemoteCardUpdated = (data) => {
    const cardEl = document.querySelector(`.card-item[data-id="${data.card.id}"]`);
    if (cardEl) {
      const listEl = cardEl.closest('.kanban-list');
      const targetList = document.querySelector(`.kanban-list[data-id="${data.card.listId}"]`);
      
      const newCardHtml = renderCard(data.card);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newCardHtml;
      const newEl = tempDiv.firstElementChild;

      if (targetList && listEl && listEl !== targetList) {
        cardEl.remove();
        targetList.querySelector('.list-cards-container').appendChild(newEl);
        updateListCount(listEl);
        updateListCount(targetList);
      } else {
        cardEl.replaceWith(newEl);
      }
      applyFilters();
    }
  };

  const handleRemoteCardDeleted = (data) => {
    const cardEl = document.querySelector(`.card-item[data-id="${data.cardId}"]`);
    if (cardEl) {
      const listEl = cardEl.closest('.kanban-list');
      cardEl.remove();
      if (listEl) updateListCount(listEl);
    }
  };

  const handleRemoteListCreated = (data) => {
    const wrap = canvas.querySelector('.add-list-wrapper');
    if (wrap && !canvas.querySelector(`.kanban-list[data-id="${data.list.id}"]`)) {
      wrap.insertAdjacentHTML('beforebegin', renderList(data.list));
      currentLists.push(data.list);
    }
  };

  return {
    init: initEvents,
    refreshBoard: loadBoard,
    getCurrentLists: () => currentLists,
    handleRemoteCardMoved,
    handleRemoteCardCreated,
    handleRemoteCardUpdated,
    handleRemoteCardDeleted,
    handleRemoteListCreated
  };
})();

document.addEventListener('DOMContentLoaded', BoardApp.init);
