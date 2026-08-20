/**
 * Organizasyon özeti.
 *
 * İki işi var:
 * 1. Organizasyonun durumunu tek bakışta göstermek.
 * 2. "Eksikler" listesiyle iş akışı sırasını yönlendirmek. Bu sistemde
 *    adımlar birbirine bağlı (fiyat girilmeden kayıt geliri hesaplanmaz,
 *    kontenjan girilmeden konaklama kârı çıkmaz) ama bu bağımlılık hiçbir
 *    yerde görünmüyordu. Liste, sıradaki adımı söyleyip ilgili sekmeye
 *    bağlanır.
 */
import { DB } from '../../core/store.js';
import { formatAmount, formatDate } from '../../core/format.js';
import { html, raw, refreshIcons } from '../../core/ui.js';
import { isAdmin } from '../../core/auth.js';
import {
  eventFinancials, accommodationBreakdown, proformaTotals, ROOM_TYPES,
} from '../../core/pricing.js';

export function renderOverviewModule(container, eventId) {
  const event = DB.events.getById(eventId);
  if (!event) return;

  const admin = isAdmin();
  const participants = DB.participants.getByEventId(eventId);
  const guests = participants.filter((pax) => pax.accommodation);
  const flights = DB.flights.getByEventId(eventId);
  const finance = eventFinancials(eventId);
  const rooms = accommodationBreakdown(eventId);

  const allotmentTotal = rooms.reduce((sum, row) => sum + (Number(row.allotment.count) || 0), 0);
  const soldTotal = rooms.reduce((sum, row) => sum + row.sold, 0);
  const issues = collectIssues({ event, participants, guests, flights, finance, rooms, eventId, admin });

  container.innerHTML = html`
    <div class="page-header">
      <h2>Özet</h2>
      <span style="font-size:0.85rem;color:var(--slate-500);">
        ${event.startDate ? formatDate(event.startDate) : 'Tarih belirlenmedi'}
        ${event.endDate ? raw(` — ${formatDate(event.endDate)}`) : ''}
      </span>
    </div>

    <div class="kpi-grid" style="margin-bottom:24px;">
      ${raw(statCard('users', 'Kayıtlı Misafir',
        String(participants.length),
        event.capacity ? `${event.capacity} kontenjan` : 'Kontenjan belirlenmedi',
        'var(--primary-600)'))}
      ${raw(statCard('bed-double', 'Konaklama',
        `${soldTotal}${allotmentTotal ? ` / ${allotmentTotal}` : ''}`,
        allotmentTotal ? 'yerleşen / bağlanan oda' : 'Kontenjan girilmedi',
        'var(--info)'))}
      ${raw(statCard('plane', 'Uçuş Kaydı',
        String(flights.length),
        `${DB.transfers.getByEventId(eventId).length} transfer planlandı`,
        'var(--warning)'))}
      ${admin ? raw(statCard(
        finance.netProfit >= 0 ? 'trending-up' : 'trending-down',
        finance.netProfit >= 0 ? 'Net Kâr' : 'Net Zarar',
        formatAmount(finance.netProfit),
        `${formatAmount(finance.totalRevenue)} gelir · ${formatAmount(finance.expense)} gider`,
        finance.netProfit >= 0 ? 'var(--success)' : 'var(--danger)')) : ''}
    </div>

    <div style="display:grid;grid-template-columns:${admin ? '3fr 2fr' : '1fr'};gap:24px;align-items:start;">
      <div class="card" style="padding:24px;">
        <h3 class="settings-card-title">
          <i data-lucide="${issues.length ? 'list-checks' : 'check-circle'}"></i>
          ${issues.length ? `Eksikler ve Uyarılar (${issues.length})` : 'Eksik görünmüyor'}
        </h3>
        ${issues.length === 0
          ? raw(html`
            <p style="color:var(--slate-500);font-size:0.9rem;margin:0;">
              Bu organizasyonda tamamlanmamış bir adım tespit edilmedi.
            </p>`)
          : raw(html`
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${issues.map((issue) => raw(html`
                <a class="overview-issue" data-tab-link="${issue.tab}" style="border-left:3px solid ${SEVERITY[issue.severity].color};">
                  <i data-lucide="${SEVERITY[issue.severity].icon}" style="width:17px;height:17px;color:${SEVERITY[issue.severity].color};flex-shrink:0;"></i>
                  <span class="overview-issue-text">
                    <strong>${issue.title}</strong>
                    <span>${issue.detail}</span>
                  </span>
                  <span class="overview-issue-go">${issue.action} →</span>
                </a>
              `))}
            </div>`)}
      </div>

      ${admin ? raw(html`
        <div class="card" style="padding:24px;">
          <h3 class="settings-card-title"><i data-lucide="coins"></i> Modül Gelirleri</h3>
          ${raw(revenueRow('Kayıt', finance.registration))}
          ${raw(revenueRow('Konaklama (net marj)', finance.accommodation))}
          ${raw(revenueRow('Uçak Bileti (net marj)', finance.flight))}
          ${raw(revenueRow('Ek Gelirler', finance.extraIncome))}
          <div style="display:flex;justify-content:space-between;padding:12px 8px;margin-top:8px;background:var(--slate-50);border-radius:var(--radius-md);">
            <span style="font-weight:700;color:var(--slate-700);">TOPLAM GELİR</span>
            <span style="font-weight:800;color:var(--success);">${formatAmount(finance.totalRevenue)}</span>
          </div>
        </div>
      `) : ''}
    </div>
  `;

  refreshIcons(container);
}

