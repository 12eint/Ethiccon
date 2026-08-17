import { DB } from './db.js';
import { renderSidebar } from './components/sidebar.js';
import { renderTopbar } from './components/topbar.js';

// Auth Guard
const currentUser = DB.users.getCurrentUser();
if (!currentUser) {
    window.location.href = 'login.html';
}

import { renderDashboard } from './pages/dashboard.js';
import { renderEvents } from './pages/events.js';
import { renderEventDetail } from './pages/eventDetail.js';
import { renderParticipants } from './pages/participants.js';
import { renderSponsors } from './pages/sponsors.js';
import { renderBudget } from './pages/budget.js';
import { renderProforma } from './pages/proforma.js';
import { renderCompaniesPage } from './pages/companies.js';
import { renderVcardBuilder } from './pages/vcardBuilder.js';
import { renderSettings } from './pages/settings.js';

/**
 * Navigate programmatically by updating the hash.
 * @param {string} hash - The target hash (e.g. '#events')
 */
export function navigateTo(hash) {
    window.location.hash = hash;
}

/**
 * Parse the current hash and return route info.
 * Supports patterns like #event/:id, #event/:id/participants, etc.
 */
function parseRoute(hash) {
    const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
    const parts = cleanHash.split('/').filter(Boolean);

    // #event/:id/tab
    if (parts[0] === 'event' && parts[1]) {
        const id = parts[1];
        const tab = parts[2] || 'overview';
        return { page: 'eventDetail', id, tab };
    }

    // #org/:id
    if (parts[0] === 'org' && parts[1]) {
        return { page: 'dashboard', id: parts[1], tab: null };
    }

    // Simple routes
    let page = parts[0] || 'dashboard';
    
    // Support new hyphenated routes
    if (page === 'vcard-builder') page = 'vcardBuilder';

    return { page, id: null, tab: null };
}

/**
 * Map page names to sidebar active identifiers.
 */
function getActiveSidebarPage(page) {
    const map = {
        dashboard: 'dashboard',
        events: 'events',
        eventDetail: 'events',
        participants: 'participants',
        sponsors: 'sponsors',
        budget: 'budget',
        proforma: 'proforma',
        companies: 'companies',
        vcardBuilder: 'vcardBuilder',
        settings: 'settings',
    };
    return map[page] || 'dashboard';
}

/**
 * Main router – called on every hash change.
 */
