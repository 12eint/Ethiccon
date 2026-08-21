/**
 * Organizasyon detayı — tüm operasyon modüllerinin tek kabuğu.
 *
 * Önceden iki ayrı detay tasarımı vardı: #event/:id (basit sekmeler) ve
 * #org/:id (zengin modüller). İkincisi hiçbir yerden çağrılmadığı için
 * kayıt/konaklama/uçuş modülleri ölü koddu ve bütçe hesapları bu modüllerin
 * yazdığı alanlara dayandığı için hep sıfır çıkıyordu. Artık tek sayfa var.
 */
import { DB } from '../core/store.js';
import { navigateTo, paths } from '../core/router.js';
import { formatDate } from '../core/format.js';
import { html, raw, refreshIcons, emptyState } from '../core/ui.js';
import { hasPermission } from '../core/auth.js';

import { renderOverviewModule } from './modules/overview.js';
import { renderRegistrationModule } from './modules/registration.js';
import { renderAccommodationModule } from './modules/accommodation.js';
import { renderFlightModule } from './modules/flight.js';
import { renderTransfersModule } from './modules/transfers.js';
import { renderSponsorsModule } from './modules/sponsors.js';
import { renderBudgetModule } from './modules/budget.js';
import { renderProformaModule } from './modules/proforma.js';
import { renderTasksModule } from './modules/tasks.js';
import { renderCommunicationModule } from './modules/communication.js';
import { renderOrgSettingsModule } from './modules/orgSettings.js';

/**
 * Sekme tanımları. count() rozetteki sayıyı, permission görünürlüğü belirler.
 * @type {Array<{key: string, label: string, icon: string, render: Function,
 *   group: string, count?: (eventId: string) => number, permission?: string}>}
 */
/** Sekme grupları — ayraç yerleşimi ve ipucu metni için. */
const TAB_GROUPS = {
  ozet: 'Özet',
  operasyon: 'Operasyon',
  ticari: 'Ticari',
  yonetim: 'Yönetim',
};

const TABS = [
  {
    key: 'overview',
    group: 'ozet',
    label: 'Özet',
    icon: 'layout-dashboard',
    render: renderOverviewModule,
  },
  {
    key: 'registration',
    group: 'operasyon',
    label: 'Kayıt',
    icon: 'user-plus',
    count: (id) => DB.participants.getByEventId(id).length,
    render: renderRegistrationModule,
  },
  {
    key: 'accommodation',
    group: 'operasyon',
    label: 'Konaklama',
    icon: 'bed-double',
    count: (id) => DB.participants.getByEventId(id).filter((p) => p.accommodation).length,
    render: renderAccommodationModule,
  },
  {
    key: 'flight',
    group: 'operasyon',
    label: 'Uçuş',
    icon: 'plane',
    count: (id) => DB.flights.getByEventId(id).length,
    render: renderFlightModule,
  },
  {
    key: 'transfers',
    group: 'operasyon',
    label: 'Lojistik',
    icon: 'car',
    count: (id) => DB.transfers.getByEventId(id).length,
    render: renderTransfersModule,
  },
  {
    key: 'sponsors',
    group: 'ticari',
    label: 'Sponsorlar',
    icon: 'award',
    count: (id) => DB.sponsors.getByEventId(id).length,
    render: renderSponsorsModule,
  },
  {
    key: 'budget',
    group: 'ticari',
    label: 'Bütçe',
    icon: 'calculator',
    count: (id) => DB.budgets.getByEventId(id).length,
    render: renderBudgetModule,
  },
  {
    key: 'proforma',
    group: 'ticari',
    label: 'Proforma',
    icon: 'file-text',
    count: (id) => DB.proformas.getByEventId(id).length,
    permission: 'view_proforma',
    render: renderProformaModule,
  },
  {
    key: 'tasks',
    group: 'yonetim',
    label: 'Görevler',
    icon: 'kanban',
    count: (id) => DB.tasks.getByEventId(id).length,
    render: renderTasksModule,
  },
  {
    key: 'communication',
    group: 'yonetim',
    label: 'İletişim',
    icon: 'mail',
    render: renderCommunicationModule,
  },
  {
    key: 'settings',
    group: 'yonetim',
    label: 'Ayarlar',
    icon: 'settings',
    render: renderOrgSettingsModule,
  },
];

