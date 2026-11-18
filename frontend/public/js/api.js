/**
 * VTT API Client Helper
 */
const Api = (() => {
  const request = async (url, options = {}) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const res = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    });

    if (res.status === 409) {
      // Conflict detected!
      const conflictData = await res.json();
      const err = new Error(conflictData.message || 'Xung đột dữ liệu');
      err.isConflict = true;
      err.conflictData = conflictData;
      throw err;
    }

    if (!res.ok) {
      let msg = 'Yêu cầu không thành công';
      try {
        const body = await res.json();
        if (body.error) msg = body.error;
        if (body.message) msg = body.message;
      } catch (e) {}
      throw new Error(msg);
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    return null;
  };

  return {
    getBoard: (id) => request(`/api/boards/${id}`),
    createBoard: (data) => request('/api/boards', { method: 'POST', body: JSON.stringify(data) }),
    createList: (data) => request('/api/lists', { method: 'POST', body: JSON.stringify(data) }),
    renameList: (id, data) => request(`/api/lists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    
    getCard: (id) => request(`/api/cards/${id}`),
    createCard: (data) => request('/api/cards', { method: 'POST', body: JSON.stringify(data) }),
    updateCard: (id, data) => request(`/api/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCard: (id) => request(`/api/cards/${id}`, { method: 'DELETE' }),
    
    addComment: (cardId, content) => request(`/api/cards/${cardId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    getActivities: (cardId) => request(`/api/cards/${cardId}/activities`),
    
    getNotifications: () => request('/api/notifications'),
    markNotificationRead: (id) => request(`/api/notifications/${id}/read`, { method: 'POST' }),
    markAllNotificationsRead: () => request('/api/notifications/read-all', { method: 'POST' }),
    
    getChatMessages: () => request('/api/chat/messages'),
    sendChatMessage: (content, boardId) => request('/api/chat/messages', { method: 'POST', body: JSON.stringify({ content, boardId }) }),
    
    syncBoard: (boardId) => request(`/api/sync/${boardId}`)
  };
})();
