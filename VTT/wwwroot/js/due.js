/**
 * VTT Due Date Utility - Định dạng và trạng thái ngày hết hạn của thẻ.
 * Trạng thái: done (đã hoàn thành), overdue (quá hạn), soon (trong 24 giờ tới), ok (còn thời gian).
 */
const DueUtil = (() => {
  const pad = (n) => String(n).padStart(2, '0');
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const parse = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const relative = (ms) => {
    if (ms < HOUR) return `${Math.max(1, Math.round(ms / MIN))} phút`;
    if (ms < DAY) return `${Math.round(ms / HOUR)} giờ`;
    return `${Math.round(ms / DAY)} ngày`;
  };

  const shortText = (d, now) => {
    const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (diffDays === 0) return `Hôm nay, ${time}`;
    if (diffDays === 1) return `Ngày mai, ${time}`;
    if (diffDays === -1) return `Hôm qua, ${time}`;
    const date = d.getFullYear() === now.getFullYear()
      ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
      : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return `${date}, ${time}`;
  };

  /** Trả về null nếu không có hạn, ngược lại { state, text, label, full, icon }. */
  const describe = (due, done = false) => {
    const d = parse(due);
    if (!d) return null;
    const now = new Date();
    const diff = d - now;

    let state = 'ok';
    let label;
    if (done) { state = 'done'; label = 'Đã hoàn thành'; }
    else if (diff < 0) { state = 'overdue'; label = `Quá hạn ${relative(-diff)}`; }
    else if (diff <= DAY) { state = 'soon'; label = `Sắp đến hạn - còn ${relative(diff)}`; }
    else { label = `Còn ${relative(diff)}`; }

    const icon = state === 'done' ? '✓' : state === 'overdue' ? '⚠' : '◷';
    return { state, text: shortText(d, now), label, icon, full: d.toLocaleString('vi-VN') };
  };

  /** HTML nhãn hạn hiển thị trên thẻ. Trả về chuỗi rỗng nếu không có hạn. */
  const pillHtml = (due, done = false) => {
    const info = describe(due, done);
    if (!info) return '';
    return `<span class="card-badge-pill due-${info.state} badge-due-date" title="${esc(info.full)} - ${esc(info.label)}">${info.icon} ${esc(info.text)}</span>`;
  };

  /** Giá trị cho <input type="datetime-local"> (giờ địa phương). */
  const toInputValue = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  /** Mốc nhanh: sau N ngày lúc 17:00 (hôm nay mà đã quá 17:00 thì lấy 23:59). */
  const preset = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(17, 0, 0, 0);
    if (offsetDays === 0 && d < new Date()) d.setHours(23, 59, 0, 0);
    return toInputValue(d);
  };

  return { describe, pillHtml, toInputValue, preset };
})();
