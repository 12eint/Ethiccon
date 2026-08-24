/**
 * Hash tabanlı yönlendirici.
 *
 * Önceki sürümde rota bilgisi üç ayrı switch bloğuna dağılmıştı (başlık,
 * yetki, render) ve üçünü ayrı ayrı güncellemek gerekiyordu. Artık her rota
 * tek bir kayıtta tanımlanıyor.
 */
import { renderSidebar } from '../components/sidebar.js';
import { renderTopbar } from '../components/topbar.js';
import { canAccessEvent, hasPermission } from './auth.js';
import { DB } from './store.js';
import { refreshIcons } from './ui.js';

import { renderDashboard } from '../pages/dashboard.js';
import { renderEvents } from '../pages/events.js';
import { renderOrgDetail } from '../pages/orgDetail.js';
import { renderSponsors } from '../pages/sponsors.js';
import { renderBudget } from '../pages/budget.js';
import { renderProforma } from '../pages/proforma.js';
import { renderCompaniesPage } from '../pages/companies.js';
import { renderVcardBuilder } from '../pages/vcardBuilder.js';
import { renderSettings } from '../pages/settings.js';

/**
 * @typedef {object} Route
 * @property {string|((ctx: object) => string)} title
 * @property {string|((ctx: object) => string)} [subtitle]
 * @property {(container: HTMLElement, ctx: object) => void} render
 * @property {string} [permission] - yoksa erişim serbest
 * @property {string} [navKey] - kenar çubuğunda hangi maddenin aktif olacağı
 */

/** @type {Record<string, Route>} */
const ROUTES = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Genel bakış ve istatistikler',
    render: (el) => renderDashboard(el),
  },
  events: {
    title: 'Etkinlikler',
    subtitle: 'Tüm kongre ve etkinlikleri yönetin',
    render: (el) => renderEvents(el),
  },
  org: {
    navKey: 'events',
    title: (ctx) => DB.events.getById(ctx.id)?.name ?? 'Organizasyon',
    subtitle: (ctx) => {
      const event = DB.events.getById(ctx.id);
      if (!event) return '';
      return [event.city, event.venue].filter(Boolean).join(' · ');
    },
    render: (el, ctx) => renderOrgDetail(el, ctx.id, ctx.tab),
  },
  // Aşağıdaki üç sayfa organizasyonlar arası salt okunur rapordur;
  // düzenleme organizasyonun içindeki eşlenik sekmede yapılır.
  sponsors: {
    title: 'Sponsor Raporu',
    subtitle: 'Tüm organizasyonlardaki sponsorluklar',
    render: (el) => renderSponsors(el),
  },
  budget: {
    title: 'Bütçe ve Finans',
    subtitle: 'Organizasyon bazında bütçe durumu',
    render: (el) => renderBudget(el),
  },
  proforma: {
    title: 'Tahsilat Raporu',
    subtitle: 'Proformalar ve ödeme durumları',
    permission: 'view_proforma',
    render: (el) => renderProforma(el),
  },
  companies: {
    title: 'Firmalar',
    subtitle: 'Sponsor firmalar ve iş ortakları',
    render: (el) => renderCompaniesPage(el),
  },
  vcardBuilder: {
    title: 'Rehber Oluşturucu',
    subtitle: 'Excel üzerinden toplu vCard oluşturun',
    render: (el) => renderVcardBuilder(el),
  },
  settings: {
    title: 'Sistem Ayarları',
    subtitle: 'Acente, yetki ve yedekleme yapılandırması',
    permission: 'view_settings',
    render: (el) => renderSettings(el),
  },
};

const ALIASES = {
  'vcard-builder': 'vcardBuilder',
  '': 'dashboard',
};

export function navigateTo(hash) {
  window.location.hash = hash.startsWith('#') ? hash : `#${hash}`;
}

/** Rota adresi üreticileri — hash biçimi tek yerde dursun. */
export const paths = {
  org: (id, tab) => (tab ? `#org/${id}/${tab}` : `#org/${id}`),
  events: () => '#events',
  dashboard: () => '#dashboard',
};

/**
 * "#org/abc/budget" → { name: 'org', id: 'abc', tab: 'budget' }
 * Eski "#event/:id" adresleri "#org/:id" olarak yorumlanır.
 */
function parseHash(hash) {
  const clean = hash.replace(/^#/, '');
  const [head, ...rest] = clean.split('/').filter(Boolean);
  const name = ALIASES[head ?? ''] ?? head ?? 'dashboard';

  // Geriye dönük uyum: eski etkinlik detayı adresleri organizasyona eşlenir.
  if (name === 'event' || name === 'eventDetail') {
    return { name: 'org', id: rest[0], tab: rest[1] };
  }
  if (name === 'org') {
    return { name: 'org', id: rest[0], tab: rest[1] };
  }
  return { name, id: rest[0], tab: rest[1] };
}

function resolve(value, ctx) {
  return typeof value === 'function' ? value(ctx) : value;
}

export function startRouter() {
  const content = document.getElementById('content');
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  if (!content || !sidebar || !topbar) return;

  function handleRoute() {
    const ctx = parseHash(window.location.hash);
    let route = ROUTES[ctx.name];

    // Bilinmeyen rota → dashboard
    if (!route) {
      route = ROUTES.dashboard;
      ctx.name = 'dashboard';
    }

    // Kayıp veya kullanıcıya atanmamış organizasyon adres çubuğundan da
    // açılamaz. Hash'i de düzeltmek geri/ileri gezinmesinde aynı kaçak rotaya
    // tekrar düşülmesini önler.
    if (ctx.name === 'org' && !canAccessEvent(ctx.id)) {
      navigateTo(paths.dashboard());
      return;
    }

    if (route.permission && !hasPermission(route.permission)) {
      navigateTo(paths.dashboard());
      return;
    }

    renderSidebar(sidebar, route.navKey ?? ctx.name);
    renderTopbar(topbar, {
      title: resolve(route.title, ctx),
      subtitle: resolve(route.subtitle, ctx) ?? '',
    });

    content.innerHTML = '';
    content.classList.remove('page-fade-in');
    void content.offsetWidth; // animasyonu yeniden tetiklemek için reflow
    content.classList.add('page-fade-in');

    try {
      route.render(content, ctx);
    } catch (error) {
      console.error('[router] Sayfa render edilemedi:', error);
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="alert-triangle"></i></div>
          <h3 class="empty-state-title">Sayfa yüklenirken hata oluştu</h3>
          <p class="empty-state-text">Ayrıntı için tarayıcı konsoluna bakın.</p>
        </div>`;
    }

    refreshIcons();
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
