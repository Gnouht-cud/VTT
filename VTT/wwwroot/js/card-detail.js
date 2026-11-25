/**
 * VTT Card Detail Modal Controller
 */
const CardDetail = (() => {
  let currentCardId = null;
  let currentTitle = '';
  let currentDue = '';
  let currentDone = false;
  const modalId = 'card-detail-modal';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const $ = (sel) => document.getElementById('card-modal-' + sel);

  const renderComment = (m) => `
    <div class="comment-item" data-id="${m.id}">
      <div class="avatar avatar-sm">${esc((m.user || 'U')[0].toUpperCase())}</div>
      <div class="comment-bubble">
        <div class="comment-header">
          <span class="comment-author">${esc(m.user)}</span>
          <span class="comment-time">${esc(m.createdAt)}</span>
        </div>
        <div class="comment-text">${esc(m.content)}</div>
      </div>
    </div>
  `;

  const tileOf = (id) => document.querySelector(`.card-item[data-id="${id}"]`);

  const updateListCount = (listEl) => {
    if (!listEl) return;
    const counter = listEl.querySelector('.list-badge-count');
    if (counter) counter.textContent = listEl.querySelectorAll('.card-item').length;
  };

  // ---- Giao diện ngày hết hạn ----------------------------------------------
  /** Cập nhật ô trạng thái, checkbox "hoàn thành", nút xóa hạn trong modal. */
  const renderDueUi = () => {
    const info = DueUtil.describe(currentDue, currentDone);
    const status = $('due-status');
    const doneWrap = $('due-done-wrap');
    const clearBtn = $('due-clear');

    $('due').value = currentDue || '';
    $('due-done').checked = !!currentDone;

    if (info) {
      status.hidden = false;
      status.className = `due-status due-status-${info.state}`;
      status.textContent = `${info.icon} ${info.label}`;
      status.title = info.full;
    } else {
      status.hidden = true;
      status.textContent = '';
    }
    doneWrap.hidden = !info;
    clearBtn.hidden = !info;
  };

  /** Cập nhật nhãn hạn trên thẻ ngoài bảng theo trạng thái hiện tại. */
  const refreshTileDue = () => {
    const tile = tileOf(currentCardId);
    if (!tile) return;
    const row = tile.querySelector('.card-badges-row');
    const existing = tile.querySelector('.badge-due-date');
    const html = DueUtil.pillHtml(currentDue, currentDone);
    if (existing) {
      if (html) existing.outerHTML = html; else existing.remove();
    } else if (html && row) {
      row.insertAdjacentHTML('afterbegin', html);
    }
  };

  const saveDue = async (payload, successMsg, previous) => {
    if (!currentCardId) return;
    try {
      await Api.updateCard(currentCardId, payload);
      refreshTileDue();
      renderDueUi();
      Toast.success(successMsg);
    } catch (err) {
      // Khôi phục trạng thái cũ để giao diện luôn khớp với dữ liệu thật.
      currentDue = previous.due;
      currentDone = previous.done;
      renderDueUi();
      Toast.error(err.message || 'Không thể cập nhật ngày hết hạn.');
    }
  };

  const open = async (cardId) => {
    currentCardId = cardId;
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const titleInput = $('title');
    const commentList = $('comments');
    const commentInput = $('new-comment');

    titleInput.value = 'Đang tải...';
    $('list-title').textContent = '...';
    $('desc').value = '';
    currentDue = '';
    currentDone = false;
    renderDueUi();
    $('delete-btn').hidden = true;
    commentList.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted);"><span class="spinner"></span></div>';
    if (commentInput) commentInput.value = '';

    Modal.open(modalId);

    try {
      const data = await Api.getCard(cardId);
      if (currentCardId !== cardId) return; // người dùng đã mở thẻ khác
      currentTitle = data.title || '';
      titleInput.value = currentTitle;
      $('list-title').textContent = data.listTitle || '';
      $('desc').value = data.description || '';
      currentDue = data.due || '';
      currentDone = !!data.isDueDone;
      renderDueUi();
      $('delete-btn').hidden = !data.canDelete;

      if (data.comments && data.comments.length > 0) {
        commentList.innerHTML = data.comments.map(renderComment).join('');
      } else {
        commentList.innerHTML = '<div style="padding:8px 0; color:var(--text-subtle); font-size:13px; font-style:italic;">Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</div>';
      }
    } catch (err) {
      Toast.error(err.message || 'Không thể tải chi tiết thẻ.');
      Modal.close(modalId);
    }
  };

  const initEvents = () => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const titleInput = $('title');
    const descTextarea = $('desc');
    const btnSaveDesc = $('save-desc');
    const dueInput = $('due');
    const btnAddComment = $('submit-comment');
    const commentInput = $('new-comment');
    const btnArchive = $('archive-btn');
    const btnDelete = $('delete-btn');

    // Sửa tiêu đề thẻ
    titleInput.addEventListener('change', async () => {
      const val = titleInput.value.trim();
      if (!currentCardId) return;
      if (!val) {
        Toast.warning('Tiêu đề thẻ không được để trống.');
        titleInput.value = currentTitle;
        return;
      }

      try {
        await Api.updateCard(currentCardId, { title: val });
        currentTitle = val;
        const tEl = tileOf(currentCardId)?.querySelector('.card-title-text');
        if (tEl) tEl.textContent = val;
        Toast.success('Đã cập nhật tiêu đề thẻ.');
      } catch (err) {
        titleInput.value = currentTitle;
        Toast.error(err.message || 'Lỗi khi cập nhật tiêu đề.');
      }
    });

    // Lưu mô tả thẻ
    if (btnSaveDesc) {
      btnSaveDesc.addEventListener('click', async () => {
        if (!currentCardId) return;
        const desc = descTextarea.value;
        try {
          btnSaveDesc.disabled = true;
          await Api.updateCard(currentCardId, { description: desc });
          const cardTile = tileOf(currentCardId);
          if (cardTile) {
            const descBadge = cardTile.querySelector('.badge-has-desc');
            const badgesRow = cardTile.querySelector('.card-badges-row');
            if (desc && desc.trim()) {
              if (!descBadge && badgesRow) {
                badgesRow.insertAdjacentHTML('beforeend', '<span class="badge-has-desc" title="Có mô tả">≡</span>');
              }
            } else if (descBadge) {
              descBadge.remove();
            }
          }
          Toast.success('Đã lưu mô tả thẻ.');
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi lưu mô tả.');
        } finally {
          btnSaveDesc.disabled = false;
        }
      });
    }

    // ---- Ngày hết hạn -----------------------------------------------------
    dueInput.addEventListener('change', () => {
      if (!currentCardId) return;
      const previous = { due: currentDue, done: currentDone };
      const val = dueInput.value;

      if (!val) {
        if (dueInput.validity.badInput) {
          Toast.warning('Ngày giờ chưa đầy đủ. Vui lòng chọn lại.');
          renderDueUi();
          return;
        }
        currentDue = '';
        currentDone = false;
        saveDue({ due: '' }, 'Đã xóa ngày hết hạn.', previous);
        return;
      }

      const year = new Date(val).getFullYear();
      if (isNaN(year) || year < 2000 || year > 2100) {
        Toast.warning('Vui lòng chọn ngày hết hạn trong khoảng năm 2000 - 2100.');
        renderDueUi();
        return;
      }
      currentDue = val;
      saveDue({ due: val }, 'Đã cập nhật ngày hết hạn.', previous);
    });

    modal.querySelectorAll('.due-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentCardId) return;
        const previous = { due: currentDue, done: currentDone };
        currentDue = DueUtil.preset(parseInt(btn.dataset.dueOffset, 10));
        saveDue({ due: currentDue }, 'Đã cập nhật ngày hết hạn.', previous);
      });
    });

    $('due-clear').addEventListener('click', () => {
      if (!currentCardId) return;
      const previous = { due: currentDue, done: currentDone };
      currentDue = '';
      currentDone = false;
      saveDue({ due: '' }, 'Đã xóa ngày hết hạn.', previous);
    });

    $('due-done').addEventListener('change', (e) => {
      if (!currentCardId) return;
      const previous = { due: currentDue, done: currentDone };
      currentDone = e.target.checked;
      saveDue({ dueDone: currentDone },
        currentDone ? 'Đã đánh dấu hoàn thành.' : 'Đã bỏ đánh dấu hoàn thành.', previous);
    });

    // ---- Bình luận --------------------------------------------------------
    const postComment = async () => {
      if (!currentCardId) return;
      const content = commentInput.value.trim();
      if (!content) return;

      try {
        btnAddComment.disabled = true;
        const res = await Api.addComment(currentCardId, content);
        const commentList = $('comments');
        const emptyMsg = commentList.querySelector('div[style*="font-style:italic"]');
        if (emptyMsg) emptyMsg.remove();

        commentList.insertAdjacentHTML('afterbegin', renderComment(res));
        commentInput.value = '';

        const cardTile = tileOf(currentCardId);
        if (cardTile) {
          const commentBadge = cardTile.querySelector('.badge-comments-count');
          const badgesRow = cardTile.querySelector('.card-badges-row');
          if (commentBadge) {
            const count = parseInt(commentBadge.dataset.count || '0', 10) + 1;
            commentBadge.dataset.count = count;
            commentBadge.innerHTML = `💬 ${count}`;
          } else if (badgesRow) {
            badgesRow.insertAdjacentHTML('beforeend', `<span class="badge-comments-count" data-count="1">💬 1</span>`);
          }
        }

        Toast.success('Đã đăng bình luận.');
      } catch (err) {
        Toast.error(err.message || 'Không thể gửi bình luận.');
      } finally {
        btnAddComment.disabled = false;
      }
    };

    if (btnAddComment) btnAddComment.addEventListener('click', postComment);
    if (commentInput) {
      commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          postComment();
        }
      });
    }

    const removeTile = (cardId) => {
      const cardTile = tileOf(cardId);
      if (!cardTile) return;
      const list = cardTile.closest('.kanban-list');
      cardTile.style.transition = 'all 0.25s ease';
      cardTile.style.opacity = '0';
      cardTile.style.transform = 'scale(0.8)';
      setTimeout(() => { cardTile.remove(); updateListCount(list); }, 250);
    };

    // ---- Lưu trữ thẻ ------------------------------------------------------
    if (btnArchive) {
      btnArchive.addEventListener('click', () => {
        if (!currentCardId) return;
        const cardId = currentCardId;
        ConfirmDialog.show({
          title: 'Lưu trữ thẻ này?',
          message: 'Thẻ này sẽ được chuyển vào mục lưu trữ và ẩn khỏi bảng công việc.',
          confirmText: 'Lưu trữ',
          onConfirm: async () => {
            try {
              await Api.updateCard(cardId, { archive: true });
              removeTile(cardId);
              Modal.close(modalId);
              Toast.success('Đã lưu trữ thẻ thành công.');
            } catch (err) {
              Toast.error(err.message || 'Lỗi khi lưu trữ thẻ.');
            }
          }
        });
      });
    }

    // ---- Xóa thẻ vĩnh viễn ------------------------------------------------
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (!currentCardId) return;
        const cardId = currentCardId;
        ConfirmDialog.show({
          title: 'Xóa thẻ vĩnh viễn?',
          message: `Thẻ "${currentTitle}" cùng bình luận và mọi dữ liệu liên quan sẽ bị xóa và không thể khôi phục.`,
          confirmText: 'Xóa thẻ',
          onConfirm: async () => {
            try {
              await Api.deleteCard(cardId);
              removeTile(cardId);
              Modal.close(modalId);
              Toast.success('Đã xóa thẻ.');
            } catch (err) {
              Toast.error(err.message || 'Không thể xóa thẻ.');
            }
          }
        });
      });
    }
  };

  return { open, initEvents };
})();
