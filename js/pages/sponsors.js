/**
 * Sponsor raporu — tüm organizasyonların sponsorları, salt okunur.
 *
 * Kural: sponsor ekleme/düzenleme organizasyonun içinde yapılır
 * (#org/:id/sponsors); bu sayfa toplu görünüm ve arama sunar.
 */
import { DB } from '../core/store.js';
import { createTable } from '../components/table.js';
import { navigateTo, paths } from '../core/router.js';
import { formatAmount } from '../core/format.js';
import { html, raw, refreshIcons, emptyState, escapeHtml } from '../core/ui.js';
import { visibleEvents } from '../core/auth.js';
import { SPONSOR_PACKAGES } from './modules/sponsors.js';

const STATUS_BADGES = {
  confirmed: '<span class="badge badge-success">Onaylı</span>',
  pending: '<span class="badge badge-warning">Beklemede</span>',
  cancelled: '<span class="badge badge-danger">İptal</span>',
};

export function renderSponsors(container) {
  const events = visibleEvents();
  const eventNames = new Map(events.map((event) => [event.id, event.name]));

  const rows = DB.sponsors
    .getAll()
    .filter((sponsor) => eventNames.has(sponsor.eventId))
    .map((sponsor) => ({
      ...sponsor,
      eventName: eventNames.get(sponsor.eventId) ?? '-',
      amount: Number(sponsor.amount) || 0,
      status: sponsor.status ?? 'pending',
    }));

  if (rows.length === 0) {
    container.innerHTML = html`
      <div class="page-header"><h1>Sponsor Raporu</h1></div>
      ${raw(emptyState({
        icon: 'award',
        title: 'Henüz sponsor eklenmedi',
        text: 'Bir organizasyon açıp Sponsorlar sekmesinden ekleyin.',
      }))}
    `;
    refreshIcons(container);
    return;
  }

  const confirmed = rows.filter((row) => row.status === 'confirmed');
  const pending = rows.filter((row) => row.status === 'pending');
  const confirmedTotal = confirmed.reduce((sum, row) => sum + row.amount, 0);
  const pendingTotal = pending.reduce((sum, row) => sum + row.amount, 0);

  container.innerHTML = html`
    <div class="page-header">
      <div>
        <h1>Sponsor Raporu</h1>
        <p style="color:var(--slate-500);font-size:0.875rem;margin-top:4px;">
          Tüm organizasyonlardaki sponsorluklar ve sözleşme tutarları
        </p>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:24px;">
      ${raw(kpi('Onaylı Sponsorluk', formatAmount(confirmedTotal), 'var(--success)', `${confirmed.length} sponsor`))}
      ${raw(kpi('Bekleyen', formatAmount(pendingTotal), 'var(--warning)', `${pending.length} sponsor`))}
      ${raw(kpi('Toplam Kayıt', String(rows.length), 'var(--slate-600)', `${eventNames.size} organizasyon`))}
    </div>

    <div class="card"><div id="sponsorReportTable"></div></div>
  `;

  createTable(container.querySelector('#sponsorReportTable'), {
    data: rows,
    searchable: true,
    searchPlaceholder: 'Firma veya organizasyon ara...',
    pageSize: 20,
    onRowClick: (row) => navigateTo(paths.org(row.eventId, 'sponsors')),
    columns: [
      { key: 'companyName', label: 'Firma', render: (v) => `<strong>${escapeHtml(v)}</strong>` },
      {
        key: 'eventName',
        label: 'Organizasyon',
        render: (v) => `<span class="badge badge-info">${escapeHtml(v)}</span>`,
      },
      {
        key: 'packageType',
        label: 'Paket',
        render: (v) => {
          const pkg = SPONSOR_PACKAGES.find((p) => p.id === v) ?? SPONSOR_PACKAGES.at(-1);
          return `<span class="badge" style="background:${pkg.color}15;color:${pkg.color};border:1px solid ${pkg.color}30;">${escapeHtml(pkg.name)}</span>`;
        },
      },
      {
        key: 'amount',
        label: 'Sözleşme Tutarı',
        render: (v) => `<strong style="color:var(--success);">${formatAmount(v)}</strong>`,
      },
      { key: 'standArea', label: 'Stand', render: (v) => (v ? `${escapeHtml(v)} m²` : '-') },
      { key: 'contactPerson', label: 'Yetkili', render: (v) => escapeHtml(v) || '-' },
      { key: 'status', label: 'Durum', render: (v) => STATUS_BADGES[v] ?? '-' },
    ],
    filters: [
      {
        key: 'status',
        label: 'Durum',
        options: [
          { value: '', label: 'Tüm Durumlar' },
          { value: 'confirmed', label: 'Onaylı' },
          { value: 'pending', label: 'Beklemede' },
          { value: 'cancelled', label: 'İptal' },
        ],
      },
      {
        key: 'eventId',
        label: 'Organizasyon',
        options: [
          { value: '', label: 'Tüm Organizasyonlar' },
          ...events.map((event) => ({ value: event.id, label: event.name })),
        ],
      },
    ],
    actions: [
      {
        icon: 'external-link',
        className: 'view',
        title: 'Organizasyonun sponsorlarını aç',
        onClick: (row) => navigateTo(paths.org(row.eventId, 'sponsors')),
      },
    ],
  });

  refreshIcons(container);
}

function kpi(label, value, color, hint) {
  return html`
    <div class="kpi-card" style="border-left:4px solid ${color};">
      <div style="font-size:0.85rem;font-weight:600;color:var(--slate-500);text-transform:uppercase;">${label}</div>
      <div style="font-size:1.8rem;font-weight:800;color:${color};margin-top:8px;">${value}</div>
      <div style="font-size:0.75rem;color:var(--slate-500);margin-top:4px;">${hint}</div>
    </div>
  `;
}
