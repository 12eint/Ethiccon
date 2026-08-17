/**
 * Ortak UI yardımcıları: kaçışlama, toast, ikon yenileme.
 * showToast daha önce üç sayfada kopyalanmış, çoğu modülde de elle
 * div oluşturularak taklit edilmişti.
 */

/** HTML'e gömülecek her kullanıcı verisi buradan geçmeli. */
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Otomatik kaçışlayan template literal.
 *   html`<td>${pax.firstName}</td>`
 * Kaçışlanmasını istemediğin alt parçaları (kendisi html`` ile üretilmiş
 * HTML gibi) raw() ile sar. Dizi verilirse elemanları birleştirilir.
 */
export function html(strings, ...values) {
  return strings.reduce((out, chunk, i) => {
    if (i === 0) return chunk;
    return out + interpolate(values[i - 1]) + chunk;
  }, '');
}

function interpolate(value) {
  if (value == null || value === false) return '';
  if (Array.isArray(value)) return value.map(interpolate).join('');
  if (value && value.__raw) return value.value;
  return escapeHtml(value);
}

/** html`` içinde kaçışlanmadan basılacak, güvenilir HTML parçası. */
export function raw(value) {
  return { __raw: true, value: value == null ? '' : String(value) };
}

const TOAST_ICONS = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info',
};

/** @param {'success'|'error'|'warning'|'info'} type */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = html`<i data-lucide="${TOAST_ICONS[type] ?? 'info'}"></i> ${message}`;
  container.appendChild(toast);
  refreshIcons(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/** Lucide ikonlarını yeniler; kapsam verilirse yalnızca o düğümü işler. */
export function refreshIcons(scope) {
  if (typeof lucide === 'undefined' || !lucide.createIcons) return;
  if (scope) lucide.createIcons({ nodes: [scope] });
  else lucide.createIcons();
}

/**
 * Tom Select'i .searchable-select alanlarına bağlar.
 * Zaten bağlanmış alanları atlar, böylece kısmi yeniden çizimlerde
 * ikinci bir kopya oluşmaz.
 */
export function initSearchableSelects(scope = document) {
  if (typeof TomSelect === 'undefined') return;
  scope.querySelectorAll('.searchable-select').forEach((el) => {
    if (el.tomselect) return;
    new TomSelect(el, { create: false, sortField: { field: 'text', direction: 'asc' } });
  });
}

/** Boş liste durumu için ortak blok. */
export function emptyState({ icon = 'inbox', title, text = '' }) {
  return html`
    <div class="empty-state">
      <div class="empty-state-icon"><i data-lucide="${icon}"></i></div>
      <h3 class="empty-state-title">${title}</h3>
      ${text ? raw(html`<p class="empty-state-text">${text}</p>`) : ''}
    </div>
  `;
}
