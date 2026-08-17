/**
 * Bütçe / finansal kokpit — tek organizasyon kapsamında.
 * Hem #org/:id/budget sekmesi hem de Bütçe sayfası bunu kullanır.
 */
import { DB } from '../../core/store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { createDoughnutChart, destroyCharts } from '../../components/charts.js';
import { formatAmount, formatShortDate, toAscii } from '../../core/format.js';
import { html, raw, showToast, refreshIcons, bindClick } from '../../core/ui.js';
import { getCurrentUser, isAdmin } from '../../core/auth.js';
import { eventFinancials } from '../../core/pricing.js';

export const INCOME_CATEGORIES = ['Sponsorluk', 'Kayıt Geliri', 'Konaklama Geliri', 'Diğer Gelir'];

export const EXPENSE_CATEGORIES = [
  'Salon Kirası',
  'Teknik & Prodüksiyon',
  'Matbaa & Baskı',
  'Transfer & Operasyon',
  'Saha Gideri (Taksi, Yemek vs.)',
  'Otel Gideri',
  'Uçak Gideri',
  'Diğer',
];

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#ec4899', '#14b8a6'];

/**
 * Haftalık bütçe kilidi: her Cuma 16:00'da devreye girer ve yönetici
 * onaylayana kadar saha personeli harcama giremez.
 * @returns {boolean} kilit aktif mi
 */
export function isBudgetLocked(event) {
  if (!event) return false;

  const now = new Date();
  const lockPoint = new Date(now);
  const day = now.getDay(); // 0=Paz … 5=Cum

  let daysSinceFriday = (day + 7 - 5) % 7;
  // Cuma günü henüz 16:00 olmadıysa geçerli kilit bir önceki haftanınki.
  if (day === 5 && now.getHours() < 16) daysSinceFriday = 7;

  lockPoint.setDate(now.getDate() - daysSinceFriday);
  lockPoint.setHours(16, 0, 0, 0);

  const approvedAt = event.budgetLastApprovedAt ? new Date(event.budgetLastApprovedAt) : new Date(0);
  return approvedAt < lockPoint;
}

