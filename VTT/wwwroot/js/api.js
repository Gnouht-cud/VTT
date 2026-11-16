/**
 * VTT API Client - Wrapper kết nối trực tiếp với ASP.NET Core ApiController
 */
const Api = (() => {
  const request = async (url, method = 'GET', body = null) => {
    try {
      const options = {
        method,
        headers: {
          'Accept': 'application/json'
        }
      };

      if (body !== null) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);

      if (!res.ok) {
        let errorMsg = `Lỗi yêu cầu (${res.status})`;
        try {
          const errData = await res.json();
          if (errData && errData.message) errorMsg = errData.message;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      if (res.status === 204) return null;
      return await res.json();
    } catch (err) {
      console.error(`[API Error] ${method} ${url}:`, err);
      throw err;
    }
  };

  return {
    // Boards
    getBoard: (id) => request(`/api/boards/${id}`),
    getArchivedCards: (id) => request(`/api/boards/${id}/archived`),
    createBoard: (title, background) => request('/api/boards', 'POST', { title, background }),

    // Lists
    createList: (boardId, title) => request('/api/lists', 'POST', { boardId, title }),
    renameList: (id, title) => request(`/api/lists/${id}`, 'PUT', { title }),

    // Cards
    createCard: (listId, title) => request('/api/cards', 'POST', { listId, title }),
    getCard: (id) => request(`/api/cards/${id}`),
    updateCard: (id, payload) => request(`/api/cards/${id}`, 'PUT', payload),

    // Comments
    addComment: (cardId, content) => request(`/api/cards/${cardId}/comments`, 'POST', { content })
  };
})();