export function renderOrgDetail(container, eventId, requestedTab) {
  const event = DB.events.getById(eventId);

  if (!event) {
    container.innerHTML = emptyState({
      icon: 'alert-circle',
      title: 'Organizasyon bulunamadı',
      text: 'İstenen kayıt mevcut değil veya silinmiş olabilir.',
    });
    return;
  }

  const tabs = TABS.filter((tab) => !tab.permission || hasPermission(tab.permission));
  const activeTab = tabs.find((t) => t.key === requestedTab) ?? tabs[0];

  const dateRange = event.endDate
    ? `${formatDate(event.startDate)} — ${formatDate(event.endDate)}`
    : formatDate(event.startDate);
  const paxCount = DB.participants.getByEventId(eventId).length;

  container.innerHTML = html`
    <div class="event-header-card">
      <button class="btn btn-ghost" data-action="back" style="margin-bottom:1rem;">
        <i data-lucide="arrow-left"></i> Etkinliklere Dön
      </button>
      <h1 style="font-size:1.75rem;font-weight:700;margin:0 0 0.5rem;">${event.name}</h1>
      ${event.description ? raw(html`<p style="opacity:0.85;margin:0 0 1rem;">${event.description}</p>`) : ''}
      <div class="event-meta">
        <div class="event-meta-item"><i data-lucide="calendar"></i><span>${dateRange}</span></div>
        <div class="event-meta-item"><i data-lucide="map-pin"></i><span>${event.city || '-'}</span></div>
        <div class="event-meta-item"><i data-lucide="building"></i><span>${event.venue || '-'}</span></div>
        <div class="event-meta-item">
          <i data-lucide="users"></i>
          <span>${paxCount}${event.capacity ? ` / ${event.capacity}` : ''}</span>
        </div>
      </div>
    </div>

    <div class="tabs" id="orgTabs">
      ${tabs.map((tab, index) => raw(html`
        ${index > 0 && tabs[index - 1].group !== tab.group
          ? raw('<span class="tab-group-divider" aria-hidden="true"></span>')
          : ''}
        <button class="tab ${tab.key === activeTab.key ? 'active' : ''}"
                data-tab="${tab.key}" title="${TAB_GROUPS[tab.group] ?? ''}">
          <i data-lucide="${tab.icon}" style="width:15px;height:15px;"></i>
          ${tab.label}
          ${tab.count ? raw(html`<span class="badge badge-gray" style="margin-left:0.375rem;">${tab.count(eventId)}</span>`) : ''}
        </button>
      `))}
    </div>

    <div class="card" id="tabContent" style="margin-top:0;"></div>
  `;

  container.querySelector('[data-action="back"]').addEventListener('click', () => {
    navigateTo(paths.events());
  });

  container.querySelector('#orgTabs').addEventListener('click', (clickEvent) => {
    const button = clickEvent.target.closest('.tab');
    if (!button) return;
    navigateTo(paths.org(eventId, button.dataset.tab));
  });

  // Modüller [data-tab-link="<sekme>"] taşıyan bir öğe basarak başka bir
  // sekmeye yönlendirebilir; Özet'teki eksikler listesi ve modüller arası
  // çapraz bağlantılar bunu kullanır.
  container.addEventListener('click', (clickEvent) => {
    const link = clickEvent.target.closest('[data-tab-link]');
    if (!link) return;
    clickEvent.preventDefault();
    navigateTo(paths.org(eventId, link.dataset.tabLink));
  });

  // Sekme kendi içeriğini tazelemek istediğinde başlıktaki sayaçların da
  // güncellenmesi için tüm sayfayı yeniden çizeriz.
  const reload = () => renderOrgDetail(container, eventId, activeTab.key);

  activeTab.render(container.querySelector('#tabContent'), eventId, reload);
  refreshIcons(container);
}