function router() {
    const hash = window.location.hash || '#dashboard';
    const content = document.getElementById('content');
    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');

    if (!content || !sidebar || !topbar) return;

    const route = parseRoute(hash);
    const activePage = getActiveSidebarPage(route.page);

    // --- Determine title / subtitle & render page ---
    let title = 'Dashboard';
    let subtitle = '';

    switch (route.page) {
        case 'dashboard': {
            if (route.id) {
                const event = DB.events.getById(route.id);
                title = event ? event.name : 'Dashboard';
                subtitle = event ? 'Organizasyon Özeti' : '';
            } else {
                title = 'Dashboard';
                subtitle = 'Genel bakış ve istatistikler';
            }
            break;
        }
        case 'events':
            title = 'Etkinlikler';
            subtitle = 'Tüm kongre ve etkinlikleri yönetin';
            break;
        case 'eventDetail': {
            const event = DB.events.getById(route.id);
            title = event ? event.name : 'Etkinlik Detayı';
            subtitle = event ? `${event.city} · ${event.venue}` : '';
            break;
        }
        case 'participants':
            title = 'Katılımcılar';
            subtitle = 'Tüm katılımcıları yönetin';
            break;
        case 'sponsors':
            title = 'Sponsorlar';
            subtitle = 'Sponsor ve iş ortaklarını yönetin';
            break;
        case 'budget':
            title = 'Bütçe & Finans';
            subtitle = 'Gelir gider takibi';
            if (!currentUser.permissions?.includes('all') && !currentUser.permissions?.includes('view_budget')) {
                window.location.hash = '#dashboard';
                return;
            }
            break;
        case 'proforma':
            title = 'Proforma Fatura';
            subtitle = 'Yeni proforma oluşturma ve PDF çıktısı';
            if (!currentUser.permissions?.includes('all') && !currentUser.permissions?.includes('view_proforma')) {
                window.location.hash = '#dashboard';
                return;
            }
            break;
        case 'companies':
            title = 'Firmalar';
            subtitle = 'Sponsor firmalar ve iş ortakları';
            break;
        case 'vcardBuilder':
            title = 'Rehber Oluşturucu';
            subtitle = 'Excel üzerinden toplu vCard oluşturun';
            break;
        case 'settings':
            title = 'Sistem Ayarları';
            subtitle = 'Acente ve yedekleme yapılandırması';
            if (!currentUser.permissions?.includes('all') && !currentUser.permissions?.includes('view_settings')) {
                window.location.hash = '#dashboard';
                return;
            }
            break;
        default:
            title = 'Dashboard';
            subtitle = 'Genel bakış ve istatistikler';
            break;
    }

    // Render sidebar & topbar
    renderSidebar(sidebar, activePage);
    renderTopbar(topbar, { title, subtitle });

    // Clear content & render page
    content.innerHTML = `
        <div style="padding: 32px;">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 80%;"></div>
            <div style="display:flex; gap:24px; margin-top:32px;">
                <div class="skeleton" style="height:120px; flex:1;"></div>
                <div class="skeleton" style="height:120px; flex:1;"></div>
                <div class="skeleton" style="height:120px; flex:1;"></div>
            </div>
        </div>
    `;
    content.classList.remove('page-fade-in');
    
    // Simulate network delay for premium feel
    setTimeout(() => {
        content.innerHTML = '';
        void content.offsetWidth;
        content.classList.add('page-fade-in');

        switch (route.page) {
        case 'dashboard':
            renderDashboard(content, route.id);
            break;
        case 'events':
            renderEvents(content);
            break;
        case 'eventDetail':
            renderEventDetail(content, route.id, route.tab);
            break;
        case 'participants':
            renderParticipants(content);
            break;
        case 'sponsors':
            renderSponsors(content);
            break;
        case 'budget':
            if (currentUser.permissions?.includes('all') || currentUser.permissions?.includes('view_budget')) {
                renderBudget(content);
            }
            break;
        case 'proforma':
            if (currentUser.permissions?.includes('all') || currentUser.permissions?.includes('view_proforma')) {
                renderProforma(content);
            }
            break;
        case 'companies':
            renderCompaniesPage(content);
            break;
        case 'vcardBuilder':
            renderVcardBuilder(content);
            break;
        case 'settings':
            if (currentUser.permissions?.includes('all') || currentUser.permissions?.includes('view_settings')) {
                renderSettings(content);
            }
            break;
        default:
            renderDashboard(content, null);
            break;
        }

        // Process Lucide icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
        
        // Process TomSelect for any static searchable selects in the view
        initSearchableSelects();
    }, 250); // 250ms fake network delay for skeleton loading
}

/**
 * Initializes Tom Select on elements with class 'searchable-select'
 */
export function initSearchableSelects(context = document) {
    if (typeof TomSelect !== 'undefined') {
        context.querySelectorAll('.searchable-select:not(.tomselected)').forEach(el => {
            new TomSelect(el, {
                create: false,
                sortField: {
                    field: "text",
                    direction: "asc"
                }
            });
        });
    }
}

// --- Global Input Masking (Event Delegation) ---
document.addEventListener('input', (e) => {
    // TC Kimlik Maskesi (Sadece rakam, max 11 hane)
    if (e.target.matches('.mask-tc')) {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.substring(0, 11);
        e.target.value = val;
    }
    // Telefon Maskesi (05XX XXX XX XX)
    if (e.target.matches('.mask-phone')) {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 0 && val[0] !== '0') val = '0' + val;
        if (val.length > 11) val = val.substring(0, 11);
        
        let parts = [];
        if (val.length > 0) parts.push(val.substring(0, 4));
        if (val.length > 4) parts.push(val.substring(4, 7));
        if (val.length > 7) parts.push(val.substring(7, 9));
        if (val.length > 9) parts.push(val.substring(9, 11));
        
        e.target.value = parts.join(' ');
    }
});