export function renderBudgetModule(container, eventId, onChange) {
  const refresh = () => (onChange ? onChange() : renderBudgetModule(container, eventId));

  const admin = isAdmin();
  const currentUser = getCurrentUser();
  const event = DB.events.getById(eventId) ?? {};
  const rows = DB.budgets.getByEventId(eventId);
  const finance = eventFinancials(eventId);
  const limits = event.budgetLimits ?? {};
  const locked = isBudgetLocked(event);

  destroyCharts();

  const plannedTotal = EXPENSE_CATEGORIES.reduce((sum, cat) => sum + (Number(limits[cat]) || 0), 0);
  const usagePercent = plannedTotal > 0
    ? Math.min(100, Math.round((finance.expense / plannedTotal) * 100))
    : (finance.expense > 0 ? 100 : 0);
  const pending = rows.filter((r) => r.status === 'pending' && r.type === 'expense');

  container.innerHTML = html`
    ${locked ? raw(lockBanner(admin)) : ''}
    ${admin ? raw(adminSummary(finance)) : raw(managerSummary(finance, plannedTotal, usagePercent))}
    ${admin && pending.length > 0 ? raw(pendingTable(pending)) : ''}
    ${raw(limitCards(limits, finance.categoryExpenses, admin))}
    ${raw(transactionsTable(rows, admin, locked))}
  `;

  // ── Grafik ──
  if (admin && finance.expense > 0) {
    const entries = Object.entries(finance.categoryExpenses).filter(([, value]) => value > 0);
    requestAnimationFrame(() => {
      createDoughnutChart('expenseDoughnutChart', {
        labels: entries.map(([label]) => label),
        data: entries.map(([, value]) => value),
        colors: CHART_COLORS,
      });
    });
  }

  // ── Olaylar ──
  bindClick(container, (clickEvent) => {
    const target = clickEvent.target;

    if (target.closest('[data-action="unlock"]')) {
      DB.events.update(eventId, { budgetLastApprovedAt: new Date().toISOString() });
      DB.logs.add(`${event.name} bütçesi haftalık onaydan geçirildi.`, 'success');
      showToast('Bütçe kilidi açıldı ve haftalık onay verildi.');
      refresh();
      return;
    }

    if (target.closest('[data-action="limits"]')) {
      openLimitsModal(eventId, limits, refresh);
      return;
    }

    if (target.closest('[data-action="add"]')) {
      openEntryModal({ eventId, admin, currentUser, onDone: refresh });
      return;
    }

    if (target.closest('[data-action="pdf"]')) {
      exportBudgetPdf(event, rows, finance);
      return;
    }

    const approveId = target.closest('[data-approve]')?.dataset.approve;
    if (approveId) {
      DB.budgets.update(approveId, { status: 'approved' });
      showToast('Masraf onaylandı.');
      refresh();
      return;
    }

    const rejectId = target.closest('[data-reject]')?.dataset.reject;
    if (rejectId) {
      if (!window.confirm('Bu masrafı reddetmek istediğinize emin misiniz?')) return;
      DB.budgets.update(rejectId, { status: 'rejected' });
      showToast('Masraf reddedildi.', 'warning');
      refresh();
      return;
    }

    const resubmitId = target.closest('[data-resubmit]')?.dataset.resubmit;
    if (resubmitId) {
      openEntryModal({
        eventId,
        admin,
        currentUser,
        existing: DB.budgets.getById(resubmitId),
        onDone: refresh,
      });
      return;
    }

    const deleteId = target.closest('[data-delete]')?.dataset.delete;
    if (!deleteId) return;

    const row = DB.budgets.getById(deleteId);
    if (row?.sourceType === 'sponsor') {
      showToast('Bu satır sponsor kaydından üretilmiştir; sponsoru silerek kaldırın.', 'error');
      return;
    }
    if (!window.confirm('Bu bütçe kalemini silmek istediğinize emin misiniz?')) return;
    DB.budgets.delete(deleteId);
    DB.logs.add(`Bütçe kalemi silindi: ${row?.description ?? '-'}`, 'warning');
    showToast('Bütçe kalemi silindi.');
    refresh();
  });

  refreshIcons(container);
}

// ── Parçalar ─────────────────────────────────────────────────────────────

function lockBanner(admin) {
  return html`
    <div style="background:var(--danger-light);color:var(--danger);padding:16px;border-radius:var(--radius-md);border:1px solid rgba(239,68,68,0.2);margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:12px;">
        <i data-lucide="lock" style="width:24px;height:24px;"></i>
        <div>
          <h4 style="margin:0;font-size:1rem;font-weight:700;">Haftalık Bütçe Kilitli</h4>
          <p style="margin:4px 0 0;font-size:0.85rem;opacity:0.9;">
            ${admin
              ? 'Cuma 16:00 kilidi devrede. Sorumluların işlem yapabilmesi için bütçeyi onaylayın.'
              : 'Cuma 16:00 itibarıyla bütçe yönetici onayına kadar dondurulmuştur.'}
          </p>
        </div>
      </div>
      ${admin ? raw(html`
        <button class="btn btn-primary" data-action="unlock" style="background:var(--danger);box-shadow:none;">
          <i data-lucide="unlock" style="width:16px;"></i> Bütçeyi Onayla ve Kilidi Aç
        </button>
      `) : ''}
    </div>
  `;
}

