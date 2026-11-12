(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (url, method = 'GET', body) => {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(r.status);
    return r.status === 204 ? null : r.json();
  };
  const GRADS = ['linear-gradient(135deg,#0c66e4,#8f7ee7)', 'linear-gradient(135deg,#1f845a,#4bce97)', 'linear-gradient(135deg,#c25100,#f38a3f)', 'linear-gradient(135deg,#ae4787,#e774bb)', 'linear-gradient(135deg,#206a83,#6cc3e0)'];

  // Trang chủ: tạo bảng mới
  const nb = $('[data-create-board]');
  if (nb) nb.onclick = () => {
    if ($('input', nb)) return;
    nb.innerHTML = '<input placeholder="Tiêu đề bảng" maxlength="100" aria-label="Tiêu đề bảng">';
    const i = $('input', nb);
    i.focus();
    i.onblur = () => (nb.textContent = 'Tạo bảng mới');
    i.onkeydown = async e => {
      if (e.key === 'Escape') i.blur();
      if (e.key === 'Enter' && i.value.trim()) {
        const b = await api('/api/boards', 'POST', { title: i.value.trim(), background: GRADS[Math.floor(Math.random() * GRADS.length)] });
        location.href = '/Boards/Details/' + b.id;
      }
    };
  };

  const root = $('#lists');
  if (!root) return;
  const boardId = +$('.board').dataset.boardId;
  const fmt = v => new Date(v).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });

  const cardHtml = c => {
    const b = [];
    if (c.dueDate) b.push(`<span>◷ ${fmt(c.dueDate)}</span>`);
    if (c.hasDesc) b.push('<span title="Có mô tả">≡</span>');
    if (c.comments) b.push(`<span>💬 ${c.comments}</span>`);
    return `<div class="card" draggable="true" data-id="${c.id}" data-pos="${c.position ?? 0}"><div class="t">${esc(c.title)}</div>${b.length ? `<div class="badges">${b.join('')}</div>` : ''}</div>`;
  };
  const listHtml = l => `<section class="list" data-id="${l.id}">
    <input class="list-title" value="${esc(l.title)}" aria-label="Tên danh sách">
    <div class="cards">${l.cards.map(cardHtml).join('')}</div>
    <div class="composer" hidden><textarea placeholder="Nhập tiêu đề cho thẻ này..."></textarea>
      <div class="row"><button class="btn primary add">Thêm thẻ</button><button class="x cancel" aria-label="Đóng">✕</button></div></div>
    <button class="add-card">+ Thêm thẻ</button></section>`;
  const addListHtml = `<div class="add-list"><button class="open">+ Thêm danh sách khác</button>
    <form hidden><input placeholder="Nhập tên danh sách..." maxlength="100"><div class="row"><button class="btn primary">Thêm danh sách</button><button type="button" class="x cancel" aria-label="Đóng">✕</button></div></form></div>`;

  api('/api/boards/' + boardId).then(b => {
    root.innerHTML = b.lists.map(l => listHtml({ ...l, cards: l.cards })).join('') + addListHtml;
  });

  const submitCard = async list => {
    const ta = $('textarea', list), title = ta.value.trim();
    if (!title) return;
    const c = await api('/api/cards', 'POST', { listId: +list.dataset.id, title });
    $('.cards', list).insertAdjacentHTML('beforeend', cardHtml(c));
    ta.value = '';
    ta.focus();
  };
  const closeComposer = list => { $('.composer', list).hidden = true; $('.add-card', list).hidden = false; };

  root.addEventListener('click', e => {
    const t = e.target, list = t.closest('.list');
    if (t.closest('.add-card')) {
      $('.composer', list).hidden = false;
      t.closest('.add-card').hidden = true;
      $('textarea', list).focus();
    } else if (t.matches('.composer .cancel')) closeComposer(list);
    else if (t.matches('.composer .add')) submitCard(list);
    else if (t.closest('.card')) openCard(+t.closest('.card').dataset.id);
    else if (t.matches('.add-list .open')) {
      t.hidden = true;
      const f = $('.add-list form');
      f.hidden = false;
      $('input', f).focus();
    } else if (t.matches('.add-list .cancel')) {
      $('.add-list form').hidden = true;
      $('.add-list .open').hidden = false;
    }
  });
  root.addEventListener('keydown', e => {
    if (e.target.matches('.composer textarea') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitCard(e.target.closest('.list')); }
    if (e.target.matches('.composer textarea') && e.key === 'Escape') closeComposer(e.target.closest('.list'));
    if (e.target.matches('.list-title') && e.key === 'Enter') e.target.blur();
  });
  root.addEventListener('change', e => {
    if (e.target.matches('.list-title') && e.target.value.trim())
      api('/api/lists/' + e.target.closest('.list').dataset.id, 'PUT', { title: e.target.value.trim() });
  });
  root.addEventListener('submit', async e => {
    e.preventDefault();
    const i = $('input', e.target), title = i.value.trim();
    if (!title) return;
    const l = await api('/api/lists', 'POST', { boardId, title });
    $('.add-list', root).insertAdjacentHTML('beforebegin', listHtml(l));
    i.value = '';
    i.focus();
  });

  // Kéo thả thẻ
  let drag = null;
  root.addEventListener('dragstart', e => {
    const c = e.target.closest?.('.card');
    if (!c) return;
    drag = c;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => c.classList.add('dragging'));
  });
  root.addEventListener('dragover', e => {
    if (!drag) return;
    const box = e.target.closest('.cards') || e.target.closest('.list')?.querySelector('.cards');
    if (!box) return;
    e.preventDefault();
    const after = [...box.querySelectorAll('.card:not(.dragging)')].find(c => {
      const r = c.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    box.insertBefore(drag, after || null);
  });
  root.addEventListener('dragend', async () => {
    if (!drag) return;
    const c = drag; drag = null;
    c.classList.remove('dragging');
    const p = c.previousElementSibling, n = c.nextElementSibling;
    const pp = p ? +p.dataset.pos : null, np = n ? +n.dataset.pos : null;
    const pos = pp !== null && np !== null ? (pp + np) / 2 : pp !== null ? pp + 1024 : np !== null ? np / 2 : 1024;
    c.dataset.pos = pos;
    await api('/api/cards/' + c.dataset.id, 'PUT', { listId: +c.closest('.list').dataset.id, position: pos });
  });

  // Mặt sau của thẻ
  const cmHtml = m => `<div class="cm"><b>${esc(m.user)}</b> <small>${esc(m.createdAt)}</small>${esc(m.content)}</div>`;
  async function openCard(id) {
    const c = await api('/api/cards/' + id);
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <button class="x close" aria-label="Đóng">✕</button>
      <textarea class="m-title" rows="1">${esc(c.title)}</textarea>
      <p class="sub">trong danh sách <b>${esc(c.listTitle)}</b></p>
      <div class="modal-body"><div>
        <h3>Mô tả</h3><textarea class="m-desc" rows="4" placeholder="Thêm mô tả chi tiết hơn...">${esc(c.description)}</textarea>
        <h3>Hoạt động</h3>
        <textarea class="m-cm" rows="2" placeholder="Viết bình luận..."></textarea>
        <div class="row"><button class="btn primary m-cm-add">Lưu</button></div>
        <div class="cms">${c.comments.map(cmHtml).join('')}</div></div>
        <aside><h4>Ngày hết hạn</h4><input type="datetime-local" class="m-due" value="${c.due || ''}">
        <h4>Thao tác</h4><button class="side-btn m-arch">Lưu trữ</button></aside></div></div>`;
    document.body.appendChild(ov);
    const card = $(`.card[data-id="${id}"]`, root), q = s => $(s, ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    ov.onclick = e => { if (e.target === ov || e.target.matches('.close')) close(); };
    q('.m-title').onchange = e => {
      const v = e.target.value.trim();
      if (!v) return;
      $('.t', card).textContent = v;
      api('/api/cards/' + id, 'PUT', { title: v });
    };
    q('.m-desc').onchange = e => api('/api/cards/' + id, 'PUT', { description: e.target.value });
    q('.m-due').onchange = e => api('/api/cards/' + id, 'PUT', { due: e.target.value });
    q('.m-cm-add').onclick = async () => {
      const t = q('.m-cm');
      if (!t.value.trim()) return;
      const m = await api(`/api/cards/${id}/comments`, 'POST', { content: t.value.trim() });
      q('.cms').insertAdjacentHTML('afterbegin', cmHtml(m));
      t.value = '';
    };
    q('.m-arch').onclick = async () => {
      await api('/api/cards/' + id, 'PUT', { archive: true });
      card.remove();
      close();
    };
  }
})();
