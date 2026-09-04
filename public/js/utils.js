export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

export function getSearchValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim().toLowerCase() : '';
}

export function filterByQuery(items, query, fields) {
  if (!query) return items;
  return items.filter((item) => fields.some((field) => String(item[field] ?? '').toLowerCase().includes(query)));
}
