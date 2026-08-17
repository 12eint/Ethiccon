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

import { renderRegistrationModule } from './modules/registration.js';
import { renderAccommodationModule } from './modules/accommodation.js';
import { renderFlightModule } from './modules/flight.js';
import { renderTransfersModule } from './modules/transfers.js';
import { renderSponsorsModule } from './modules/sponsors.js';
import { renderBudgetModule } from './modules/budget.js';
import { renderProformaModule } from './modules/proforma.js';
import { renderTasksModule } from './modules/tasks.js';
import { renderCommunicationModule } from './modules/communication.js';

/**
 * Sekme tanımları. count() rozetteki sayıyı, permission görünürlüğü belirler.
 * @type {Array<{key: string, label: string, icon: string, render: Function,
 *   count?: (eventId: string) => number, permission?: string}>}
 */
const TABS = [
  {
    key: 'registration',
    label: 'Kayıt',
    icon: 'user-plus',
    count: (id) => DB.participants.getByEventId(id).length,
    render: renderRegistrationModule,
  },
  {
    key: 'accommodation',
    label: 'Konaklama',
    icon: 'bed-double',
    count: (id) => DB.participants.getByEventId(id).filter((p) => p.accommodation).length,
    render: renderAccommodationModule,
  },
  {
    key: 'flight',
    label: 'Uçuş',
    icon: 'plane',
    count: (id) => DB.flights.getByEventId(id).length,
    render: renderFlightModule,
  },
  {
    key: 'transfers',
    label: 'Lojistik',
    icon: 'car',
    count: (id) => DB.transfers.getByEventId(id).length,
    render: renderTransfersModule,
  },
  {
    key: 'sponsors',
    label: 'Sponsorlar',
    icon: 'award',
    count: (id) => DB.sponsors.getByEventId(id).length,
    render: renderSponsorsModule,
  },
  {
    key: 'budget',
    label: 'Bütçe',
    icon: 'calculator',
    count: (id) => DB.budgets.getByEventId(id).length,
    permission: 'view_budget',
    render: renderBudgetModule,
  },
  {
    key: 'proforma',
    label: 'Proforma',
    icon: 'file-text',
    count: (id) => DB.proformas.getByEventId(id).length,
    permission: 'view_proforma',
    render: renderProformaModule,
  },
  {
    key: 'tasks',
    label: 'Görevler',
    icon: 'kanban',
    count: (id) => DB.tasks.getByEventId(id).length,
    render: renderTasksModule,
  },
  {
    key: 'communication',
    label: 'İletişim',
    icon: 'mail',
    render: renderCommunicationModule,
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
      ${tabs.map((tab) => raw(html`
        <button class="tab ${tab.key === activeTab.key ? 'active' : ''}" data-tab="${tab.key}">
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

  // Sekme kendi içeriğini tazelemek istediğinde başlıktaki sayaçların da
  // güncellenmesi için tüm sayfayı yeniden çizeriz.
  const reload = () => renderOrgDetail(container, eventId, activeTab.key);

  activeTab.render(container.querySelector('#tabContent'), eventId, reload);
  refreshIcons(container);
}
