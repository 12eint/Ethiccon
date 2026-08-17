import { DB } from '../db.js';

export function renderSidebar(container, activePage) {
    const events = DB.events.getAll();
    const currentUser = DB.users.getCurrentUser();
    
    // Fallback permissions for safety if undefined
    const perms = currentUser?.permissions || (currentUser?.role === 'admin' ? ['all'] : []);
    const hasPerm = (p) => perms.includes('all') || perms.includes(p);

    // Filter events if the user is not an admin
    const visibleEvents = currentUser?.role === 'admin' 
        ? events 
        : events.filter(e => e.assignedManagerId === currentUser?.id);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Sort events by date
    const futureEvents = visibleEvents.filter(e => new Date(e.startDate) >= now).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const pastEvents = visibleEvents.filter(e => new Date(e.startDate) < now).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    // Helper to generate event list
    const generateEventLinks = (eventList) => {
        if (eventList.length === 0) return `<div class="sidebar-empty">Kayıt yok</div>`;
        return eventList.map(e => `
            <a href="#org/${e.id}" class="sidebar-nav-item sub-item" data-id="${e.id}">
                <i data-lucide="calendar" class="nav-icon-sm"></i>
                <span class="nav-label-sm">${e.name}</span>
            </a>
        `).join('');
    };

    container.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <span class="logo-text">ETHICCON</span>
            </div>
            <span class="sidebar-subtitle">Kongre Yönetim Sistemi</span>
        </div>

        <div class="sidebar-section-title">ORGANİZASYONLAR</div>

        <nav class="sidebar-nav">
            <a href="#events" class="sidebar-nav-item ${activePage === 'events' ? 'active' : ''}">
                <i data-lucide="list" class="nav-icon"></i>
                <span class="nav-label">Tüm Etkinlikler & Ekle</span>
            </a>
            
            <div class="accordion-item">
                <div class="accordion-header" id="acc-future">
                    <i data-lucide="calendar-clock" class="nav-icon"></i>
                    <span class="nav-label">Gelecek Organizasyonlar</span>
                    <i data-lucide="chevron-down" class="accordion-icon"></i>
                </div>
                <div class="accordion-content" id="content-future">
                    ${generateEventLinks(futureEvents)}
                </div>
            </div>

            <div class="accordion-item">
                <div class="accordion-header" id="acc-past">
                    <i data-lucide="history" class="nav-icon"></i>
                    <span class="nav-label">Geçmiş Organizasyonlar</span>
                    <i data-lucide="chevron-down" class="accordion-icon"></i>
                </div>
                <div class="accordion-content" id="content-past">
                    ${generateEventLinks(pastEvents)}
                </div>
            </div>
        </nav>

        <div class="sidebar-section-title">DİĞER MODÜLLER</div>
        <nav class="sidebar-nav">
            ${hasPerm('view_budget') ? `
            <a href="#budget" class="sidebar-nav-item ${activePage === 'budget' ? 'active' : ''}">
                <i data-lucide="calculator" class="nav-icon"></i>
                <span class="nav-label">Bütçe ve Finans</span>
            </a>` : ''}
            
            ${hasPerm('view_proforma') ? `
            <a href="#proforma" class="sidebar-nav-item ${activePage === 'proforma' ? 'active' : ''}">
                <i data-lucide="file-spreadsheet" class="nav-icon"></i>
                <span class="nav-label">Proforma Fatura</span>
            </a>` : ''}
            
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

        ${hasPerm('view_settings') ? `
        <div class="sidebar-section-title">SİSTEM</div>
        <nav class="sidebar-nav">
            <a href="#settings" class="sidebar-nav-item ${activePage === 'settings' ? 'active' : ''}">
                <i data-lucide="settings" class="nav-icon"></i>
                <span class="nav-label">Ayarlar</span>
            </a>
        </nav>
        ` : ''}

        <div class="sidebar-footer">
            <span class="sidebar-version">v1.2.0</span>
        </div>
    `;

    // Accordion toggle logic
    const setupAccordion = (headerId, contentId) => {
        const header = container.querySelector('#' + headerId);
        const content = container.querySelector('#' + contentId);
        if (header && content) {
            header.addEventListener('click', () => {
                const isOpen = content.classList.contains('open');
                // Close all
                container.querySelectorAll('.accordion-content').forEach(c => c.classList.remove('open'));
                container.querySelectorAll('.accordion-icon').forEach(i => i.classList.remove('rotated'));
                
                if (!isOpen) {
                    content.classList.add('open');
                    header.querySelector('.accordion-icon').classList.add('rotated');
                }
            });
        }
    };

    setupAccordion('acc-future', 'content-future');
    setupAccordion('acc-past', 'content-past');

    // Highlight active org if viewing one
    if (activePage === 'dashboard' && window.location.hash.startsWith('#org/')) {
        const id = window.location.hash.split('/')[1];
        const activeItem = container.querySelector(`.sub-item[data-id="${id}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            // Auto open parent
            const parent = activeItem.closest('.accordion-content');
            if (parent) {
                parent.classList.add('open');
                parent.previousElementSibling.querySelector('.accordion-icon').classList.add('rotated');
            }
        }
    }
}
