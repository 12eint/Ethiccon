/**
 * Kenar çubuğu: organizasyon listesi ve modül bağlantıları.
 */
import { formatShortDate } from '../core/format.js';
import { html, raw, refreshIcons, bindClick } from '../core/ui.js';
import { hasPermission, visibleEvents } from '../core/auth.js';

const APP_VERSION = 'v2.0.0';

export function renderSidebar(container, activePage) {
  const events = visibleEvents();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byStartDate = (a, b) => new Date(a.startDate) - new Date(b.startDate);
  const upcoming = events.filter((e) => new Date(e.startDate) >= today).sort(byStartDate);
  const past = events.filter((e) => new Date(e.startDate) < today).sort((a, b) => byStartDate(b, a));

  const activeOrgId = window.location.hash.startsWith('#org/')
    ? window.location.hash.split('/')[1]
    : null;

  const eventLinks = (list) => {
    if (list.length === 0) return raw('<div class="sidebar-empty">Kayıt yok</div>');
    return list.map((event) => raw(html`
      <a href="#org/${event.id}" class="sidebar-nav-item sub-item ${event.id === activeOrgId ? 'active' : ''}" data-id="${event.id}">
        <i data-lucide="calendar" class="nav-icon-sm"></i>
        <span class="nav-label-sm">${event.name}</span>
        <span class="nav-date-sm">${formatShortDate(event.startDate)}</span>
      </a>
    `));
  };

  container.innerHTML = html`
    <a class="sidebar-header" href="#dashboard" title="Ana ekrana dön">
      <div class="sidebar-logo"><span class="logo-text">ETHICCON</span></div>
      <span class="sidebar-subtitle">Kongre Yönetim Sistemi</span>
    </a>

    <div class="sidebar-section-title">ORGANİZASYONLAR</div>
    <nav class="sidebar-nav">
      <a href="#events" class="sidebar-nav-item ${activePage === 'events' ? 'active' : ''}">
        <i data-lucide="list" class="nav-icon"></i>
        <span class="nav-label">Tüm Etkinlikler</span>
      </a>

      <div class="accordion-item">
        <div class="accordion-header" data-accordion="upcoming">
          <i data-lucide="calendar-clock" class="nav-icon"></i>
          <span class="nav-label">Gelecek (${upcoming.length})</span>
          <i data-lucide="chevron-down" class="accordion-icon"></i>
        </div>
        <div class="accordion-content" data-panel="upcoming">${eventLinks(upcoming)}</div>
      </div>

      <div class="accordion-item">
        <div class="accordion-header" data-accordion="past">
          <i data-lucide="history" class="nav-icon"></i>
          <span class="nav-label">Geçmiş (${past.length})</span>
          <i data-lucide="chevron-down" class="accordion-icon"></i>
        </div>
        <div class="accordion-content" data-panel="past">${eventLinks(past)}</div>
      </div>
    </nav>

    <div class="sidebar-section-title">MODÜLLER</div>
    <nav class="sidebar-nav">
      ${hasPermission('view_budget') ? raw(html`
        <a href="#budget" class="sidebar-nav-item ${activePage === 'budget' ? 'active' : ''}">
          <i data-lucide="calculator" class="nav-icon"></i>
          <span class="nav-label">Bütçe ve Finans</span>
        </a>
      `) : ''}
      ${hasPermission('view_proforma') ? raw(html`
        <a href="#proforma" class="sidebar-nav-item ${activePage === 'proforma' ? 'active' : ''}">
          <i data-lucide="file-spreadsheet" class="nav-icon"></i>
          <span class="nav-label">Proforma Fatura</span>
        </a>
      `) : ''}
      <a href="#sponsors" class="sidebar-nav-item ${activePage === 'sponsors' ? 'active' : ''}">
        <i data-lucide="award" class="nav-icon"></i>
        <span class="nav-label">Sponsor ve Sergi</span>
      </a>
    </nav>

    <div class="sidebar-section-title">VERİTABANI</div>
    <nav class="sidebar-nav">
      <a href="#companies" class="sidebar-nav-item ${activePage === 'companies' ? 'active' : ''}">
        <i data-lucide="building-2" class="nav-icon"></i>
        <span class="nav-label">Firmalar</span>
      </a>
      <a href="#vcard-builder" class="sidebar-nav-item ${activePage === 'vcardBuilder' ? 'active' : ''}">
        <i data-lucide="contact" class="nav-icon"></i>
        <span class="nav-label">Rehber Oluşturucu</span>
      </a>
    </nav>

    ${hasPermission('view_settings') ? raw(html`
      <div class="sidebar-section-title">SİSTEM</div>
      <nav class="sidebar-nav">
        <a href="#settings" class="sidebar-nav-item ${activePage === 'settings' ? 'active' : ''}">
          <i data-lucide="settings" class="nav-icon"></i>
          <span class="nav-label">Ayarlar</span>
        </a>
      </nav>
    `) : ''}

    <div class="sidebar-footer"><span class="sidebar-version">${APP_VERSION}</span></div>
  `;

  // Akordeon: aynı anda tek panel açık kalır.
  bindClick(container, (event) => {
    const header = event.target.closest('[data-accordion]');
    if (!header) return;

    const panel = container.querySelector(`[data-panel="${header.dataset.accordion}"]`);
    const willOpen = !panel.classList.contains('open');

    container.querySelectorAll('.accordion-content').forEach((el) => el.classList.remove('open'));
    container.querySelectorAll('.accordion-icon').forEach((el) => el.classList.remove('rotated'));

    if (willOpen) {
      panel.classList.add('open');
      header.querySelector('.accordion-icon')?.classList.add('rotated');
    }
  });

  // Açık organizasyonun bulunduğu grubu otomatik aç.
  if (activeOrgId) {
    const activeLink = container.querySelector(`.sub-item[data-id="${activeOrgId}"]`);
    const panel = activeLink?.closest('.accordion-content');
    if (panel) {
      panel.classList.add('open');
      panel.previousElementSibling?.querySelector('.accordion-icon')?.classList.add('rotated');
    }
  }

  refreshIcons(container);
}
