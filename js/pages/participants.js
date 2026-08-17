/**
 * Tüm organizasyonlardaki katılımcıların birleşik listesi.
 * Kayıt ekleme/düzenleme organizasyon içinde yapılır; bu ekran
 * arama ve genel görünüm içindir.
 */
import { DB } from '../core/store.js';
import { createTable } from '../components/table.js';
import { navigateTo, paths } from '../core/router.js';
import { html, refreshIcons, emptyState, escapeHtml as escapeCell } from '../core/ui.js';
import { visibleEvents } from '../core/auth.js';

const PERIOD_LABELS = { early: 'Erken Kayıt', late: 'Geç Kayıt', custom: 'Özel Fiyat' };

export function renderParticipants(container) {
  const events = visibleEvents();
  const eventNames = new Map(events.map((event) => [event.id, event.name]));
  const participants = DB.participants
    .getAll()
    .filter((pax) => eventNames.has(pax.eventId));

  container.innerHTML = html`
    <div class="page-header">
      <div>
        <h1>Katılımcı Listesi</h1>
        <p style="color:var(--slate-500);font-size:0.875rem;margin-top:4px;">
          Tüm organizasyonlardaki misafirler. Ekleme ve düzenleme organizasyon sayfasından yapılır.
        </p>
      </div>
    </div>
    <div class="card"><div id="participantsTable"></div></div>
  `;

  const host = container.querySelector('#participantsTable');

  if (participants.length === 0) {
    host.innerHTML = emptyState({
      icon: 'users',
      title: 'Henüz katılımcı yok',
      text: 'Bir organizasyon açıp Kayıt sekmesinden misafir ekleyin.',
    });
    refreshIcons(container);
    return;
  }

  createTable(host, {
    data: participants,
    searchable: true,
    searchPlaceholder: 'İsim, firma veya e-posta ara...',
    pageSize: 15,
    onRowClick: (row) => navigateTo(paths.org(row.eventId, 'registration')),
    columns: [
      {
        key: 'firstName',
        label: 'Ad Soyad',
        render: (_value, row) => `<strong>${escapeCell(`${row.firstName ?? ''} ${row.lastName ?? ''}`)}</strong>`,
      },
      { key: 'company', label: 'Firma', render: (value) => escapeCell(value) || '-' },
      {
        key: 'eventId',
        label: 'Organizasyon',
        render: (value) => `<span class="badge badge-info">${escapeCell(eventNames.get(value) ?? '-')}</span>`,
      },
      { key: 'email', label: 'E-posta', render: (value) => escapeCell(value) || '-' },
      { key: 'phone', label: 'Telefon', render: (value) => escapeCell(value) || '-' },
      {
        key: 'regPeriod',
        label: 'Kayıt Tipi',
        render: (value) => PERIOD_LABELS[value] ?? PERIOD_LABELS.early,
      },
      {
        key: 'accommodation',
        label: 'Konaklama',
        render: (value, row) =>
          value
            ? `<span class="badge badge-success">${escapeCell(row.roomType || 'Var')}</span>`
            : '<span style="color:var(--slate-400);">-</span>',
      },
    ],
    filters: [
      {
        key: 'eventId',
        label: 'Organizasyon',
        options: [
          { value: '', label: 'Tüm Organizasyonlar' },
          ...events.map((event) => ({ value: event.id, label: event.name })),
        ],
      },
      {
        key: 'accommodation',
        label: 'Konaklama',
        options: [
          { value: '', label: 'Tümü' },
          { value: 'true', label: 'Konaklama Var' },
          { value: 'false', label: 'Konaklama Yok' },
        ],
      },
    ],
    actions: [
      {
        icon: 'external-link',
        className: 'view',
        title: 'Organizasyonda aç',
        onClick: (row) => navigateTo(paths.org(row.eventId, 'registration')),
      },
    ],
  });

  refreshIcons(container);
}
