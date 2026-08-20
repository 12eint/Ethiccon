/**
 * Bütçe raporu — organizasyonlar arası, salt okunur.
 *
 * Kural: düzenleme organizasyonun içinde yapılır (#org/:id/budget),
 * bu sayfa yalnızca toplu görünüm sunar. Daha önce burada da düzenlenebilir
 * bir kokpit vardı; aynı ekrana iki yol olması hangi organizasyonda
 * çalışıldığını belirsizleştiriyordu.
 */
import { DB } from '../core/store.js';
import { createTable } from '../components/table.js';
import { navigateTo, paths } from '../core/router.js';
import { formatAmount } from '../core/format.js';
import { html, raw, refreshIcons, emptyState, escapeHtml } from '../core/ui.js';
import { isAdmin, visibleEvents } from '../core/auth.js';
import { eventFinancials } from '../core/pricing.js';

export function renderBudget(container) {
  const admin = isAdmin();
  const events = visibleEvents();

  if (events.length === 0) {
    container.innerHTML = emptyState({
      icon: 'calculator',
      title: 'Görüntülenecek organizasyon yok',
      text: 'Önce Etkinlikler sayfasından bir organizasyon oluşturun.',
    });
    refreshIcons(container);
    return;
  }

  const rows = events.map((event) => ({
    id: event.id,
    name: event.name,
    ...eventFinancials(event.id),
  }));

  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  const totalRevenue = sum('totalRevenue');
  const totalExpense = sum('expense');
  const totalPending = sum('pendingExpense');
  const net = totalRevenue - totalExpense;

  container.innerHTML = html`
    <div class="page-header">
      <div>
        <h1>Bütçe Raporu</h1>
        <p style="color:var(--slate-500);font-size:0.875rem;margin-top:4px;">
          Tüm organizasyonların finansal özeti. Düzenleme için organizasyona girin.
        </p>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:24px;">
      ${raw(kpi('Toplam Gelir', formatAmount(totalRevenue), 'var(--success)', 'Modül gelirleri + ek gelirler'))}
      ${raw(kpi('Toplam Gider', formatAmount(totalExpense), 'var(--danger)', 'Onaylanmış giderler'))}
      ${raw(kpi(net >= 0 ? 'Net Kâr' : 'Net Zarar',
                `${net >= 0 ? '+' : ''}${formatAmount(net)}`,
                net >= 0 ? 'var(--primary-700)' : 'var(--danger)',
                `${rows.length} organizasyon`))}
    </div>

    ${admin && totalPending > 0 ? raw(html`
      <div style="background:var(--warning-light);border:1px solid var(--warning);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px;font-size:0.9rem;color:#92400e;">
        <i data-lucide="clock" style="width:18px;height:18px;flex-shrink:0;"></i>
        <span>Toplam <strong>${formatAmount(totalPending)}</strong> tutarında saha harcaması onayınızı bekliyor.</span>
      </div>
    `) : ''}

    <div class="card"><div id="budgetReportTable"></div></div>
  `;

  createTable(container.querySelector('#budgetReportTable'), {
    data: rows,
    searchable: true,
    searchPlaceholder: 'Organizasyon ara...',
    pageSize: 15,
    onRowClick: (row) => navigateTo(paths.org(row.id, 'budget')),
    columns: [
      { key: 'name', label: 'Organizasyon', render: (v) => `<strong>${escapeHtml(v)}</strong>` },
      { key: 'modules', label: 'Modül Geliri', render: (v) => formatAmount(v) },
      { key: 'extraIncome', label: 'Ek Gelir', render: (v) => formatAmount(v) },
      { key: 'expense', label: 'Gider', render: (v) => `<span style="color:var(--danger);">${formatAmount(v)}</span>` },
      {
        key: 'pendingExpense',
        label: 'Onay Bekleyen',
        render: (v) => (v > 0
          ? `<span class="badge badge-warning">${formatAmount(v)}</span>`
          : '<span style="color:var(--slate-400);">-</span>'),
      },
      {
        key: 'netProfit',
        label: 'Net',
        render: (v) => `<strong style="color:${v >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatAmount(v)}</strong>`,
      },
    ],
    actions: [
      {
        icon: 'external-link',
        className: 'view',
        title: 'Organizasyonun bütçesini aç',
        onClick: (row) => navigateTo(paths.org(row.id, 'budget')),
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