const SEVERITY = {
  blocker: { color: 'var(--danger)', icon: 'alert-circle' },
  warning: { color: 'var(--warning)', icon: 'alert-triangle' },
  info: { color: 'var(--info)', icon: 'info' },
};

/**
 * Organizasyonun tamamlanmamış adımlarını ve dikkat gerektiren durumlarını
 * toplar. Sıra önemlidir: engelleyiciler önce gelir.
 * @returns {Array<{severity: string, title: string, detail: string, tab: string, action: string}>}
 */
function collectIssues({ event, participants, guests, flights, finance, rooms, eventId, admin }) {
  const issues = [];
  const add = (severity, title, detail, tab, action) =>
    issues.push({ severity, title, detail, tab, action });

  // ── Kurulum eksikleri ──
  if (!Number(event.earlyRegPrice) && !Number(event.lateRegPrice)) {
    add('blocker', 'Kayıt fiyatı belirlenmemiş',
      'Fiyat girilmeden kayıt geliri sıfır hesaplanır.', 'settings', 'Ayarlar');
  }
  if (guests.length > 0 && rooms.every((row) => !Number(row.allotment.count))) {
    add('blocker', 'Oda kontenjanı girilmemiş',
      `${guests.length} misafir konaklamalı görünüyor ama kontenjan ve alış fiyatı tanımlı değil.`,
      'accommodation', 'Konaklama');
  }
  if (!event.assignedManagerId) {
    add('info', 'Sorumlu atanmamış',
      'Organizasyon şu an tüm personele açık.', 'settings', 'Ayarlar');
  }

  // ── Kapasite aşımları ──
  if (event.capacity && participants.length > event.capacity) {
    add('warning', 'Kontenjan aşıldı',
      `${participants.length} kayıt var, kontenjan ${event.capacity}.`, 'registration', 'Kayıt');
  }
  rooms.forEach((row) => {
    if (row.allotment.count > 0 && row.sold > row.allotment.count) {
      add('warning', `${row.type} oda kontenjanı aşıldı`,
        `${row.sold} misafir yerleştirildi, ${row.allotment.count} oda bağlandı.`,
        'accommodation', 'Konaklama');
    }
  });

  // ── Operasyon boşlukları ──
  const transferPax = new Set(
    DB.transfers.getByEventId(eventId).flatMap((transfer) => transfer.passengers ?? []),
  );
  const flyingWithoutTransfer = flights.filter((flight) => !transferPax.has(flight.participantId));
  if (flyingWithoutTransfer.length > 0) {
    add('warning', 'Transferi olmayan uçuş var',
      `${flyingWithoutTransfer.length} misafirin bileti var ama transfere atanmamış.`,
      'transfers', 'Lojistik');
  }

  const missingContact = participants.filter((pax) => !pax.email && !pax.phone).length;
  if (missingContact > 0) {
    add('info', 'İletişim bilgisi eksik misafir var',
      `${missingContact} kayıtta ne e-posta ne telefon var.`, 'registration', 'Kayıt');
  }

  // ── Finans ──
  if (admin && finance.pendingExpense > 0) {
    add('warning', 'Onay bekleyen masraf var',
      `${formatAmount(finance.pendingExpense)} tutarında saha harcaması onayınızı bekliyor.`,
      'budget', 'Bütçe');
  }

  const overdue = DB.proformas.getByEventId(eventId).filter((p) => proformaTotals(p).overdue);
  if (overdue.length > 0) {
    const total = overdue.reduce((sum, p) => sum + proformaTotals(p).balance, 0);
    add('warning', 'Vadesi geçmiş proforma var',
      `${overdue.length} faturada toplam ${formatAmount(total)} alacak gecikmiş.`,
      'proforma', 'Proforma');
  }

  if (admin && finance.netProfit < 0 && finance.totalRevenue > 0) {
    add('warning', 'Organizasyon zararda görünüyor',
      `Gider geliri ${formatAmount(Math.abs(finance.netProfit))} aşıyor.`, 'budget', 'Bütçe');
  }

  const openTasks = DB.tasks.getByEventId(eventId).filter((task) => task.status !== 'done').length;
  if (openTasks > 0) {
    add('info', 'Açık görev var', `${openTasks} görev tamamlanmadı.`, 'tasks', 'Görevler');
  }

  const order = { blocker: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

function statCard(icon, label, value, hint, color) {
  return html`
    <div class="kpi-card" style="border-left:4px solid ${color};">
      <div style="display:flex;align-items:center;gap:8px;color:var(--slate-500);">
        <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
        <span style="font-size:0.85rem;font-weight:600;text-transform:uppercase;">${label}</span>
      </div>
      <div style="font-size:1.8rem;font-weight:800;color:${color};margin-top:8px;">${value}</div>
      <div style="font-size:0.75rem;color:var(--slate-500);margin-top:4px;">${hint}</div>
    </div>
  `;
}

function revenueRow(label, value) {
  return html`
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--slate-100);">
      <span style="font-weight:500;color:var(--slate-600);">${label}</span>
      <span style="font-weight:700;color:${value < 0 ? 'var(--danger)' : 'var(--slate-800)'};">${formatAmount(value)}</span>
    </div>
  `;
}
