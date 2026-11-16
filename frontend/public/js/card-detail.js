/**
 * VTT Card Detail Modal Controller with Conflict Detection & Live Tracking
 */
const CardDetail = (() => {
  let currentCardId = null;
  let currentVersion = 1;
  const modalId = 'card-detail-modal';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const renderComment = (m) => `
    <div class="comment-item" data-id="${m.id}">
      <div class="avatar avatar-sm" style="background: linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%);">
        ${esc(m.avatar || (m.user || 'U')[0].toUpperCase())}
      </div>
      <div class="comment-bubble">
        <div class="comment-header">
          <span class="comment-author">${esc(m.user)}</span>
          <span class="comment-time">${esc(new Date(m.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }))}</span>
        </div>
        <div class="comment-text">${esc(m.content)}</div>
      </div>
    </div>
  `;

  const renderActivity = (a) => `
    <div style="display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; border-bottom: 1px dashed var(--border-light);">
      <div class="avatar avatar-xs" style="background: var(--bg-subtle); color: var(--text-muted); font-size: 11px;">
        ${esc(a.avatar || 'H')}
      </div>
      <div style="flex: 1;">
        <div><strong>${esc(a.userName)}</strong>: ${esc(a.details)}</div>
        <div style="font-size: 11px; color: var(--text-subtle); margin-top: 2px;">
          ${esc(new Date(a.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }))}
        </div>
      </div>
    </div>
  `;

  const open = async (cardId) => {
    currentCardId = cardId;
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const titleInput = modal.querySelector('#card-modal-title');
    const listLabel = modal.querySelector('#card-modal-list-title');
    const versionLabel = modal.querySelector('#card-modal-version');
    const statusSelect = modal.querySelector('#card-modal-status-select');
    const progressRange = modal.querySelector('#card-modal-progress-range');
    const progressLabel = modal.querySelector('#card-modal-progress-label');
    const descTextarea = modal.querySelector('#card-modal-desc');
    const prioritySelect = modal.querySelector('#card-modal-priority');
    const dueInput = modal.querySelector('#card-modal-due');
    const membersPicker = modal.querySelector('#card-modal-members-picker');
    const commentsList = modal.querySelector('#card-modal-comments-list');
    const activitiesList = modal.querySelector('#card-modal-activities-list');
    const commentInput = modal.querySelector('#card-modal-new-comment');

    titleInput.value = 'Đang tải...';
    listLabel.textContent = '...';
    descTextarea.value = '';
    dueInput.value = '';
    commentsList.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted);"><span class="spinner"></span></div>';
    activitiesList.innerHTML = '';
    if (commentInput) commentInput.value = '';

    Modal.open(modalId);

    try {
      const data = await Api.getCard(cardId);
      currentVersion = data.version || 1;

      titleInput.value = data.title || '';
      listLabel.textContent = data.listTitle || '';
      if (versionLabel) versionLabel.textContent = currentVersion;
      descTextarea.value = data.description || '';
      dueInput.value = data.dueDate ? data.dueDate.slice(0, 16) : '';
      if (prioritySelect) prioritySelect.value = data.priority || 'Medium';

      const progress = Number(data.progressPercent) || 0;
      if (progressRange) progressRange.value = progress;
      if (progressLabel) progressLabel.textContent = progress + '%';

      // Cập nhật dropdown trạng thái theo các cột của bảng hiện tại
      if (statusSelect && typeof BoardApp !== 'undefined') {
        const boardLists = BoardApp.getCurrentLists();
        statusSelect.innerHTML = boardLists.map(l => `
          <option value="${l.id}" ${l.id === data.listId ? 'selected' : ''}>${esc(l.title)}</option>
        `).join('');
      }

      // Checkbox thành viên
      if (membersPicker && data.allWorkspaceMembers) {
        const assignedSet = new Set(data.assignedUserIds || []);
        membersPicker.innerHTML = data.allWorkspaceMembers.map(u => `
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" value="${u.id}" ${assignedSet.has(u.id) ? 'checked' : ''} style="accent-color: var(--primary);" />
            <span class="avatar avatar-xs" style="background: linear-gradient(135deg, #fd79a8 0%, #fab1a0 100%);">${esc(u.avatar || u.fullName[0])}</span>
            <span>${esc(u.fullName)}</span>
          </label>
        `).join('');
      }

      // Bình luận
      if (data.comments && data.comments.length > 0) {
        commentsList.innerHTML = data.comments.map(renderComment).join('');
      } else {
        commentsList.innerHTML = '<div style="padding:10px 0; color:var(--text-subtle); font-size:13px; font-style:italic;">Chưa có bình luận nào. Hãy gửi bình luận đầu tiên!</div>';
      }

      // Lịch sử thay đổi
      if (data.activities && data.activities.length > 0) {
        activitiesList.innerHTML = data.activities.map(renderActivity).join('');
      } else {
        activitiesList.innerHTML = '<div style="padding:10px 0; color:var(--text-subtle); font-size:13px; font-style:italic;">Chưa có lịch sử thay đổi.</div>';
      }

    } catch (err) {
      Toast.error('Không thể tải chi tiết công việc.');
      Modal.close(modalId);
    }
  };

  const saveCardChanges = async (forceOverwrite = false) => {
    if (!currentCardId) return;

    const modal = document.getElementById(modalId);
    const title = modal.querySelector('#card-modal-title').value.trim();
    const description = modal.querySelector('#card-modal-desc').value;
    const priority = modal.querySelector('#card-modal-priority').value;
    const progressPercent = Number(modal.querySelector('#card-modal-progress-range').value);
    const dueDate = modal.querySelector('#card-modal-due').value || null;
    const listId = Number(modal.querySelector('#card-modal-status-select').value);

    // Lấy danh sách thành viên được tick
    const assignedUserIds = [];
    modal.querySelectorAll('#card-modal-members-picker input[type="checkbox"]:checked').forEach(cb => {
      assignedUserIds.push(Number(cb.value));
    });

    if (!title) {
      Toast.error('Tiêu đề công việc không được để trống.');
      return;
    }

    try {
      const res = await Api.updateCard(currentCardId, {
        title,
        description,
        priority,
        progressPercent,
        dueDate,
        listId,
        assignedUserIds,
        clientVersion: currentVersion,
        forceOverwrite
      });

      if (res && res.card) {
        currentVersion = res.card.version;
        const vEl = modal.querySelector('#card-modal-version');
        if (vEl) vEl.textContent = currentVersion;

        // Cập nhật card trên Kanban canvas
        if (typeof BoardApp !== 'undefined') {
          BoardApp.handleRemoteCardUpdated({ card: res.card });
        }
        Toast.success('Đã lưu thay đổi công việc thành công!');
      }
    } catch (err) {
      if (err.isConflict) {
        // Kích hoạt Modal xung đột
        SocketClient.showConflictDialog(
          err.conflictData,
          () => open(currentCardId), // Reload
          () => saveCardChanges(true) // Overwrite
        );
      } else {
        Toast.error(err.message || 'Lỗi khi lưu công việc.');
      }
    }
  };

  const initEvents = () => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Progress slider label update
    const progressRange = modal.querySelector('#card-modal-progress-range');
    const progressLabel = modal.querySelector('#card-modal-progress-label');
    if (progressRange && progressLabel) {
      progressRange.addEventListener('input', () => {
        progressLabel.textContent = progressRange.value + '%';
      });
    }

    // Tabs switching
    const tabComments = modal.querySelector('#tab-btn-comments');
    const tabActivities = modal.querySelector('#tab-btn-activities');
    const contentComments = modal.querySelector('#tab-content-comments');
    const contentActivities = modal.querySelector('#tab-content-activities');

    if (tabComments && tabActivities) {
      tabComments.addEventListener('click', () => {
        tabComments.classList.add('active');
        tabComments.style.borderBottom = '2px solid var(--primary)';
        tabComments.style.color = 'var(--text-main)';
        tabActivities.classList.remove('active');
        tabActivities.style.borderBottom = 'none';
        tabActivities.style.color = 'var(--text-muted)';
        contentComments.style.display = 'block';
        contentActivities.style.display = 'none';
      });

      tabActivities.addEventListener('click', async () => {
        tabActivities.classList.add('active');
        tabActivities.style.borderBottom = '2px solid var(--primary)';
        tabActivities.style.color = 'var(--text-main)';
        tabComments.classList.remove('active');
        tabComments.style.borderBottom = 'none';
        tabComments.style.color = 'var(--text-muted)';
        contentComments.style.display = 'none';
        contentActivities.style.display = 'block';

        // Load fresh activities
        if (currentCardId) {
          try {
            const acts = await Api.getActivities(currentCardId);
            const listEl = modal.querySelector('#card-modal-activities-list');
            if (acts && acts.length > 0) {
              listEl.innerHTML = acts.map(renderActivity).join('');
            } else {
              listEl.innerHTML = '<div style="padding:10px 0; color:var(--text-subtle); font-size:13px; font-style:italic;">Chưa có hoạt động nào.</div>';
            }
          } catch (e) {}
        }
      });
    }

    // Lưu toàn bộ thay đổi
    const btnSaveAll = modal.querySelector('#card-modal-save-all-btn');
    if (btnSaveAll) {
      btnSaveAll.addEventListener('click', () => saveCardChanges(false));
    }

    // Lưu riêng mô tả
    const btnSaveDesc = modal.querySelector('#card-modal-save-desc');
    if (btnSaveDesc) {
      btnSaveDesc.addEventListener('click', () => saveCardChanges(false));
    }

    // Gửi bình luận
    const btnSubmitComment = modal.querySelector('#card-modal-submit-comment');
    const commentInput = modal.querySelector('#card-modal-new-comment');

    const handleSendComment = async () => {
      const val = commentInput ? commentInput.value.trim() : '';
      if (!val || !currentCardId) return;

      try {
        const comment = await Api.addComment(currentCardId, val);
        const list = modal.querySelector('#card-modal-comments-list');
        const emptyNotice = list.querySelector('div[style*="font-style:italic"]');
        if (emptyNotice) emptyNotice.remove();

        list.insertAdjacentHTML('afterbegin', renderComment(comment));
        commentInput.value = '';
        Toast.success('Đã gửi bình luận.');
      } catch (err) {
        Toast.error('Không thể gửi bình luận.');
      }
    };

    if (btnSubmitComment) btnSubmitComment.addEventListener('click', handleSendComment);
    if (commentInput) {
      commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleSendComment();
        }
      });
    }

    // Xóa công việc
    const btnDelete = modal.querySelector('#card-modal-delete-btn');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (!currentCardId) return;
        if (!confirm('Bạn có chắc chắn muốn XÓA VĨNH VIỄN công việc này không?')) return;

        try {
          await Api.deleteCard(currentCardId);
          if (typeof BoardApp !== 'undefined') {
            BoardApp.handleRemoteCardDeleted({ cardId: currentCardId });
          }
          Modal.close(modalId);
          Toast.success('Đã xóa công việc.');
        } catch (err) {
          Toast.error('Lỗi khi xóa công việc.');
        }
      });
    }
  };

  const handleRemoteComment = (data) => {
    if (currentCardId && Number(data.cardId) === Number(currentCardId)) {
      const modal = document.getElementById(modalId);
      if (modal && Modal.isOpen(modalId)) {
        const list = modal.querySelector('#card-modal-comments-list');
        if (list) {
          const emptyNotice = list.querySelector('div[style*="font-style:italic"]');
          if (emptyNotice) emptyNotice.remove();
          list.insertAdjacentHTML('afterbegin', renderComment(data.comment));
        }
      }
    }
  };

  return {
    open,
    initEvents,
    handleRemoteComment
  };
})();

document.addEventListener('DOMContentLoaded', CardDetail.initEvents);