function adminSummary(finance) {
  const profitColor = finance.netProfit >= 0 ? 'var(--primary-700)' : 'var(--danger)';
  return html`
    <div class="kpi-grid" style="margin-bottom:24px;">
      ${raw(kpiCard('Toplam Gelir', formatAmount(finance.totalRevenue), 'var(--success)', 'Kayıt, konaklama, uçak, sponsorluk'))}
      ${raw(kpiCard('Toplam Gider', formatAmount(finance.expense), 'var(--danger)', 'Onaylanmış tüm kategoriler'))}
      ${raw(kpiCard(
        finance.netProfit >= 0 ? 'Net Kâr' : 'Net Zarar',
        `${finance.netProfit >= 0 ? '+' : ''}${formatAmount(finance.netProfit)}`,
        profitColor,
        'Gerçekleşen net durum',
      ))}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-bottom:24px;">
      <div class="card" style="padding:24px;">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;color:var(--slate-800);">Modül Satış Gelirleri</h3>
        ${raw(moduleRow('Kayıt (Misafir)', finance.registration))}
        ${raw(moduleRow('Konaklama (net marj)', finance.accommodation))}
        ${raw(moduleRow('Uçak Bileti (net marj)', finance.flight))}
        <div style="display:flex;justify-content:space-between;padding:12px 8px;margin-top:8px;background:var(--slate-50);border-radius:var(--radius-md);">
          <span style="font-weight:700;color:var(--slate-700);">TOPLAM MODÜL GELİRİ</span>
          <span style="font-weight:800;color:var(--success);">${formatAmount(finance.modules)}</span>
        </div>
      </div>

      <div class="card" style="padding:24px;">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;color:var(--slate-800);">Gider Kategori Dağılımı</h3>
        <div style="height:200px;position:relative;">
          ${finance.expense > 0
            ? raw('<canvas id="expenseDoughnutChart"></canvas>')
            : raw('<div style="display:flex;height:100%;align-items:center;justify-content:center;color:var(--slate-400);">Gider bulunmuyor</div>')}
        </div>
      </div>
    </div>
  `;
}

function kpiCard(label, value, color, hint) {
  return html`
    <div class="kpi-card" style="border-left:4px solid ${color};">
      <div style="font-size:0.85rem;font-weight:600;color:var(--slate-500);text-transform:uppercase;">${label}</div>
      <div style="font-size:1.8rem;font-weight:800;color:${color};margin-top:8px;">${value}</div>
      <div style="font-size:0.75rem;color:var(--slate-500);margin-top:4px;">${hint}</div>
    </div>
  `;
}

function moduleRow(label, value) {
  return html`
    <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--slate-100);">
      <span style="font-weight:500;color:var(--slate-600);">${label}</span>
      <span style="font-weight:700;color:${value < 0 ? 'var(--danger)' : 'var(--slate-800)'};">${formatAmount(value)}</span>
    </div>
  `;
}

function managerSummary(finance, plannedTotal, usagePercent) {
  const remaining = plannedTotal - finance.expense;
  const barColor = usagePercent >= 100 ? 'var(--danger)' : usagePercent > 80 ? 'var(--warning)' : 'var(--success)';
  return html`
    <div class="kpi-grid" style="margin-bottom:32px;">
      ${raw(kpiCard('Toplam Gider Limiti', formatAmount(plannedTotal), 'var(--slate-500)', 'Yönetici tarafından belirlendi'))}
      ${raw(kpiCard('Gerçekleşen Harcama', formatAmount(finance.expense), 'var(--primary-600)', 'Onaylanmış masraflar'))}
      <div class="kpi-card" style="border-left:4px solid ${barColor};">
        <div style="font-size:0.85rem;font-weight:600;color:var(--slate-500);text-transform:uppercase;">Kalan Bütçe</div>
        <div style="font-size:1.8rem;font-weight:800;color:${barColor};margin-top:8px;">${formatAmount(remaining)}</div>
        <div style="margin-top:12px;height:6px;background:var(--slate-100);border-radius:var(--radius-full);overflow:hidden;">
          <div style="height:100%;width:${usagePercent}%;background:${barColor};transition:width 0.5s ease;"></div>
        </div>
        ${finance.pendingExpense > 0 ? raw(html`
          <div style="font-size:0.75rem;color:var(--warning);margin-top:8px;">
            <i data-lucide="clock" style="width:12px;"></i> Onay bekleyen: ${formatAmount(finance.pendingExpense)}
          </div>
        `) : ''}
      </div>
    </div>
  `;
}

