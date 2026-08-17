/**
 * Genel bakış ekranı: KPI'lar, grafikler ve son hareketler.
 */
import { DB } from '../core/store.js';
import { createBarChart, createDoughnutChart, destroyCharts } from '../components/charts.js';
import { formatAmount, formatTime } from '../core/format.js';
import { html, raw, refreshIcons } from '../core/ui.js';
import { getCurrentUser, isAdmin, visibleEvents } from '../core/auth.js';
import { eventFinancials, ROOM_TYPES } from '../core/pricing.js';
import { navigateTo } from '../core/router.js';

const LOG_STYLES = {
  success: { icon: 'check-circle', color: 'var(--success)', bg: 'var(--success-light)' },
  warning: { icon: 'alert-triangle', color: 'var(--warning)', bg: 'var(--warning-light)' },
  danger: { icon: 'x-circle', color: 'var(--danger)', bg: 'var(--danger-light)' },
  info: { icon: 'info', color: 'var(--info)', bg: 'var(--info-light)' },
};

export function renderDashboard(container) {
  destroyCharts();

  const user = getCurrentUser();
  const admin = isAdmin();
  const events = visibleEvents();
  const eventIds = new Set(events.map((e) => e.id));

  const now = new Date();
  const upcoming = events.filter((e) => !e.endDate || new Date(e.endDate) >= now);

  // Yalnızca kullanıcının görebildiği organizasyonların verisi sayılır.
  const participants = DB.participants.getAll().filter((p) => eventIds.has(p.eventId));
  const totals = events.reduce(
    (acc, event) => {
      const finance = eventFinancials(event.id);
      acc.revenue += finance.totalRevenue;
      acc.expense += finance.expense;
      acc.pending += finance.pendingExpense;
      return acc;
    },
    { revenue: 0, expense: 0, pending: 0 },
  );

  const roomCounts = ROOM_TYPES.map(
    (type) => participants.filter((p) => p.accommodation && p.roomType === type).length,
  );
  const hasRoomData = roomCounts.some((count) => count > 0);
  const logs = DB.logs.getAll().slice(0, 15);

  container.innerHTML = html`
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;gap:16px;flex-wrap:wrap;">
      <div>
        <h2 style="font-size:1.75rem;font-weight:800;color:var(--slate-900);">Genel Bakış</h2>
        <p style="color:var(--slate-500);font-size:0.95rem;">
          Hoş geldin ${user?.name ?? ''}, sistemin güncel durumu aşağıda.
        </p>
      </div>
      <button class="btn btn-primary" data-go="events">
        <i data-lucide="plus-circle"></i> Organizasyonlar
      </button>
    </div>

    <div class="kpi-grid" style="margin-bottom:32px;">
      <div class="kpi-card blue">
        <div class="kpi-icon blue"><i data-lucide="calendar"></i></div>
        <div class="kpi-value">${events.length}</div>
        <div class="kpi-label">Toplam Organizasyon</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-icon green"><i data-lucide="activity"></i></div>
        <div class="kpi-value">${upcoming.length}</div>
        <div class="kpi-label">Aktif & Gelecek</div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-icon purple"><i data-lucide="users"></i></div>
        <div class="kpi-value">${participants.length}</div>
        <div class="kpi-label">Kayıtlı Misafir</div>
      </div>
      ${admin ? raw(html`
        <div class="kpi-card">
          <div class="kpi-icon" style="background:var(--success-light);color:var(--success);"><i data-lucide="trending-up"></i></div>
          <div class="kpi-value" style="color:${totals.revenue - totals.expense >= 0 ? 'var(--success)' : 'var(--danger)'};">
            ${formatAmount(totals.revenue - totals.expense)}
          </div>
          <div class="kpi-label">Net Durum (tüm organizasyonlar)</div>
        </div>
      `) : ''}
    </div>

    ${admin && totals.pending > 0 ? raw(html`
      <div style="background:var(--warning-light);border:1px solid var(--warning);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px;font-size:0.9rem;color:#92400e;">
        <i data-lucide="clock" style="width:18px;height:18px;flex-shrink:0;"></i>
        <span>Onayınızı bekleyen <strong>${formatAmount(totals.pending)}</strong> tutarında saha harcaması var.</span>
        <button class="btn btn-sm btn-secondary" data-go="budget" style="margin-left:auto;">Bütçeye Git</button>
      </div>
    `) : ''}

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;margin-bottom:24px;">
      <div class="card" style="padding:24px;">
        <h3 class="card-title" style="margin-bottom:16px;font-size:1rem;">Oda Dağılımı</h3>
        <div style="position:relative;height:220px;">
          ${hasRoomData
            ? raw('<canvas id="roomChart"></canvas>')
            : raw('<div style="display:flex;height:100%;align-items:center;justify-content:center;color:var(--slate-400);font-size:0.9rem;">Konaklama kaydı bulunmuyor</div>')}
        </div>
      </div>
      <div class="card" style="padding:24px;">
        <h3 class="card-title" style="margin-bottom:16px;font-size:1rem;">Gelir / Gider</h3>
        <div style="position:relative;height:220px;">
          ${totals.revenue > 0 || totals.expense > 0
            ? raw('<canvas id="budgetChart"></canvas>')
            : raw('<div style="display:flex;height:100%;align-items:center;justify-content:center;color:var(--slate-400);font-size:0.9rem;">Finansal hareket bulunmuyor</div>')}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;align-items:start;">
      <div class="card" style="padding:24px;">
        <div class="card-header" style="border-bottom:1px solid var(--slate-100);padding-bottom:16px;margin-bottom:16px;">
          <h3 class="card-title" style="display:flex;align-items:center;gap:8px;">
            <i data-lucide="radio" style="color:var(--danger);"></i> Sistem Hareketleri
          </h3>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;max-height:400px;overflow-y:auto;padding-right:8px;">
          ${logs.length === 0
            ? raw('<div style="text-align:center;padding:32px;color:var(--slate-400);">Henüz bir hareket bulunmuyor.</div>')
            : logs.map((log) => {
                const style = LOG_STYLES[log.type] ?? LOG_STYLES.info;
                return raw(html`
                  <div style="display:flex;gap:16px;align-items:flex-start;padding-bottom:16px;border-bottom:1px solid var(--slate-50);">
                    <div style="background:${style.bg};color:${style.color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                      <i data-lucide="${style.icon}" style="width:18px;height:18px;"></i>
                    </div>
                    <div style="flex:1;">
                      <div style="display:flex;justify-content:space-between;margin-bottom:4px;gap:8px;">
                        <span style="font-weight:600;font-size:0.9rem;color:var(--slate-800);">${log.user}</span>
                        <span style="font-size:0.75rem;color:var(--slate-400);white-space:nowrap;">${formatTime(log.timestamp)}</span>
                      </div>
                      <p style="margin:0;font-size:0.85rem;color:var(--slate-600);line-height:1.4;">${log.message}</p>
                    </div>
                  </div>
                `);
              })}
        </div>
      </div>

      <div class="card" style="padding:24px;background:linear-gradient(145deg,var(--primary-900),var(--primary-700));color:white;border:none;">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">Hızlı İşlemler</h3>
        <p style="font-size:0.85rem;opacity:0.8;margin-bottom:24px;">Modüllere doğrudan ulaşın</p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${raw(quickLink('events', 'calendar', 'Organizasyonlar'))}
          ${raw(quickLink('budget', 'calculator', 'Bütçe Yönetimi'))}
          ${raw(quickLink('proforma', 'file-text', 'Proforma Fatura'))}
          ${raw(quickLink('companies', 'building-2', 'Firmalar'))}
          ${admin ? raw(quickLink('settings', 'settings', 'Sistem Ayarları')) : ''}
        </div>
      </div>
    </div>
  `;

  container.addEventListener('click', (event) => {
    const target = event.target.closest('[data-go]');
    if (target) navigateTo(`#${target.dataset.go}`);
  });

  // Grafikler DOM yerleştikten sonra kurulmalı.
  requestAnimationFrame(() => {
    if (hasRoomData) {
      createDoughnutChart('roomChart', {
        labels: ROOM_TYPES.map((type) => `${type}`),
        data: roomCounts,
        colors: ['#6366f1', '#10b981', '#f59e0b'],
      });
    }
    if (totals.revenue > 0 || totals.expense > 0) {
      createBarChart('budgetChart', {
        labels: ['Gelir', 'Gider'],
        datasets: [{
          label: 'Tutar (₺)',
          data: [totals.revenue, totals.expense],
          backgroundColor: ['#10b981', '#ef4444'],
          borderRadius: 4,
        }],
      });
    }
  });

  refreshIcons(container);
}

function quickLink(route, icon, label) {
  return html`
    <button class="btn" data-go="${route}"
      style="background:rgba(255,255,255,0.1);color:white;justify-content:flex-start;border:1px solid rgba(255,255,255,0.2);">
      <i data-lucide="${icon}"></i> ${label}
    </button>
  `;
}