// --- Global Search (Cmd/Ctrl + K) ---
const globalSearchOverlay = document.getElementById('globalSearchOverlay');
const globalSearchInput = document.getElementById('globalSearchInput');
const globalSearchResults = document.getElementById('globalSearchResults');
const globalSearchEmpty = document.getElementById('globalSearchEmpty');

function toggleGlobalSearch() {
    if (!globalSearchOverlay) return;
    const isVisible = globalSearchOverlay.style.display === 'flex';
    if (isVisible) {
        globalSearchOverlay.style.opacity = '0';
        setTimeout(() => globalSearchOverlay.style.display = 'none', 200);
        globalSearchInput.value = '';
        renderGlobalSearch('');
    } else {
        globalSearchOverlay.style.display = 'flex';
        setTimeout(() => {
            globalSearchOverlay.style.opacity = '1';
            globalSearchInput.focus();
        }, 10);
    }
}

document.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleGlobalSearch();
    }
    // Escape to close
    if (e.key === 'Escape' && globalSearchOverlay && globalSearchOverlay.style.display === 'flex') {
        toggleGlobalSearch();
    }
});

if (globalSearchOverlay) {
    globalSearchOverlay.addEventListener('click', (e) => {
        if (e.target === globalSearchOverlay) toggleGlobalSearch();
    });
}
if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
        renderGlobalSearch(e.target.value.trim().toLowerCase());
    });
}

function renderGlobalSearch(query) {
    if (!query) {
        globalSearchEmpty.style.display = 'flex';
        globalSearchResults.style.display = 'none';
        globalSearchResults.innerHTML = '';
        return;
    }
    
    globalSearchEmpty.style.display = 'none';
    globalSearchResults.style.display = 'block';
    
    let results = [];
    
    // Search Participants
    const participants = DB.participants.getAll();
    participants.forEach(p => {
        const str = `${p.firstName} ${p.lastName} ${p.company} ${p.email} ${p.phone}`.toLowerCase();
        if (str.includes(query)) {
            const ev = DB.events.getById(p.eventId);
            results.push({
                icon: 'user',
                title: `${p.firstName} ${p.lastName}`,
                subtitle: `${p.company || 'Bireysel'} - ${ev ? ev.name : ''}`,
                action: () => { toggleGlobalSearch(); navigateTo('#eventDetail', { id: p.eventId, tab: 'participants' }); }
            });
        }
    });

    // Search Events
    const events = DB.events.getAll();
    events.forEach(e => {
        if (e.name.toLowerCase().includes(query) || (e.city && e.city.toLowerCase().includes(query))) {
            results.push({
                icon: 'calendar',
                title: e.name,
                subtitle: `${e.startDate || ''} / ${e.city || ''}`,
                action: () => { toggleGlobalSearch(); navigateTo('#eventDetail', { id: e.id }); }
            });
        }
    });

    // Top 10 results
    results = results.slice(0, 10);
    
    if (results.length === 0) {
        globalSearchResults.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--slate-500);">"${query}" için sonuç bulunamadı.</div>`;
        return;
    }

    globalSearchResults.innerHTML = results.map((r, i) => `
        <div class="search-result-item" data-index="${i}" style="padding: 12px; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s;">
            <div style="background: var(--slate-100); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--slate-600);">
                <i data-lucide="${r.icon}" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
                <div style="font-weight: 600; color: var(--slate-800); font-size: 0.95rem;">${r.title}</div>
                <div style="font-size: 0.75rem; color: var(--slate-500);">${r.subtitle}</div>
            </div>
        </div>
    `).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Bind click events
    globalSearchResults.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = el.dataset.index;
            if (results[idx] && results[idx].action) results[idx].action();
        });
        el.addEventListener('mouseenter', () => el.style.background = 'var(--slate-50)');
        el.addEventListener('mouseleave', () => el.style.background = 'transparent');
    });
}

// --- Bootstrap ---
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
    DB.init();
    router();
});
