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
 * Bir köke tıklama dinleyicisi bağlar, öncekini kaldırarak.
 *
 * Olay delegasyonunda kök eleman yeniden çizimler arasında yaşamaya devam
 * ediyorsa (kenar çubuğu, seçici içeriği) her çizimde addEventListener
 * çağırmak dinleyicileri biriktirir: iki dinleyici bir tıklamada iki kez
 * çalışır ve toggle işlemleri "hiç çalışmıyor" gibi görünür.
 */
export function bindClick(root, handler) {
  if (!root) return;
  if (root.__boundClick) root.removeEventListener('click', root.__boundClick);
  root.__boundClick = handler;
  root.addEventListener('click', handler);
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

const BAND_STYLES = {
  info: { bg: 'var(--info-light)', border: 'var(--info)', text: '#1e40af', icon: 'info' },
  success: { bg: 'var(--success-light)', border: 'var(--success)', text: '#065f46', icon: 'check-circle' },
  warning: { bg: 'var(--warning-light)', border: 'var(--warning)', text: '#92400e', icon: 'alert-triangle' },
  danger: { bg: 'var(--danger-light)', border: 'var(--danger)', text: '#991b1b', icon: 'alert-circle' },
};

/**
 * Modüllerin üstünde beliren uyarı/bilgi bandı.
 * Daha önce her modül kendi bandını elle kuruyordu; renkler ve iç boşluklar
 * birbirini tutmuyordu.
 *
 * @param {{type?: 'info'|'success'|'warning'|'danger', title?: string,
 *   message: string, icon?: string, action?: {label: string, attrs?: string}}} options
 */
export function alertBand({ type = 'info', title = '', message, icon, action }) {
  const style = BAND_STYLES[type] ?? BAND_STYLES.info;
  return html`
    <div class="alert-band" style="background:${style.bg};border-color:${style.border};color:${style.text};">
      <i data-lucide="${icon ?? style.icon}" class="alert-band-icon"></i>
      <div class="alert-band-body">
        ${title ? raw(html`<strong>${title}</strong>`) : ''}
        <span>${message}</span>
      </div>
      ${action ? raw(`<button class="btn btn-sm btn-secondary alert-band-action" ${action.attrs ?? ''}>${escapeHtml(action.label)}</button>`) : ''}
    </div>
  `;
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
