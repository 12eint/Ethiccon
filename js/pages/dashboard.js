import { DB } from '../db.js';

export function renderDashboard(container, eventId = null) {
    const events = DB.events.getAll();
    const currentUser = DB.users.getCurrentUser();
    
    // Filter events if the user is not an admin
    const visibleEvents = currentUser?.role === 'admin' 
        ? events 
        : events.filter(e => e.assignedManagerId === currentUser?.id);

    const now = new Date();
    const activeEvents = visibleEvents.filter(e => new Date(e.endDate) >= now);

    const logs = DB.logs.getAll();
    const recentLogs = logs.slice(0, 15); // Show last 15 logs

    let html = `
        <div class="page-fade-in">
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--slate-900);">Genel Bakış</h2>
                    <p style="color: var(--slate-500); font-size: 0.95rem;">Hoş geldin ${currentUser?.name || ''}, sistemin genel durumu aşağıdadır.</p>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn btn-primary" onclick="window.location.hash='#events'">
                        <i data-lucide="plus-circle"></i> Yeni Organizasyon
                    </button>
                </div>
            </div>

            <!-- KPI Grid -->
            <div class="kpi-grid" style="margin-bottom: 32px;">
                <div class="kpi-card blue">
                    <div class="kpi-icon blue"><i data-lucide="calendar"></i></div>
                    <div class="kpi-value">${visibleEvents.length}</div>
                    <div class="kpi-label">Toplam Organizasyon</div>
                </div>
                <div class="kpi-card green">
                    <div class="kpi-icon green"><i data-lucide="activity"></i></div>
                    <div class="kpi-value">${activeEvents.length}</div>
                    <div class="kpi-label">Aktif & Gelecek Etkinlikler</div>
                </div>
                <div class="kpi-card purple">
                    <div class="kpi-icon purple"><i data-lucide="users"></i></div>
                    <div class="kpi-value">${DB.participants.getAll().length}</div>
                    <div class="kpi-label">Kayıtlı Misafir (Tümü)</div>
                </div>
            </div>

            <!-- Charts Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                <div class="card" style="padding: 24px;">
                    <h3 class="card-title" style="margin-bottom: 16px; font-size: 1rem;">Oda Dağılımı (Tüm Organizasyonlar)</h3>
                    <div style="position: relative; height: 220px; width: 100%;">
                        <canvas id="roomChart"></canvas>
                    </div>
                </div>
                <div class="card" style="padding: 24px;">
                    <h3 class="card-title" style="margin-bottom: 16px; font-size: 1rem;">Genel Finans Durumu (Gerçekleşen)</h3>
                    <div style="position: relative; height: 220px; width: 100%;">
                        <canvas id="budgetChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Dashboard Content Grid -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start;">
                <!-- Main Activity Area -->
                <div class="card" style="padding: 24px;">
                    <div class="card-header" style="border-bottom: 1px solid var(--slate-100); padding-bottom: 16px; margin-bottom: 16px;">
                        <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="radio" style="color: var(--danger);"></i> Sistem Hareketleri (Canlı Akış)
                        </h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 16px; max-height: 400px; overflow-y: auto; padding-right: 8px;">
                        ${recentLogs.length === 0 ? `<div class="empty-state" style="text-align: center; padding: 32px; color: var(--slate-400);">Henüz bir hareket bulunmuyor.</div>` : ''}
                        
                        ${recentLogs.map(log => {
                            let icon = 'info';
                            let iconColor = 'var(--info)';
                            let bg = 'var(--info-light)';
                            
                            if (log.type === 'success') { icon = 'check-circle'; iconColor = 'var(--success)'; bg = 'var(--success-light)'; }
                            if (log.type === 'warning') { icon = 'alert-triangle'; iconColor = 'var(--warning)'; bg = 'var(--warning-light)'; }
                            if (log.type === 'danger') { icon = 'x-circle'; iconColor = 'var(--danger)'; bg = 'var(--danger-light)'; }

                            const timeString = new Date(log.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                            return `
                            <div style="display: flex; gap: 16px; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid var(--slate-50);">
                                <div style="background: ${bg}; color: ${iconColor}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <i data-lucide="${icon}" style="width: 18px; height: 18px;"></i>
                                </div>
                                <div style="flex: 1;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                        <span style="font-weight: 600; font-size: 0.9rem; color: var(--slate-800);">${log.user}</span>
                                        <span style="font-size: 0.75rem; color: var(--slate-400);">${timeString}</span>
                                    </div>
                                    <p style="margin: 0; font-size: 0.85rem; color: var(--slate-600); line-height: 1.4;">${log.message}</p>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Right Sidebar (Quick Actions) -->
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    <div class="card" style="padding: 24px; background: linear-gradient(145deg, var(--primary-900), var(--primary-700)); color: white; border: none;">
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">Hızlı İşlemler</h3>
                        <p style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 24px;">Modüllere beklemeden ulaşın</p>
                        
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <button class="btn" style="background: rgba(255,255,255,0.1); color: white; justify-content: flex-start; border: 1px solid rgba(255,255,255,0.2);" onclick="window.location.hash='#events'">
                                <i data-lucide="calendar"></i> Organizasyonlar
                            </button>
                            <button class="btn" style="background: rgba(255,255,255,0.1); color: white; justify-content: flex-start; border: 1px solid rgba(255,255,255,0.2);" onclick="window.location.hash='#budget'">
                                <i data-lucide="calculator"></i> Bütçe Yönetimi
                            </button>
                            <button class="btn" style="background: rgba(255,255,255,0.1); color: white; justify-content: flex-start; border: 1px solid rgba(255,255,255,0.2);" onclick="window.location.hash='#proforma'">
                                <i data-lucide="file-text"></i> Proforma Kes
                            </button>
                            ${currentUser?.role === 'admin' ? `
                            <button class="btn" style="background: rgba(255,255,255,0.1); color: white; justify-content: flex-start; border: 1px solid rgba(255,255,255,0.2);" onclick="window.location.hash='#settings'">
                                <i data-lucide="settings"></i> Sistem Ayarları
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Init Charts
    setTimeout(() => {
        if (typeof Chart !== 'undefined') {
            // Room Chart Data
            const allPax = DB.participants.getAll();
            let sng = 0, dbl = 0, trpl = 0;
            allPax.forEach(p => {
                if (p.roomType === 'SNG') sng++;
                if (p.roomType === 'DBL') dbl++;
                if (p.roomType === 'TRPL') trpl++;
            });

            new Chart(document.getElementById('roomChart'), {
                type: 'doughnut',
                data: {
                    labels: ['Single (SNG)', 'Double (DBL)', 'Triple (TRPL)'],
                    datasets: [{
                        data: [sng, dbl, trpl],
                        backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });

            // Budget Chart Data
            const allBudget = DB.budgetItems.getAll();
            let inc = 0, exp = 0;
            allBudget.forEach(b => {
                if (b.type === 'income') inc += Number(b.amount || 0);
                if (b.type === 'expense') exp += Number(b.amount || 0);
            });

            new Chart(document.getElementById('budgetChart'), {
                type: 'bar',
                data: {
                    labels: ['Gelir', 'Gider'],
                    datasets: [{
                        label: 'Tutar (₺)',
                        data: [inc, exp],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderRadius: 4
                    }]
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    }, 100);
}
