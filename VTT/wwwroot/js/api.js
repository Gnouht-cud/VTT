/**
 * VTT API Client - Wrapper kết nối với ASP.NET Core ApiController.
 * Mọi lỗi đều được ném ra dưới dạng ApiError với thông báo tiếng Việt sẵn sàng hiển thị.
 */
const Api = (() => {
  class ApiError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  const TIMEOUT_MS = 20000;

  const defaultMessages = {
    400: 'Dữ liệu gửi lên không hợp lệ hoặc phiên làm việc đã hết hạn. Vui lòng tải lại trang.',
    401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    403: 'Bạn không có quyền thực hiện thao tác này.',
    404: 'Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.',
    409: 'Dữ liệu đã thay đổi. Vui lòng tải lại trang và thử lại.',
    429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
    500: 'Máy chủ gặp lỗi. Vui lòng thử lại sau.',
    503: 'Hệ thống tạm thời không khả dụng. Vui lòng thử lại sau.'
  };

  const csrfToken = () =>
    document.querySelector('input[name=__RequestVerificationToken]')?.value;

  const readError = async (res) => {
    let message = defaultMessages[res.status] ||
      (res.status >= 500 ? defaultMessages[500] : `Lỗi yêu cầu (${res.status}).`);
    try {
      const data = await res.json();
      // Hỗ trợ cả { message } của VTT và ProblemDetails mặc định của ASP.NET Core.
      const fromServer = data && (data.message || data.detail || data.title);
      if (fromServer && res.status !== 500) message = fromServer;
    } catch (_) { /* phản hồi không có JSON: dùng thông báo mặc định */ }
    return message;
  };

  const request = async (url, method = 'GET', body = null) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const options = {
      method,
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal
    };

    // Mọi yêu cầu thay đổi dữ liệu (kể cả DELETE không có body) đều gửi token chống CSRF.
    if (method !== 'GET') {
      const csrf = csrfToken();
      if (csrf) options.headers['RequestVerificationToken'] = csrf;
    }
    if (body !== null) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      console.error(`[API] ${method} ${url}:`, err);
      throw new ApiError(err.name === 'AbortError'
        ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
        : 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.');
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401) {
      const back = encodeURIComponent(location.pathname + location.search);
      window.location.href = `/Account/Login?returnUrl=${back}`;
      throw new ApiError(defaultMessages[401], 401);
    }

    if (!res.ok) {
      const message = await readError(res);
      console.error(`[API] ${method} ${url} -> ${res.status}: ${message}`);
      throw new ApiError(message, res.status);
    }

    if (res.status === 204) return null;
    try { return await res.json(); } catch (_) { return null; }
  };

  return {
    ApiError,

    // Boards
    getBoard: (id) => request(`/api/boards/${id}`),
    getArchivedCards: (id) => request(`/api/boards/${id}/archived`),
    createBoard: (title, background, visibility) =>
      request('/api/boards', 'POST', { title, background, visibility }),
    deleteBoard: (id) => request(`/api/boards/${id}`, 'DELETE'),

    // Lists
    createList: (boardId, title) => request('/api/lists', 'POST', { boardId, title }),
    renameList: (id, title) => request(`/api/lists/${id}`, 'PUT', { title }),
    deleteList: (id) => request(`/api/lists/${id}`, 'DELETE'),

    // Cards
    createCard: (listId, title) => request('/api/cards', 'POST', { listId, title }),
    getCard: (id) => request(`/api/cards/${id}`),
    updateCard: (id, payload) => request(`/api/cards/${id}`, 'PUT', payload),
    deleteCard: (id) => request(`/api/cards/${id}`, 'DELETE'),

    // Comments
    addComment: (cardId, content) => request(`/api/cards/${cardId}/comments`, 'POST', { content })
  };
})();
