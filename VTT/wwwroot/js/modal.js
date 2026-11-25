/**
 * VTT Modal & Confirm Dialog Manager
 */
const Modal = (() => {
  const open = (modalId) => {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus first input
    const input = el.querySelector('input, textarea');
    if (input) setTimeout(() => input.focus(), 50);
  };

  const close = (modalId) => {
    const el = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    if (!el) return;
    el.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.style.overflow = '';
    }
  };

  // Close when clicking overlay or buttons with data-modal-close
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      close(e.target);
    } else if (e.target.closest('[data-modal-close]')) {
      const modal = e.target.closest('.modal-overlay');
      if (modal) close(modal);
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-overlay.active');
      if (activeModal) close(activeModal);
    }
  });

  return { open, close };
})();

const ConfirmDialog = (() => {
  let modalEl = null;
  let confirmCallback = null;

  const init = () => {
    if (modalEl) return;
    modalEl = document.getElementById('global-confirm-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'global-confirm-modal';
      modalEl.className = 'modal-overlay';
      modalEl.innerHTML = `
        <div class="modal-window confirm-box">
          <div class="modal-body">
            <div class="confirm-icon-wrap">⚠</div>
            <h3 class="confirm-title" id="confirm-dialog-title">Xác nhận</h3>
            <p class="confirm-text" id="confirm-dialog-desc">Bạn có chắc chắn muốn thực hiện thao tác này?</p>
            <div style="display:flex; justify-content:center; gap:12px;">
              <button type="button" class="btn btn-ghost" data-modal-close>Hủy</button>
              <button type="button" class="btn btn-danger" id="confirm-dialog-ok">Xác nhận</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    // Luôn gắn sự kiện, dù hộp thoại do layout tạo sẵn hay do script tạo.
    modalEl.querySelector('#confirm-dialog-ok').addEventListener('click', () => {
      const cb = confirmCallback;
      confirmCallback = null;
      Modal.close(modalEl);
      if (typeof cb === 'function') cb();
    });
  };

  const show = ({ title, message, confirmText = 'Xác nhận', onConfirm }) => {
    init();
    document.getElementById('confirm-dialog-title').textContent = title || 'Xác nhận';
    document.getElementById('confirm-dialog-desc').textContent = message || '';
    const okBtn = document.getElementById('confirm-dialog-ok');
    okBtn.textContent = confirmText;
    confirmCallback = onConfirm;
    Modal.open('global-confirm-modal');
  };

  return { show };
})();
