/**
 * VTT Card Detail Modal Controller
 */
const CardDetail = (() => {
  let currentCardId = null;
  const modalId = 'card-detail-modal';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

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

  const open = async (cardId) => {
    currentCardId = cardId;
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Reset fields to loading state
    const titleInput = modal.querySelector('#card-modal-title');
    const listLabel = modal.querySelector('#card-modal-list-title');
    const descTextarea = modal.querySelector('#card-modal-desc');
    const dueInput = modal.querySelector('#card-modal-due');
    const commentList = modal.querySelector('#card-modal-comments');
    const commentInput = modal.querySelector('#card-modal-new-comment');

    titleInput.value = 'Đang tải...';
    listLabel.textContent = '...';
    descTextarea.value = '';
    dueInput.value = '';
    commentList.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted);"><span class="spinner"></span></div>';
    if (commentInput) commentInput.value = '';

    Modal.open(modalId);

    try {
      const data = await Api.getCard(cardId);
      titleInput.value = data.title || '';
      listLabel.textContent = data.listTitle || '';
      descTextarea.value = data.description || '';
      dueInput.value = data.due || '';

      if (data.comments && data.comments.length > 0) {
        commentList.innerHTML = data.comments.map(renderComment).join('');
      } else {
        commentList.innerHTML = '<div style="padding:8px 0; color:var(--text-subtle); font-size:13px; font-style:italic;">Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</div>';
      }
    } catch (err) {
      Toast.error('Không thể tải chi tiết thẻ.');
      Modal.close(modalId);
    }
  };

  const initEvents = () => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const titleInput = modal.querySelector('#card-modal-title');
    const descTextarea = modal.querySelector('#card-modal-desc');
    const btnSaveDesc = modal.querySelector('#card-modal-save-desc');
    const dueInput = modal.querySelector('#card-modal-due');
    const btnAddComment = modal.querySelector('#card-modal-submit-comment');
    const commentInput = modal.querySelector('#card-modal-new-comment');
    const btnArchive = modal.querySelector('#card-modal-archive-btn');

    // Sửa tiêu đề thẻ
    titleInput.addEventListener('change', async () => {
      const val = titleInput.value.trim();
      if (!val || !currentCardId) return;

      try {
        await Api.updateCard(currentCardId, { title: val });
        // Cập nhật card ngoài giao diện
        const cardTile = document.querySelector(`.card-item[data-id="${currentCardId}"]`);
        if (cardTile) {
          const tEl = cardTile.querySelector('.card-title-text');
          if (tEl) tEl.textContent = val;
        }
        Toast.success('Đã cập nhật tiêu đề thẻ.');
      } catch (err) {
        Toast.error('Lỗi khi cập nhật tiêu đề.');
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
          // Cập nhật biểu tượng mô tả trên card tile
          const cardTile = document.querySelector(`.card-item[data-id="${currentCardId}"]`);
          if (cardTile) {
            let descBadge = cardTile.querySelector('.badge-has-desc');
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
          Toast.error('Lỗi khi lưu mô tả.');
        } finally {
          btnSaveDesc.disabled = false;
        }
      });
    }

    // Đổi hạn chót
    dueInput.addEventListener('change', async () => {
      if (!currentCardId) return;
      const dueVal = dueInput.value;
      try {
        await Api.updateCard(currentCardId, { due: dueVal });
        // Cập nhật badge ngày trên card tile
        const cardTile = document.querySelector(`.card-item[data-id="${currentCardId}"]`);
        if (cardTile) {
          let dueBadge = cardTile.querySelector('.badge-due-date');
          const badgesRow = cardTile.querySelector('.card-badges-row');
          if (dueVal) {
            const dateObj = new Date(dueVal);
            const formatted = dateObj.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
            const now = new Date();
            const isOverdue = dateObj < now;
            const diffHours = (dateObj - now) / (1000 * 60 * 60);
            const isSoon = !isOverdue && diffHours <= 24;

            let pillClass = 'due-ok';
            if (isOverdue) pillClass = 'due-overdue';
            else if (isSoon) pillClass = 'due-soon';

            const badgeHtml = `<span class="card-badge-pill ${pillClass} badge-due-date">◷ ${formatted}</span>`;
            if (dueBadge) {
              dueBadge.outerHTML = badgeHtml;
            } else if (badgesRow) {
              badgesRow.insertAdjacentHTML('afterbegin', badgeHtml);
            }
          } else if (dueBadge) {
            dueBadge.remove();
          }
        }
        Toast.success('Đã cập nhật ngày hết hạn.');
      } catch (err) {
        Toast.error('Lỗi khi cập nhật hạn chót.');
      }
    });

    // Thêm bình luận
    const postComment = async () => {
      if (!currentCardId) return;
      const content = commentInput.value.trim();
      if (!content) return;

      try {
        btnAddComment.disabled = true;
        const res = await Api.addComment(currentCardId, content);
        const commentList = modal.querySelector('#card-modal-comments');
        // Xóa thông báo trống nếu có
        const emptyMsg = commentList.querySelector('div[style*="font-style:italic"]');
        if (emptyMsg) emptyMsg.remove();

        commentList.insertAdjacentHTML('afterbegin', renderComment(res));
        commentInput.value = '';

        // Cập nhật badge số lượng bình luận trên card tile
        const cardTile = document.querySelector(`.card-item[data-id="${currentCardId}"]`);
        if (cardTile) {
          let commentBadge = cardTile.querySelector('.badge-comments-count');
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
        Toast.error('Không thể gửi bình luận.');
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

    // Lưu trữ / Xóa thẻ
    if (btnArchive) {
      btnArchive.addEventListener('click', () => {
        if (!currentCardId) return;
        ConfirmDialog.show({
          title: 'Lưu trữ thẻ này?',
          message: 'Thẻ này sẽ được chuyển vào mục lưu trữ và ẩn khỏi bảng công việc.',
          confirmText: 'Lưu trữ',
          onConfirm: async () => {
            try {
              await Api.updateCard(currentCardId, { archive: true });
              const cardTile = document.querySelector(`.card-item[data-id="${currentCardId}"]`);
              if (cardTile) {
                const list = cardTile.closest('.kanban-list');
                cardTile.style.transition = 'all 0.25s ease';
                cardTile.style.opacity = '0';
                cardTile.style.transform = 'scale(0.8)';
                setTimeout(() => {
                  cardTile.remove();
                  if (list) {
                    const counter = list.querySelector('.list-badge-count');
                    const cardsCount = list.querySelectorAll('.card-item').length;
                    if (counter) counter.textContent = cardsCount;
                  }
                }, 250);
              }
              Modal.close(modalId);
              Toast.success('Đã lưu trữ thẻ thành công.');
            } catch (err) {
              Toast.error('Lỗi khi lưu trữ thẻ.');
            }
          }
        });
      });
    }
  };

  return { open, initEvents };
})();
