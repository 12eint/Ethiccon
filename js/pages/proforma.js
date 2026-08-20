/**
 * Tahsilat raporu — tüm organizasyonların proformaları, salt okunur.
 *
 * Kural: fatura düzenleme organizasyonun içinde yapılır
 * (#org/:id/proforma); bu sayfa "hangi faturalar ödenmedi" sorusuna
 * organizasyondan bağımsız cevap verir.
 */
import { DB } from '../core/store.js';
import { createTable } from '../components/table.js';
import { navigateTo, paths } from '../core/router.js';
import { formatAmount, formatDate } from '../core/format.js';
import { html, raw, refreshIcons, emptyState, escapeHtml } from '../core/ui.js';
import { visibleEvents } from '../core/auth.js';
import { proformaTotals } from '../core/pricing.js';

export function renderProforma(container) {
  const events = visibleEvents();
  const eventNames = new Map(events.map((event) => [event.id, event.name]));

  const rows = DB.proformas
    .getAll()
    .filter((proforma) => eventNames.has(proforma.eventId))
    .map((proforma) => {
      const totals = proformaTotals(proforma);
      return {
        id: proforma.id,
        eventId: proforma.eventId,
        invoiceNo: proforma.invoiceNo,
        eventName: eventNames.get(proforma.eventId) ?? '-',
        companyName: proforma.companyName || resolveLegacyCompany(proforma),
        dueDate: proforma.dueDate,
        ...totals,
        // Filtre için metinsel durum
        durum: totals.balance <= 0.005 ? 'odendi' : (totals.overdue ? 'gecikti' : 'bekliyor'),
      };
    });

  if (rows.length === 0) {
    container.innerHTML = html`
      <div class="page-header"><h1>Tahsilat Raporu</h1></div>
      ${raw(emptyState({
        icon: 'file-text',
        title: 'Henüz proforma oluşturulmadı',
        text: 'Bir organizasyon açıp Proforma sekmesinden fatura oluşturun.',
      }))}
    `;
    refreshIcons(container);
    return;
  }

  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  const overdueCount = rows.filter((row) => row.overdue).length;

  container.innerHTML = html`
    <div class="page-header">
      <div>
        <h1>Tahsilat Raporu</h1>
        <p style="color:var(--slate-500);font-size:0.875rem;margin-top:4px;">
          Tüm organizasyonlardaki proformalar ve ödeme durumları
        </p>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:24px;">
      ${raw(kpi('Kesilen Toplam', formatAmount(sum('total')), 'var(--slate-600)', `${rows.length} fatura`))}
      ${raw(kpi('Tahsil Edilen', formatAmount(sum('paid')), 'var(--success)', 'Alınan ödemeler'))}
      ${raw(kpi('Kalan Alacak', formatAmount(sum('balance')), 'var(--danger)',
                overdueCount > 0 ? `${overdueCount} fatura vadesi geçti` : 'Vadesi geçen yok'))}
    </div>

    <div class="card"><div id="proformaReportTable"></div></div>
  `;

  createTable(container.querySelector('#proformaReportTable'), {
    data: rows,
    searchable: true,
    searchPlaceholder: 'Fatura no, firma veya organizasyon ara...',
    pageSize: 20,
    onRowClick: (row) => navigateTo(paths.org(row.eventId, 'proforma')),
    columns: [
      { key: 'invoiceNo', label: 'Fatura No', render: (v) => `<strong>${escapeHtml(v)}</strong>` },
      { key: 'companyName', label: 'Firma', render: (v) => escapeHtml(v) || '-' },
      {
        key: 'eventName',
        label: 'Organizasyon',
        render: (v) => `<span class="badge badge-info">${escapeHtml(v)}</span>`,
      },
      { key: 'total', label: 'Tutar', render: (v) => formatAmount(v) },
      { key: 'paid', label: 'Alınan', render: (v) => `<span style="color:var(--success);">${formatAmount(v)}</span>` },
      {
        key: 'balance',
        label: 'Kalan',
        render: (v) => (v > 0.005
          ? `<strong style="color:var(--danger);">${formatAmount(v)}</strong>`
          : '<span style="color:var(--slate-400);">-</span>'),
      },
      {
        key: 'dueDate',
        label: 'Vade',
        render: (v, row) => (row.overdue
          ? `<span style="color:var(--danger);font-weight:600;">${formatDate(v)}</span>`
          : formatDate(v)),
      },
      {
        key: 'durum',
        label: 'Durum',
        render: (v) => ({
          odendi: '<span class="badge badge-success">Ödendi</span>',
          gecikti: '<span class="badge badge-danger">Vadesi geçti</span>',
          bekliyor: '<span class="badge badge-warning">Bekliyor</span>',
        })[v] ?? '-',
      },
    ],
    filters: [
      {
        key: 'durum',
        label: 'Durum',
        options: [
          { value: '', label: 'Tüm Durumlar' },
          { value: 'gecikti', label: 'Vadesi Geçenler' },
          { value: 'bekliyor', label: 'Ödeme Bekleyenler' },
          { value: 'odendi', label: 'Ödenenler' },
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
        title: 'Organizasyonun proformalarını aç',
        onClick: (row) => navigateTo(paths.org(row.eventId, 'proforma')),
      },
    ],
  });

  refreshIcons(container);
}

/** companyName alanı sonradan eklendi; eski kayıtlarda firma sponsordan gelir. */
function resolveLegacyCompany(proforma) {
  if (!proforma.sponsorId) return '';
  return DB.sponsors.getById(proforma.sponsorId)?.companyName ?? '';
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