function pendingTable(pending) {
  return html`
    <div class="card" style="margin-bottom:24px;border:1px solid var(--warning);">
      <div class="card-header" style="background:var(--warning-light);padding:16px 24px;">
        <h3 class="card-title" style="color:#92400e;display:flex;align-items:center;gap:8px;">
          <i data-lucide="clock" style="width:18px;"></i> Onay Bekleyen Saha Harcamaları
        </h3>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr><th>Kategori</th><th>Açıklama</th><th>Tarih</th><th>Tutar</th><th>Ekleyen</th><th style="text-align:right;">İşlem</th></tr>
          </thead>
          <tbody>
            ${pending.map((row) => raw(html`
              <tr>
                <td><strong>${row.category}</strong></td>
                <td>${row.description || '-'}</td>
                <td>${formatShortDate(row.createdAt)}</td>
                <td style="font-weight:700;color:var(--warning);">${formatAmount(row.amount)}</td>
                <td style="font-size:0.8rem;">${row.createdBy || '-'}</td>
                <td style="text-align:right;">
                  <div class="action-btns" style="justify-content:flex-end;">
                    <button class="action-btn" data-approve="${row.id}" title="Onayla" style="color:var(--success);"><i data-lucide="check"></i></button>
                    <button class="action-btn delete" data-reject="${row.id}" title="Reddet"><i data-lucide="x"></i></button>
                  </div>
                </td>
              </tr>
            `))}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function limitCards(limits, spentByCategory, admin) {
  const visible = admin
    ? EXPENSE_CATEGORIES
    : EXPENSE_CATEGORIES.filter((cat) => (Number(limits[cat]) || 0) > 0 || (spentByCategory[cat] ?? 0) > 0);

  if (visible.length === 0) return '';

  return html`
    <div class="card" style="margin-bottom:24px;padding:24px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--slate-800);">Planlanan vs Gerçekleşen</h3>
          <p style="font-size:0.85rem;color:var(--slate-500);">Kategori limitleri ve harcama durumu.</p>
        </div>
        ${admin ? raw('<button class="btn btn-secondary btn-sm" data-action="limits"><i data-lucide="sliders" style="width:14px;"></i> Limitleri Düzenle</button>') : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;">
        ${visible.map((cat) => {
          const limit = Number(limits[cat]) || 0;
          const spent = spentByCategory[cat] ?? 0;
          const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : (spent > 0 ? 100 : 0);
          const color = percent >= 100 ? 'var(--danger)' : percent > 80 ? 'var(--warning)' : 'var(--primary-500)';
          return raw(html`
            <div style="background:var(--slate-50);padding:12px;border-radius:var(--radius-md);border:1px solid var(--slate-100);">
              <div style="display:flex;justify-content:space-between;font-size:0.85rem;font-weight:600;margin-bottom:8px;">
                <span style="color:var(--slate-700);">${cat}</span>
                <span style="color:var(--slate-900);">${formatAmount(spent)} / ${limit > 0 ? formatAmount(limit) : 'Limit Yok'}</span>
              </div>
              <div style="height:6px;background:var(--slate-200);border-radius:var(--radius-full);overflow:hidden;">
                <div style="height:100%;width:${percent}%;background:${color};transition:width 0.5s ease;"></div>
              </div>
            </div>
          `);
        })}
      </div>
    </div>
  `;
}

const STATUS_BADGES = {
  approved: '<span class="badge badge-success">Onaylandı</span>',
  pending: '<span class="badge badge-warning">Bekliyor</span>',
  rejected: '<span class="badge badge-danger">Reddedildi</span>',
};

function transactionsTable(rows, admin, locked) {
  const visible = admin ? rows : rows.filter((r) => r.type === 'expense');

  return html`
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <h3 class="card-title">${admin ? 'Tüm İşlemler (Gelir / Gider)' : 'Saha Harcamalarım'}</h3>
        <div style="display:flex;gap:8px;">
          ${admin ? raw('<button class="btn btn-secondary btn-sm" data-action="pdf"><i data-lucide="file-down" style="width:14px;"></i> PDF Raporu</button>') : ''}
          ${(!locked || admin) ? raw(html`
            <button class="btn btn-primary btn-sm" data-action="add">
              <i data-lucide="plus" style="width:14px;"></i> ${admin ? 'Yeni İşlem' : 'Fiş / Masraf Ekle'}
            </button>
          `) : ''}
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Durum</th><th>Tür</th><th>Kategori</th><th>Açıklama</th>
              <th>Tarih</th><th>Tutar</th><th>İşlemi Yapan</th><th style="text-align:right;">İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${visible.length === 0
              ? raw('<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--slate-400);">Henüz kayıt bulunmuyor.</td></tr>')
              : visible.map((row) => {
                  const status = row.status ?? 'approved';
                  const isIncome = row.type === 'income';
                  return raw(html`
                    <tr style="opacity:${status === 'rejected' ? '0.6' : '1'};">
                      <td>${raw(STATUS_BADGES[status] ?? '')}</td>
                      <td><span class="badge ${isIncome ? 'badge-success' : 'badge-gray'}">${isIncome ? 'Gelir' : 'Gider'}</span></td>
                      <td><strong>${row.category}</strong></td>
                      <td>${row.description || '-'}</td>
                      <td>${formatShortDate(row.createdAt)}</td>
                      <td style="font-weight:700;color:${isIncome ? 'var(--success)' : 'var(--slate-800)'};text-decoration:${status === 'rejected' ? 'line-through' : 'none'};">
                        ${isIncome ? '+' : '-'}${formatAmount(row.amount)}
                      </td>
                      <td style="font-size:0.8rem;color:var(--slate-500);">${row.createdBy || '-'}</td>
                      <td style="text-align:right;">
                        <div class="action-btns" style="justify-content:flex-end;">
                          ${(!admin && status === 'rejected' && !locked) ? raw(html`
                            <button class="action-btn edit" data-resubmit="${row.id}" title="Düzelt ve tekrar gönder"><i data-lucide="refresh-cw"></i></button>
                          `) : ''}
                          ${(!locked || admin) ? raw(html`
                            <button class="action-btn delete" data-delete="${row.id}" title="Sil"><i data-lucide="trash-2"></i></button>
                          `) : ''}
                        </div>
                      </td>
                    </tr>
                  `);
                })}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Modaller ─────────────────────────────────────────────────────────────

function openLimitsModal(eventId, limits, onDone) {
  openModal({
    title: 'Bütçe Limitlerini Düzenle',
    content: html`
      <p style="margin-bottom:16px;font-size:0.85rem;color:var(--slate-500);">
        Kategoriler için planlanan üst sınırları belirleyin. 0 girilen kategoriler "Limit Yok" sayılır.
      </p>
      <form id="limitForm" style="max-height:400px;overflow-y:auto;padding-right:8px;">
        ${EXPENSE_CATEGORIES.map((cat) => raw(html`
          <div class="form-group" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--slate-100);padding-bottom:12px;margin-bottom:12px;">
            <label class="form-label" style="margin:0;font-size:0.9rem;">${cat}</label>
            <input type="number" class="form-input" style="width:150px;" data-category="${cat}" value="${Number(limits[cat]) || 0}" min="0">
          </div>
        `))}
      </form>
    `,
    onSave: () => {
      const next = {};
      document.querySelectorAll('#limitForm input[data-category]').forEach((input) => {
        next[input.dataset.category] = Number(input.value) || 0;
      });
      DB.events.update(eventId, { budgetLimits: next });
      closeModal();
      showToast('Limitler güncellendi.');
      onDone();
    },
  });
}

/**
 * Gelir/gider ekleme ve reddedilen masrafı düzeltip tekrar gönderme.
 * Önceki sürümde bu formun kaydetme adımı tanımsız değişkenlere
 * (type/category/description) başvurduğu için hiç çalışmıyordu.
 */
function openEntryModal({ eventId, admin, currentUser, existing = null, onDone }) {
  const isResubmit = Boolean(existing);
  const categories = admin ? [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] : EXPENSE_CATEGORIES;

  openModal({
    title: isResubmit ? 'Düzelt ve Tekrar Gönder' : (admin ? 'Yeni İşlem Ekle' : 'Masraf Fişi Ekle'),
    width: '520px',
    saveText: admin && !isResubmit ? 'Kaydet' : 'Onaya Gönder',
    content: html`
      <form id="budgetEntryForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">İşlem Türü</label>
            <select class="form-select" name="type" ${admin && !isResubmit ? '' : raw('disabled')}>
              ${admin && !isResubmit ? raw('<option value="income">Gelir</option>') : ''}
              <option value="expense" selected>Gider / Masraf</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select class="form-select" name="category">
              ${categories.map((cat) => raw(html`
                <option value="${cat}" ${existing?.category === cat ? raw('selected') : ''}>${cat}</option>
              `))}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Açıklama / Fiş Detayı</label>
          <input type="text" class="form-input" name="description" value="${existing?.description ?? ''}" placeholder="Taksi, fatura no vb.">
        </div>
        <div class="form-group">
          <label class="form-label">Tutar (₺) *</label>
          <input type="number" class="form-input" name="amount" value="${existing?.amount ?? ''}" min="0" step="0.01" required>
        </div>
        ${!admin ? raw(html`
          <div style="font-size:0.8rem;color:var(--warning);margin-top:8px;">
            <i data-lucide="info" style="width:12px;"></i> Bu masraf yönetici onayından sonra bütçeye işlenecektir.
          </div>
        `) : ''}
      </form>
    `,
    onSave: () => {
      const form = document.getElementById('budgetEntryForm');
      const values = Object.fromEntries(new FormData(form).entries());

      // disabled select FormData'ya girmez; personel için tür sabittir.
      const type = values.type ?? 'expense';
      const amount = Number(values.amount) || 0;

      if (amount <= 0) {
        showToast('Lütfen sıfırdan büyük bir tutar girin.', 'error');
        return;
      }

      const payload = {
        eventId,
        type,
        category: values.category,
        description: values.description?.trim() ?? '',
        amount,
        status: admin && !isResubmit ? 'approved' : 'pending',
      };

      if (isResubmit) {
        DB.budgets.update(existing.id, payload);
      } else {
        DB.budgets.create({ ...payload, createdBy: currentUser?.name ?? 'Bilinmiyor' });
        DB.logs.add(
          `Bütçeye ${type === 'income' ? 'gelir' : 'gider'} eklendi: ${payload.description || payload.category} (${formatAmount(amount)})`,
          'success',
        );
      }

      closeModal();
      showToast(admin && !isResubmit ? 'İşlem kaydedildi.' : 'Masraf onaya gönderildi.');
      onDone();
    },
  });
}

function exportBudgetPdf(event, rows, finance) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`${toAscii(event.name || 'Organizasyon')} - Butce Raporu`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

    doc.setFontSize(13);
    doc.text('Finansal Ozet', 14, 40);
    doc.autoTable({
      startY: 44,
      head: [['Kalem', 'Tutar']],
      body: [
        ['Toplam Gelir', formatAmount(finance.totalRevenue)],
        ['Toplam Gider', formatAmount(finance.expense)],
        ['Net Durum', formatAmount(finance.netProfit)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.setFontSize(13);
    doc.text('Gelir / Gider Kalemleri', 14, doc.lastAutoTable.finalY + 12);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Tur', 'Kategori', 'Aciklama', 'Tarih', 'Tutar', 'Islemi Yapan']],
      body: rows.map((row) => [
        row.type === 'income' ? 'Gelir' : 'Gider',
        toAscii(row.category),
        toAscii(row.description),
        formatShortDate(row.createdAt),
        (row.type === 'income' ? '+' : '-') + formatAmount(row.amount),
        toAscii(row.createdBy),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 9 },
    });

    doc.save(`${toAscii(event.name || 'organizasyon')}_butce_raporu.pdf`);
    showToast('PDF raporu indirildi.');
  } catch (error) {
    console.error('[budget] PDF oluşturulamadı:', error);
    showToast('PDF oluşturulurken hata oluştu.', 'error');
  }
}
