/**
 * Organizasyon seçici kabuğu.
 *
 * Bütçe, Sponsor ve Proforma sayfaları aynı deseni paylaşıyor: üstte
 * organizasyon seçimi, altında o organizasyona ait modül. Seçim
 * sessionStorage'da tutulur, böylece sayfalar arası gezinirken sıfırlanmaz.
 */
import { visibleEvents } from '../core/auth.js';
import { html, raw, refreshIcons, initSearchableSelects, emptyState } from '../core/ui.js';

/**
 * @param {HTMLElement} container
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   storageKey: string,
 *   render: (host: HTMLElement, eventId: string, reload: () => void) => void
 * }} options
 */
export function renderEventPicker(container, { title, subtitle = '', storageKey, render }) {
  const events = visibleEvents();

  if (events.length === 0) {
    container.innerHTML = emptyState({
      icon: 'calendar-plus',
      title: 'Görüntülenecek organizasyon yok',
      text: 'Önce Etkinlikler sayfasından bir organizasyon oluşturun.',
    });
    refreshIcons(container);
    return;
  }

  const memoryKey = `ethiccon_picker_${storageKey}`;
  const remembered = sessionStorage.getItem(memoryKey);
  let selectedId = events.some((e) => e.id === remembered) ? remembered : events[0].id;

  container.innerHTML = html`
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:24px;">
      <div>
        <h2 style="font-size:1.5rem;font-weight:700;color:var(--slate-900);">${title}</h2>
        ${subtitle ? raw(html`<p style="color:var(--slate-500);font-size:0.875rem;">${subtitle}</p>`) : ''}
      </div>
      <select class="form-select searchable-select" id="eventPicker" style="width:320px;font-weight:600;">
        ${events.map((event) => raw(html`
          <option value="${event.id}" ${event.id === selectedId ? raw('selected') : ''}>${event.name}</option>
        `))}
      </select>
    </div>
    <div id="pickerContent"></div>
  `;

  const host = container.querySelector('#pickerContent');
  const reload = () => render(host, selectedId, reload);

  container.querySelector('#eventPicker').addEventListener('change', (event) => {
    selectedId = event.target.value;
    sessionStorage.setItem(memoryKey, selectedId);
    reload();
  });

  initSearchableSelects(container);
  reload();
  refreshIcons(container);
}
