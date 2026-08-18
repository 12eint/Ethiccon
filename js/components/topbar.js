/**
 * Üst çubuk: sayfa başlığı, hızlı arama, bildirimler, kullanıcı menüsü.
 *
 * Önceki sürümde bileşen her çizimde <style> bloğunu yeniden basıyor ve
 * document'e temizlenmeyen tıklama dinleyicileri ekliyordu; stiller
 * css/components.css'e taşındı, dinleyiciler artık tek sefer bağlanıyor.
 */
import { DB } from '../core/store.js';
import { navigateTo, paths } from '../core/router.js';
import { formatTime } from '../core/format.js';
import { html, raw, refreshIcons } from '../core/ui.js';
import { getCurrentUser, logout } from '../core/auth.js';

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;

/** Belge düzeyindeki dinleyiciler yalnızca bir kez bağlanır. */
let globalListenersBound = false;

export function renderTopbar(container, { title, subtitle }) {
  const user = getCurrentUser();
  const initials = (user?.name ?? 'AD').trim().slice(0, 2).toUpperCase();
  const unreadCount = DB.logs.getAll().length;

  container.innerHTML = html`
    <div class="topbar-left">
      <button class="btn btn-ghost btn-icon" id="btnToggleSidebar" title="Menüyü daralt">
        <i data-lucide="menu"></i>
      </button>
      <div>
        <h1 class="topbar-title">${title}</h1>
        ${subtitle ? raw(html`<p class="topbar-subtitle">${subtitle}</p>`) : ''}
      </div>
    </div>

    <div class="topbar-right">
      <div class="topbar-search">
        <i data-lucide="search" class="topbar-search-icon"></i>
        <input type="text" placeholder="Ara..." id="topbarSearch" autocomplete="off">
        <div class="topbar-search-dropdown" id="topbarSearchDropdown"></div>
      </div>

      <div style="position:relative;">
        <button class="btn btn-icon topbar-notification-btn" id="btnNotifications" title="Bildirimler">
          <i data-lucide="bell"></i>
          ${unreadCount > 0 ? raw('<span class="notification-dot"></span>') : ''}
        </button>
        <div class="topbar-notifications-dropdown" id="notificationsDropdown">
          <div class="notif-header">Son Hareketler</div>
          <div id="notificationsList"></div>
        </div>
      </div>

      <div class="topbar-user">
        <div class="topbar-avatar" title="${user?.name ?? ''}">${initials}</div>
        <div class="topbar-user-meta">
          <span class="topbar-user-name">${user?.name ?? 'Kullanıcı'}</span>
          <span class="topbar-user-role">${user?.role === 'admin' ? 'Yönetici' : 'Operasyon'}</span>
        </div>
        <button class="btn btn-ghost btn-sm" id="btnLogout" title="Çıkış yap" style="color:var(--danger);">
          <i data-lucide="log-out" style="width:16px;"></i>
        </button>
      </div>
    </div>
  `;

  wireTopbar(container);
  refreshIcons(container);
}

function wireTopbar(container) {
  container.querySelector('#btnLogout').addEventListener('click', logout);

  container.querySelector('#btnToggleSidebar').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
  });

  // ── Bildirimler ──
  const notifButton = container.querySelector('#btnNotifications');
  const notifDropdown = container.querySelector('#notificationsDropdown');
  const notifList = container.querySelector('#notificationsList');

  notifButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const opening = !notifDropdown.classList.contains('active');
    notifDropdown.classList.toggle('active', opening);
    if (!opening) return;

    const logs = DB.logs.getAll().slice(0, 6);
    notifList.innerHTML = logs.length === 0
      ? '<div class="notif-empty">Bildirim yok</div>'
      : logs.map((log) => html`
          <div class="notif-item">
            <div class="notif-content">
              <div class="notif-message">${log.message}</div>
              <div class="notif-time">${log.user} • ${formatTime(log.timestamp)}</div>
            </div>
          </div>
        `).join('');

    notifButton.querySelector('.notification-dot')?.remove();
    refreshIcons(notifList);
  });

  // ── Arama ──
  const searchInput = container.querySelector('#topbarSearch');
  const searchDropdown = container.querySelector('#topbarSearchDropdown');

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (query.length < MIN_QUERY_LENGTH) {
      searchDropdown.classList.remove('active');
      return;
    }

    const results = collectResults(query);
    searchDropdown.innerHTML = results.length === 0
      ? '<div class="search-empty">Sonuç bulunamadı</div>'
      : results.map((item) => html`
          <div class="search-result-item" data-hash="${item.hash}">
            <div>
              <div class="result-label">${item.label}</div>
              <div class="result-sub">${item.sub}</div>
            </div>
            <span class="search-result-badge ${item.type === 'pax' ? 'badge-participant' : 'badge-event'}">
              ${item.type === 'pax' ? 'Katılımcı' : 'Etkinlik'}
            </span>
          </div>
        `).join('');
    searchDropdown.classList.add('active');
  });

  searchDropdown.addEventListener('click', (event) => {
    const item = event.target.closest('.search-result-item');
    if (!item) return;
    searchDropdown.classList.remove('active');
    searchInput.value = '';
    navigateTo(item.dataset.hash);
  });

  // Dışarı tıklayınca açık menüleri kapat — her çizimde değil, tek sefer.
  if (!globalListenersBound) {
    document.addEventListener('click', () => {
      document.querySelectorAll('.topbar-search-dropdown.active, .topbar-notifications-dropdown.active')
        .forEach((el) => el.classList.remove('active'));
    });
    globalListenersBound = true;
  }
}

function collectResults(query) {
  const results = [];

  DB.events.getAll().forEach((event) => {
    if (!`${event.name ?? ''} ${event.city ?? ''}`.toLowerCase().includes(query)) return;
    results.push({
      type: 'event',
      label: event.name,
      sub: event.city ?? '',
      hash: paths.org(event.id),
    });
  });

  DB.participants.getAll().forEach((pax) => {
    if (!`${pax.firstName ?? ''} ${pax.lastName ?? ''} ${pax.company ?? ''}`.toLowerCase().includes(query)) return;
    results.push({
      type: 'pax',
      label: `${pax.firstName ?? ''} ${pax.lastName ?? ''}`.trim(),
      sub: pax.company ?? '',
      hash: paths.org(pax.eventId, 'registration'),
    });
  });

  return results.slice(0, MAX_RESULTS);
}
