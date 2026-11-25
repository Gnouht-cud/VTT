/**
 * VTT Toast Notification Manager
 */
const Toast = (() => {
  let container = null;

  const ensureContainer = () => {
    if (!container || !document.body.contains(container)) {
      container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  };

  const show = (message, type = 'info', duration = 3500) => {
    const parent = ensureContainer();
    const item = document.createElement('div');
    item.className = `toast ${type}`;

    let iconText = 'ℹ';
    if (type === 'success') iconText = '✓';
    else if (type === 'error') iconText = '✕';
    else if (type === 'warning') iconText = '⚠';

    item.innerHTML = `
      <div class="toast-icon">${iconText}</div>
      <div class="toast-content"></div>
      <button type="button" class="toast-close" aria-label="Đóng">✕</button>
    `;
    // textContent để nội dung do người dùng nhập (tên thẻ, danh sách...) không bị diễn giải thành HTML.
    item.querySelector('.toast-content').textContent = String(message ?? '');

    const close = () => {
      item.classList.add('toast-hide');
      setTimeout(() => item.remove(), 250);
    };

    item.querySelector('.toast-close').addEventListener('click', close);
    parent.appendChild(item);

    if (duration > 0) {
      setTimeout(close, duration);
    }
  };

  return {
    success: (msg, duration) => show(msg, 'success', duration),
    error: (msg, duration) => show(msg, 'error', duration),
    warning: (msg, duration) => show(msg, 'warning', duration),
    info: (msg, duration) => show(msg, 'info', duration)
  };
})();
