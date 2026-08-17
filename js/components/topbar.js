/**
 * Topbar header component.
 * Renders title, subtitle, search, notifications, and user avatar.
 */
import { DB } from '../db.js';
import { navigateTo } from '../app.js';

/**
 * Render the topbar into the given container.
 * @param {HTMLElement} container - The topbar element
 * @param {{ title: string, subtitle?: string }} options
 */
export function renderTopbar(container, { title, subtitle }) {
    const subtitleHTML = subtitle
        ? `<p class="topbar-subtitle">${subtitle}</p>`
        : '';

    const users = DB.users.getAll();
    const currentUser = DB.users.getCurrentUser();
    const initials = currentUser ? currentUser.name.substring(0, 2).toUpperCase() : 'AD';

    container.innerHTML = `
        <style>
            .topbar-search-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                margin-top: 4px;
                background: #fff;
                border: 1px solid var(--slate-200);
                border-radius: var(--radius-md, 8px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
                max-height: 360px;
                overflow-y: auto;
                z-index: 9999;
                display: none;
            }
            .topbar-search-dropdown.active { display: block; }
            .topbar-search-dropdown .search-result-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                cursor: pointer;
                font-size: 0.85rem;
                color: var(--slate-700);
                transition: background 0.15s;
                border-bottom: 1px solid var(--slate-100);
            }
            .topbar-search-dropdown .search-result-item:last-child { border-bottom: none; }
            .topbar-search-dropdown .search-result-item:hover { background: var(--slate-50); }
            .topbar-search-dropdown .search-result-item .result-label { font-weight: 500; }
            .topbar-search-dropdown .search-result-item .result-sub { font-size: 0.75rem; color: var(--slate-400); margin-top: 2px; }
            .topbar-search-dropdown .search-result-badge {
                font-size: 0.65rem;
                padding: 2px 8px;
                border-radius: 9999px;
                font-weight: 600;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .topbar-search-dropdown .badge-participant { background: #dbeafe; color: #1e40af; }
            .topbar-search-dropdown .badge-event { background: #fce7f3; color: #9d174d; }
            .topbar-search-dropdown .search-empty {
                padding: 16px;
                text-align: center;
                font-size: 0.8rem;
                color: var(--slate-400);
            }
            .topbar-notifications-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 16px;
                width: 320px;
                background: #fff;
                border: 1px solid var(--slate-200);
                border-radius: var(--radius-md, 8px);
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
                max-height: 400px;
                overflow-y: auto;
                z-index: 9999;
                display: none;
            }
            .topbar-notifications-dropdown.active { display: block; }
            .notif-item {
                padding: 12px 16px;
                border-bottom: 1px solid var(--slate-100);
                font-size: 0.85rem;
                display: flex;
                gap: 12px;
                align-items: flex-start;
            }
            .notif-item:last-child { border-bottom: none; }
            .notif-icon {
                width: 32px; height: 32px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            }
            .notif-content { flex: 1; }
            .notif-time { font-size: 0.75rem; color: var(--slate-400); margin-top: 4px; }
            body.sidebar-collapsed .sidebar-nav-item .nav-label { display: none; }
            body.sidebar-collapsed .sidebar-section-title { opacity: 0; }
            body.sidebar-collapsed .sidebar-logo h2 { display: none; }
        </style>
        <div class="topbar-left" style="display: flex; flex-direction: row; align-items: center; gap: 16px;">
            <button class="btn btn-ghost btn-icon" id="btnToggleSidebar" title="Menüyü Daralt">
                <i data-lucide="menu"></i>
            </button>
            <div>
                <h1 class="topbar-title">${title}</h1>
                ${subtitleHTML}
            </div>
        </div>
        <div class="topbar-right">
            <div class="topbar-search" style="position:relative;">
                <i data-lucide="search" style="width:16px;height:16px;opacity:0.5;position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;z-index:1;"></i>
                <input type="text" placeholder="Ara..." style="padding-left:36px;" id="topbarSearchInput" autocomplete="off" />
                <div class="topbar-search-dropdown" id="topbarSearchDropdown"></div>
            </div>
            
            <div style="position: relative;">
                <button class="btn btn-icon topbar-notification-btn" id="btnNotifications" title="Bildirimler" style="position:relative; margin-left: 16px; border: none; background: transparent;">
                    <i data-lucide="bell"></i>
                    <span class="notification-dot" style="position:absolute; top:2px; right:2px; width:8px; height:8px; background:var(--danger); border-radius:50%;"></span>
                </button>
                <div class="topbar-notifications-dropdown" id="topbarNotificationsDropdown">
                    <div style="padding: 12px 16px; border-bottom: 1px solid var(--slate-200); font-weight: 700; display:flex; justify-content:space-between;">
                        <span>Bildirimler</span>
                    </div>
                    <div id="notificationsList"></div>
                </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; margin-left: 16px; border-left: 1px solid var(--slate-200); padding-left: 16px;">
                <div class="topbar-avatar" title="${currentUser?.name || 'Admin'}">${initials}</div>
                <div style="display: flex; flex-direction: column; margin-right: 12px;">
                    <span style="font-size: 0.85rem; font-weight: 600;">${currentUser?.name || 'Admin'}</span>
                    <span style="font-size: 0.7rem; color: var(--slate-500);">${currentUser?.role === 'admin' ? 'Yönetici' : 'Operasyon'}</span>
                </div>
                <button class="btn btn-ghost btn-sm" id="btnLogout" title="Çıkış Yap" style="padding: 6px; color: var(--danger);">
                    <i data-lucide="log-out" style="width: 16px;"></i>
                </button>
            </div>
        </div>
    `;

    // Handle Logout
    const logoutBtn = container.querySelector('#btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('auth_user');
            window.location.href = 'login.html';
        });
    }
    // Sidebar Toggle
    const toggleBtn = container.querySelector('#btnToggleSidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            const wrapper = document.querySelector('.main-wrapper');
            if (sidebar) {
                if (sidebar.style.width === '72px') {
                    sidebar.style.width = 'var(--sidebar-width)';
                    wrapper.style.marginLeft = 'var(--sidebar-width)';
                    document.body.classList.remove('sidebar-collapsed');
                } else {
                    sidebar.style.width = '72px';
                    wrapper.style.marginLeft = '72px';
                    document.body.classList.add('sidebar-collapsed');
                }
            }
        });
    }

    // Notifications Dropdown
    const notifBtn = container.querySelector('#btnNotifications');
    const notifDropdown = container.querySelector('#topbarNotificationsDropdown');
    const notifList = container.querySelector('#notificationsList');
    
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('active');
            
            // Load logs
            if (notifDropdown.classList.contains('active')) {
                const logs = DB.logs.getAll().slice(0, 5); // Last 5 logs
                if (logs.length === 0) {
                    notifList.innerHTML = `<div style="padding:16px;text-align:center;color:var(--slate-400);font-size:0.8rem;">Bildirim yok</div>`;
                } else {
                    notifList.innerHTML = logs.map(l => {
                        const time = new Date(l.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        let bg = 'var(--info-light)', c = 'var(--info)';
                        if(l.type==='success'){ bg='var(--success-light)'; c='var(--success)'; }
                        if(l.type==='danger'){ bg='var(--danger-light)'; c='var(--danger)'; }
                        if(l.type==='warning'){ bg='var(--warning-light)'; c='var(--warning)'; }
                        
                        return `
                        <div class="notif-item">
                            <div class="notif-icon" style="background:${bg}; color:${c};"><i data-lucide="info" style="width:16px;"></i></div>
                            <div class="notif-content">
                                <div style="font-weight:600; color:var(--slate-800);">${l.message}</div>
                                <div class="notif-time">${l.user} • ${time}</div>
                            </div>
                        </div>
                        `;
                    }).join('');
                    if(typeof lucide !== 'undefined') lucide.createIcons();
                }
                
                // Hide red dot
                const dot = notifBtn.querySelector('.notification-dot');
                if (dot) dot.style.display = 'none';
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
                notifDropdown.classList.remove('active');
            }
        });
    }
    // Handle topbar search
    const searchInput = container.querySelector('#topbarSearchInput');
    const searchDropdown = container.querySelector('#topbarSearchDropdown');

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            searchDropdown.classList.remove('active');
            return;
        }

        const results = [];

        // Search participants
        const participants = DB.participants.getAll();
        participants.forEach(p => {
            const haystack = `${p.firstName || ''} ${p.lastName || ''} ${p.company || ''}`.toLowerCase();
            if (haystack.includes(query)) {
                results.push({
                    type: 'participant',
                    label: `${p.firstName} ${p.lastName}`,
                    sub: p.company || '',
                    href: '#event/' + p.eventId
                });
            }
        });

        // Search events
        const events = DB.events.getAll();
        events.forEach(ev => {
            const haystack = `${ev.name || ''} ${ev.city || ''}`.toLowerCase();
            if (haystack.includes(query)) {
                results.push({
                    type: 'event',
                    label: ev.name,
                    sub: ev.city || '',
                    href: '#event/' + ev.id
                });
            }
        });

        const limited = results.slice(0, 8);

        if (limited.length === 0) {
            searchDropdown.innerHTML = '<div class="search-empty">Sonuç bulunamadı</div>';
        } else {
            searchDropdown.innerHTML = limited.map(r => `
                <div class="search-result-item" data-href="${r.href}">
                    <div>
                        <div class="result-label">${r.label}</div>
                        <div class="result-sub">${r.sub}</div>
                    </div>
                    <span class="search-result-badge ${r.type === 'participant' ? 'badge-participant' : 'badge-event'}">
                        ${r.type === 'participant' ? 'Katılımcı' : 'Etkinlik'}
                    </span>
                </div>
            `).join('');
        }

        searchDropdown.classList.add('active');

        // Bind click on results
        searchDropdown.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const href = item.dataset.href;
                searchDropdown.classList.remove('active');
                searchInput.value = '';
                navigateTo(href);
            });
        });
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.classList.remove('active');
        }
    });
}
