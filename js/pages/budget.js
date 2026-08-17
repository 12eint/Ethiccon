import { DB } from '../db.js';
import { openModal, closeModal } from '../components/modal.js';
import { createDoughnutChart, destroyCharts } from '../components/charts.js';
import { initSearchableSelects } from '../app.js';

// Define categories globally
const CATEGORIES = [
    'Sponsorluk', // income
    'Salon Kirası',
    'Teknik & Prodüksiyon',
    'Matbaa & Baskı',
    'Transfer & Operasyon',
    'Saha Gideri (Taksi, Yemek vs.)',
    'Diğer'
];
const EXPENSE_CATEGORIES = CATEGORIES.filter(c => c !== 'Sponsorluk');

function checkBudgetLock(event) {
    if (!event) return false;
    const now = new Date();
    
    // Find the most recent Friday 16:00
    let mostRecentLockTime = new Date(now);
    const day = now.getDay(); // 0=Sun, 1=Mon, ... 5=Fri, 6=Sat
    
    let daysSinceFriday = (day + 7 - 5) % 7; 
    if (day === 5 && now.getHours() < 16) {
        daysSinceFriday = 7; // It's Friday before 16:00, so last week's Friday is the lock
    }
    
    mostRecentLockTime.setDate(now.getDate() - daysSinceFriday);
    mostRecentLockTime.setHours(16, 0, 0, 0);
    
    const lastApprovedAt = event.budgetLastApprovedAt ? new Date(event.budgetLastApprovedAt) : new Date(0);
    
    return lastApprovedAt < mostRecentLockTime;
}

export function renderBudget(container) {
    const currentUser = DB.users.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';
    destroyCharts(); // cleanup old charts

    let events = DB.events.getAll();
    if (!isAdmin) {
        // Sorumlu can only see events assigned to them
        events = events.filter(e => !e.assignedManagerId || e.assignedManagerId === currentUser.id);
    }
    
    if (events.length === 0) {
        container.innerHTML = `<div class="card" style="padding:48px; text-align:center;">Hiç organizasyon bulunamadı.</div>`;
        return;
    }

    let selectedEventId = events[0].id;

    const render = () => {
        const event = DB.events.getById(selectedEventId) || {};
        const budgets = DB.budgets.getByEventId(selectedEventId);
        const participants = DB.participants.getByEventId(selectedEventId);
        
        // Settings defaults
        const earlyPrice = Number(event.earlyRegPrice) || 0;
        const latePrice = Number(event.lateRegPrice) || 0;
        const budgetLimits = event.budgetLimits || {}; // { 'Salon Kirası': 50000, ... }

        // Revenue calculations (Only relevant for Admin)
        let regProfit = 0;
        participants.forEach(p => {
            regProfit += p.regPeriod === 'custom' ? Number(p.regCustomPrice || 0) : (p.regPeriod === 'late' ? latePrice : earlyPrice);
        });

        let accProfit = 0;
        const accData = DB.accommodations.getByEventId(selectedEventId) || {};
        const allotment = accData.allotment || {};
        const companyPrices = accData.companyPrices || {};
        const guests = participants.filter(p => p.accommodation === true);
        ['SNG', 'DBL', 'TRPL'].forEach(type => {
            const al = allotment[type] || { count: 0, buyPrice: 0, sellPrice: 0 };
            const guestsOfType = guests.filter(g => g.roomType === type);
            let revenue = 0;
            guestsOfType.forEach(g => {
                let price = g.accSellPrice;
                if (price === undefined || price === null || price === '') {
                    if (g.company && companyPrices[g.company] && companyPrices[g.company][type]) {
                        price = companyPrices[g.company][type];
                    } else { price = al.sellPrice; }
                }
                revenue += Number(price);
            });
            const cost = al.count * al.buyPrice;
            accProfit += (revenue - cost);
        });

        let flProfit = 0;
        const flights = DB.flights.getByEventId(selectedEventId);
        flights.forEach(f => { flProfit += (Number(f.sellPrice) || 0) - (Number(f.buyPrice) || 0); });

        const coreProfit = regProfit + accProfit + flProfit;

        // Budgets calculations
        let extraIncome = 0;
        let extraExpense = 0;
        let pendingExpense = 0;
        const categoryExpenses = {};
        EXPENSE_CATEGORIES.forEach(c => categoryExpenses[c] = 0);

        budgets.forEach(b => {
            const isApproved = !b.status || b.status === 'approved';
            
            if (b.type === 'income') {
                if (isApproved) extraIncome += Number(b.amount);
            }
            if (b.type === 'expense') {
                if (isApproved) {
                    extraExpense += Number(b.amount);
                    if (categoryExpenses[b.category] !== undefined) {
                        categoryExpenses[b.category] += Number(b.amount);
                    } else {
                        categoryExpenses['Diğer'] = (categoryExpenses['Diğer'] || 0) + Number(b.amount);
                    }
                } else if (b.status === 'pending') {
                    pendingExpense += Number(b.amount);
                }
            }
        });

        const totalRevenue = coreProfit + extraIncome;
        const netProfit = totalRevenue - extraExpense;

        let totalPlannedBudget = 0;
        EXPENSE_CATEGORIES.forEach(c => totalPlannedBudget += Number(budgetLimits[c] || 0));
        const remainingBudget = totalPlannedBudget - extraExpense;
        const budgetUsagePercent = totalPlannedBudget > 0 ? Math.min(100, Math.round((extraExpense / totalPlannedBudget) * 100)) : (extraExpense > 0 ? 100 : 0);

        const isLocked = checkBudgetLock(event);

        let html = `
            <div class="page-fade-in">
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--slate-900);">${isAdmin ? 'Finansal Kokpit' : 'Saha Cüzdanı'}</h2>
                    <p style="color: var(--slate-500); font-size: 0.875rem;">${isAdmin ? 'Bütçe, gelir-gider ve kâr durumu' : 'Saha operasyon harcamaları ve limit takibi'}</p>
                </div>
                <div>
                    <select class="form-select searchable-select" id="eventSelector" style="width: 300px; font-weight: 600; font-size: 0.95rem; box-shadow: var(--shadow-sm);">
                        ${events.map(e => `<option value="${e.id}" ${e.id === selectedEventId ? 'selected' : ''}>${e.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            ${isLocked ? `
            <div style="background-color: var(--danger-light); color: var(--danger); padding: 16px; border-radius: var(--radius-md); border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i data-lucide="lock" style="width:24px; height:24px;"></i>
                    <div>
                        <h4 style="margin: 0; font-size: 1rem; font-weight: 700;">Haftalık Bütçe Kilitli</h4>
                        <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.9;">
                            ${isAdmin ? 'Cuma 16:00 kilidi devrede. Sorumluların işlem yapabilmesi için bütçeyi onaylayın.' : 'Cuma 16:00 itibarıyla bütçe yönetici onayına kadar dondurulmuştur. Yeni harcama ekleyemezsiniz.'}
                        </p>
                    </div>
                </div>
                ${isAdmin ? `
                    <button class="btn btn-primary" id="btnUnlockBudget" style="background-color: var(--danger); box-shadow: none;">
                        <i data-lucide="unlock" style="width:16px;"></i> Bütçeyi Onayla ve Kilidi Aç
                    </button>
                ` : ''}
            </div>
            ` : ''}
        `;

        if (isAdmin) {
            html += `
                <!-- ADMIN: KPI CARDS -->
                <div class="kpi-grid" style="margin-bottom: 24px;">
                    <div class="kpi-card" style="border-left: 4px solid var(--success); background: linear-gradient(145deg, #ffffff, #f0fdf4);">
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--slate-500); text-transform: uppercase;">Toplam Gelir</div>
                        <div style="font-size: 1.8rem; font-weight: 800; color: var(--slate-900); margin-top: 8px;">₺${totalRevenue.toLocaleString('tr-TR')}</div>
                        <div style="font-size: 0.75rem; color: var(--slate-500); margin-top: 4px;">Kayıt, Konaklama, Uçak, Sponsorluk</div>
                    </div>
                    <div class="kpi-card" style="border-left: 4px solid var(--danger); background: linear-gradient(145deg, #ffffff, #fef2f2);">
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--slate-500); text-transform: uppercase;">Toplam Gider</div>
                        <div style="font-size: 1.8rem; font-weight: 800; color: var(--slate-900); margin-top: 8px;">₺${extraExpense.toLocaleString('tr-TR')}</div>
                        <div style="font-size: 0.75rem; color: var(--slate-500); margin-top: 4px;">Tüm kategoriler</div>
                    </div>
                    <div class="kpi-card" style="border-left: 4px solid ${netProfit >= 0 ? 'var(--primary-600)' : 'var(--danger)'}; background: linear-gradient(145deg, #ffffff, var(--primary-50));">
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--slate-500); text-transform: uppercase;">Net Kâr / Zarar</div>
                        <div style="font-size: 1.8rem; font-weight: 800; color: ${netProfit >= 0 ? 'var(--primary-700)' : 'var(--danger)'}; margin-top: 8px;">
                            ${netProfit >= 0 ? '+' : ''}₺${netProfit.toLocaleString('tr-TR')}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--slate-500); margin-top: 4px;">Gerçekleşen net durum</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 24px;">
                    <!-- Modül Gelirleri -->
                    <div class="card" style="padding: 24px;">
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 16px; color: var(--slate-800);">Modül Satış Gelirleri</h3>
                        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--slate-100);">
                            <span style="font-weight: 500; color: var(--slate-600);">Kayıt (Misafir)</span>
                            <span style="font-weight: 700; color: var(--slate-800);">₺${regProfit.toLocaleString('tr-TR')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--slate-100);">
                            <span style="font-weight: 500; color: var(--slate-600);">Konaklama</span>
                            <span style="font-weight: 700; color: var(--slate-800);">₺${accProfit.toLocaleString('tr-TR')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--slate-100);">
                            <span style="font-weight: 500; color: var(--slate-600);">Uçak Bileti</span>
                            <span style="font-weight: 700; color: var(--slate-800);">₺${flProfit.toLocaleString('tr-TR')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; background: var(--slate-50); border-radius: var(--radius-md);">
                            <span style="font-weight: 700; color: var(--slate-700); padding-left: 8px;">TOPLAM SİSTEM GELİRİ</span>
                            <span style="font-weight: 800; color: var(--success); padding-right: 8px;">₺${coreProfit.toLocaleString('tr-TR')}</span>
                        </div>
                    </div>

                    <!-- Gider Dağılımı Grafiği -->
                    <div class="card" style="padding: 24px;">
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 16px; color: var(--slate-800);">Gider Kategori Dağılımı</h3>
                        <div style="height: 200px; position: relative;">
                            ${extraExpense > 0 
                                ? '<canvas id="expenseDoughnutChart"></canvas>' 
                                : '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--slate-400);">Gider bulunmuyor</div>'}
                        </div>
                    </div>
                </div>

                <!-- ADMIN: PENDING APPROVALS -->
                ${budgets.filter(b => b.status === 'pending' && b.type === 'expense').length > 0 ? `
                <div class="card" style="margin-bottom: 24px; border: 1px solid var(--warning);">
                    <div class="card-header" style="background: var(--warning-light); border-bottom: 1px solid rgba(245, 158, 11, 0.2); padding: 16px 24px;">
                        <h3 class="card-title" style="color: #92400e; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="clock" style="width:18px;"></i> Onay Bekleyen Saha Harcamaları
                        </h3>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Kategori</th>
                                    <th>Açıklama</th>
                                    <th>Tarih</th>
                                    <th>Tutar (₺)</th>
                                    <th>Ekleyen</th>
                                    <th style="text-align:right;">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${budgets.filter(b => b.status === 'pending' && b.type === 'expense').map(b => `
                                    <tr>
                                        <td><strong>${b.category}</strong></td>
                                        <td>${b.description || '-'}</td>
                                        <td>${new Date(b.createdAt).toLocaleDateString('tr-TR')}</td>
                                        <td style="font-weight: 700; color: var(--warning);">₺${Number(b.amount).toLocaleString('tr-TR')}</td>
                                        <td style="font-size: 0.8rem;">${b.createdBy || '-'}</td>
                                        <td style="text-align:right; display:flex; justify-content:flex-end; gap:8px;">
                                            <button class="btn btn-success btn-icon btn-approve-budget" data-id="${b.id}" title="Onayla"><i data-lucide="check" style="width:16px;"></i></button>
                                            <button class="btn btn-danger btn-icon btn-reject-budget" data-id="${b.id}" title="Reddet"><i data-lucide="x" style="width:16px;"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}

                <!-- BÜTÇE LİMİTLERİ (BUDGET VS ACTUAL) -->
                <div class="card" style="margin-bottom: 24px; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
                        <div>
                            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--slate-800);">Planlanan vs Gerçekleşen Bütçe</h3>
                            <p style="font-size: 0.85rem; color: var(--slate-500);">Kategorilere limit tanımlayın, sorumluların harcamalarını kontrol altında tutun.</p>
                        </div>
                        <button class="btn btn-secondary btn-sm" id="btnEditLimits"><i data-lucide="sliders" style="width:14px;"></i> Limitleri Düzenle</button>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                        ${EXPENSE_CATEGORIES.map(cat => {
                            const limit = Number(budgetLimits[cat] || 0);
                            const spent = categoryExpenses[cat] || 0;
                            const perc = limit > 0 ? Math.min(100, Math.round((spent/limit)*100)) : (spent > 0 ? 100 : 0);
                            const colorClass = perc >= 100 ? 'var(--danger)' : (perc > 80 ? 'var(--warning)' : 'var(--primary-500)');
                            
                            return `
                            <div style="background: var(--slate-50); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--slate-100);">
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px;">
                                    <span style="color: var(--slate-700);">${cat}</span>
                                    <span style="color: var(--slate-900);">₺${spent.toLocaleString('tr-TR')} / ${limit > 0 ? '₺'+limit.toLocaleString('tr-TR') : 'Limit Yok'}</span>
                                </div>
                                <div style="height: 6px; background: var(--slate-200); border-radius: var(--radius-full); overflow: hidden;">
                                    <div style="height: 100%; width: ${perc}%; background: ${colorClass}; transition: width 0.5s ease;"></div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            // MANAGER VIEW
            html += `
                <!-- MANAGER: BUDGET KPI CARDS -->
                <div class="kpi-grid" style="margin-bottom: 32px;">
                    <div class="kpi-card" style="background: white; border: 1px solid var(--slate-200);">
                        <div class="kpi-icon" style="background: var(--slate-100); color: var(--slate-600);"><i data-lucide="target"></i></div>
                        <div class="kpi-label" style="font-weight: 600; text-transform: uppercase;">Toplam Gider Limiti</div>
                        <div class="kpi-value" style="font-size: 2rem;">₺${totalPlannedBudget.toLocaleString('tr-TR')}</div>
                    </div>
                    <div class="kpi-card" style="background: white; border: 1px solid var(--slate-200);">
                        <div class="kpi-icon" style="background: var(--primary-100); color: var(--primary-600);"><i data-lucide="receipt"></i></div>
                        <div class="kpi-label" style="font-weight: 600; text-transform: uppercase;">Gerçekleşen Harcama</div>
                        <div class="kpi-value" style="font-size: 2rem; color: var(--primary-700);">₺${extraExpense.toLocaleString('tr-TR')}</div>
                    </div>
                    <div class="kpi-card" style="background: white; border: 2px solid ${budgetUsagePercent >= 100 ? 'var(--danger)' : 'var(--success)'}; position: relative;">
                        <div class="kpi-icon" style="background: ${budgetUsagePercent >= 100 ? 'var(--danger)' : 'var(--success)'}; color: white;"><i data-lucide="wallet"></i></div>
                        <div class="kpi-label" style="font-weight: 600; text-transform: uppercase;">Kalan Bütçe</div>
                        <div class="kpi-value" style="font-size: 2rem; color: ${budgetUsagePercent >= 100 ? 'var(--danger)' : 'var(--success)'};">₺${remainingBudget.toLocaleString('tr-TR')}</div>
                        <div style="margin-top: 12px; height: 6px; background: var(--slate-100); border-radius: var(--radius-full); overflow: hidden;">
                            <div style="height: 100%; width: ${budgetUsagePercent}%; background: ${budgetUsagePercent >= 100 ? 'var(--danger)' : (budgetUsagePercent > 80 ? 'var(--warning)' : 'var(--success)')}; transition: width 0.5s ease;"></div>
                        </div>
                        ${pendingExpense > 0 ? `<div style="font-size: 0.75rem; color: var(--warning); margin-top: 8px; display: flex; align-items: center; gap: 4px;"><i data-lucide="clock" style="width:12px;"></i> Onay Bekleyen: ₺${pendingExpense.toLocaleString('tr-TR')}</div>` : ''}
                    </div>
                </div>

                <!-- MANAGER: CATEGORY PROGRESS BARS -->
                <div class="card" style="margin-bottom: 24px; padding: 24px;">
                     <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--slate-800); margin-bottom: 20px;">Kategori Bazlı Harcama Durumu</h3>
                     <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                        ${EXPENSE_CATEGORIES.map(cat => {
                            const limit = Number(budgetLimits[cat] || 0);
                            const spent = categoryExpenses[cat] || 0;
                            // Only show if there's a limit or some spending
                            if (limit === 0 && spent === 0) return '';
                            
                            const perc = limit > 0 ? Math.min(100, Math.round((spent/limit)*100)) : (spent > 0 ? 100 : 0);
                            const colorClass = perc >= 100 ? 'var(--danger)' : (perc > 80 ? 'var(--warning)' : 'var(--primary-500)');
                            
                            return `
                            <div style="background: var(--slate-50); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--slate-100);">
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px;">
                                    <span style="color: var(--slate-700);">${cat}</span>
                                    <span style="color: var(--slate-900);">₺${spent.toLocaleString('tr-TR')} / ${limit > 0 ? '₺'+limit.toLocaleString('tr-TR') : 'Limit Yok'}</span>
                                </div>
                                <div style="height: 6px; background: var(--slate-200); border-radius: var(--radius-full); overflow: hidden;">
                                    <div style="height: 100%; width: ${perc}%; background: ${colorClass}; transition: width 0.5s ease;"></div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // EXPENSE/INCOME LIST FOR BOTH
        html += `
            <div class="card">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <h3 class="card-title">${isAdmin ? 'Tüm İşlemler (Gelir / Gider)' : 'Saha Harcamalarım'}</h3>
                    <div style="display: flex; gap: 8px;">
                        ${isAdmin ? `<button class="btn btn-secondary btn-sm" id="btnExportBudgetPdf"><i data-lucide="file-down" style="width:14px;"></i> PDF Raporu İndir</button>` : ''}
                        ${(!isLocked || isAdmin) ? `
                        <button class="btn btn-primary btn-sm" id="btnAddBudget">
                            <i data-lucide="plus" style="width:14px;"></i> ${isAdmin ? 'Yeni İşlem Ekle' : 'Fiş / Masraf Ekle'}
                        </button>
                        ` : ''}
                    </div>
                </div>
                <div class="table-container">
                    <div style="overflow-x: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Durum</th>
                                <th>Tür</th>
                                <th>Kategori</th>
                                <th>Açıklama</th>
                                <th>Tarih</th>
                                <th>Tutar (₺)</th>
                                <th>İşlemi Yapan</th>
                                <th style="text-align:right;">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${budgets.length === 0 ? `<tr><td colspan="8" style="text-align:center; padding: 32px; color:var(--slate-400);">Henüz kayıt bulunmuyor.</td></tr>` : ''}
                            ${budgets.filter(b => isAdmin || b.type === 'expense').map(b => {
                                const stat = b.status || 'approved';
                                let statBadge = '';
                                if (stat === 'approved') statBadge = '<span class="badge badge-success"><i data-lucide="check" style="width:10px;"></i> Onaylandı</span>';
                                else if (stat === 'pending') statBadge = '<span class="badge badge-warning"><i data-lucide="clock" style="width:10px;"></i> Bekliyor</span>';
                                else if (stat === 'rejected') statBadge = '<span class="badge badge-danger"><i data-lucide="x" style="width:10px;"></i> Reddedildi</span>';

                                return `
                                <tr style="opacity: ${stat === 'rejected' ? '0.6' : '1'};">
                                    <td>${statBadge}</td>
                                    <td>
                                        <span class="badge ${b.type === 'income' ? 'badge-success' : 'badge-gray'}">
                                            ${b.type === 'income' ? 'Gelir' : 'Gider'}
                                        </span>
                                    </td>
                                    <td><strong>${b.category}</strong></td>
                                    <td>${b.description || '-'}</td>
                                    <td>${new Date(b.createdAt).toLocaleDateString('tr-TR')}</td>
                                    <td style="font-weight: 700; color: ${b.type === 'income' ? 'var(--success)' : 'var(--slate-800)'}; text-decoration: ${stat === 'rejected' ? 'line-through' : 'none'};">
                                        ${b.type === 'income' ? '+' : '-'}₺${Number(b.amount).toLocaleString('tr-TR')}
                                    </td>
                                    <td style="font-size: 0.8rem; color: var(--slate-500);">${b.createdBy || '-'}</td>
                                    <td style="text-align:right;">
                                        ${(!isAdmin && stat === 'rejected' && !isLocked) ? `<button class="btn btn-ghost btn-icon btn-resubmit-budget" data-id="${b.id}" style="color:var(--primary-600);" title="Düzelt ve Tekrar Gönder"><i data-lucide="refresh-cw" style="width:16px;"></i></button>` : ''}
                                        ${(!isLocked || isAdmin) ? `<button class="btn btn-ghost btn-icon btn-delete-budget" data-id="${b.id}" style="color:var(--danger);" title="Sil"><i data-lucide="trash-2" style="width:16px;"></i></button>` : ''}
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
            </div> <!-- page-fade-in -->
        `;

        container.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        initSearchableSelects(container);

        // Chart Rendering
        if (isAdmin && extraExpense > 0) {
            const chartLabels = [];
            const chartData = [];
            EXPENSE_CATEGORIES.forEach(c => {
                if (categoryExpenses[c] > 0) {
                    chartLabels.push(c);
                    chartData.push(categoryExpenses[c]);
                }
            });
            setTimeout(() => {
                createDoughnutChart('expenseDoughnutChart', {
                    labels: chartLabels,
                    data: chartData,
                    colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b']
                });
            }, 100);
        }

        // Unlock Budget (Admin Only)
        if (isAdmin) {
            const btnUnlock = container.querySelector('#btnUnlockBudget');
            if (btnUnlock) {
                btnUnlock.addEventListener('click', () => {
                    DB.events.update(selectedEventId, { budgetLastApprovedAt: new Date().toISOString() });
                    
                    const toastContainer = document.getElementById('toastContainer');
                    if (toastContainer) {
                        const t = document.createElement('div');
                        t.className = 'toast toast-success';
                        t.innerHTML = '<i data-lucide="unlock"></i> Bütçe kilidi açıldı ve haftalık onay verildi.';
                        toastContainer.appendChild(t);
                        if (typeof lucide !== 'undefined') lucide.createIcons({nodes:[t]});
                        setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
                    }
                    render();
                });
            }
        }

        // Event Select
        const sel = container.querySelector('#eventSelector');
        if(sel) {
            sel.addEventListener('change', (e) => {
                selectedEventId = e.target.value;
                render();
            });
        }

        // Edit Budget Limits (Admin Only)
        if (isAdmin) {
            const btnEditLimits = container.querySelector('#btnEditLimits');
            if (btnEditLimits) {
                btnEditLimits.addEventListener('click', () => {
                    const formHTML = `
                        <div style="margin-bottom:16px; font-size:0.85rem; color:var(--slate-500);">Kategoriler için planlanan maksimum harcama limitlerini belirleyin. 0 olanlar "Limit Yok" sayılır.</div>
                        <form id="limitForm" style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
                            ${EXPENSE_CATEGORIES.map(cat => `
                                <div class="form-group" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--slate-100); padding-bottom:12px; margin-bottom:12px;">
                                    <label class="form-label" style="margin:0; font-size: 0.9rem;">${cat}</label>
                                    <input type="number" class="form-input" style="width: 150px;" data-cat="${cat}" value="${budgetLimits[cat] || 0}" min="0">
                                </div>
                            `).join('')}
                        </form>
                    `;
                    openModal({
                        title: 'Bütçe Limitlerini Düzenle',
                        content: formHTML,
                        saveText: 'Kaydet',
                        onSave: () => {
                            const newLimits = {};
                            document.querySelectorAll('#limitForm input').forEach(input => {
                                newLimits[input.dataset.cat] = Number(input.value) || 0;
                            });
                            DB.events.update(selectedEventId, { budgetLimits: newLimits });
                            closeModal();
                            const toastContainer = document.getElementById('toastContainer');
                            if (toastContainer) {
                                const t = document.createElement('div');
                                t.className = 'toast toast-success';
                                t.innerHTML = '<i data-lucide="check-circle"></i> Limitler güncellendi.';
                                toastContainer.appendChild(t);
                                if (typeof lucide !== 'undefined') lucide.createIcons({nodes:[t]});
                                setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
                            }
                            render();
                        }
                    });
                });
            }

            // PDF Export
            const btnPdf = container.querySelector('#btnExportBudgetPdf');
            if (btnPdf) {
                btnPdf.addEventListener('click', () => {
                    try {
                        const { jsPDF } = window.jspdf;
                        const doc = new jsPDF();
                        doc.setFontSize(18);
                        doc.text(`${event.name || 'Organizasyon'} - Bütçe Raporu`, 14, 20);
                        doc.setFontSize(10);
                        doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);
                        
                        doc.setFontSize(13);
                        doc.text('Finansal Ozet', 14, 40);
                        doc.autoTable({
                            startY: 44,
                            head: [['Kalem', 'Tutar']],
                            body: [
                                ['Toplam Gelir', '\u20ba' + totalRevenue.toLocaleString('tr-TR')],
                                ['Toplam Gider', '\u20ba' + extraExpense.toLocaleString('tr-TR')],
                                ['Net Durum (Kar / Zarar)', '\u20ba' + netProfit.toLocaleString('tr-TR')]
                            ],
                            theme: 'grid',
                            headStyles: { fillColor: [59, 130, 246] }
                        });
                        
                        let y = doc.lastAutoTable.finalY + 12;
                        doc.setFontSize(13);
                        doc.text('Gelir / Gider Kalemleri', 14, y);
                        const budgetRows = budgets.map(b => {
                            const desc = b.description ? String(b.description).replace(/ç/g,'c').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ü/g,'u').replace(/Ç/g,'C').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/İ/g,'I').replace(/Ö/g,'O').replace(/Ü/g,'U') : '-';
                            const cat = b.category ? String(b.category).replace(/ç/g,'c').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ü/g,'u').replace(/Ç/g,'C').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/İ/g,'I').replace(/Ö/g,'O').replace(/Ü/g,'U') : '-';
                            const user = b.createdBy ? String(b.createdBy).replace(/ç/g,'c').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ü/g,'u').replace(/Ç/g,'C').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/İ/g,'I').replace(/Ö/g,'O').replace(/Ü/g,'U') : '-';
                            
                            return [
                                b.type === 'income' ? 'Gelir' : 'Gider', cat, desc,
                                new Date(b.createdAt).toLocaleDateString('tr-TR'), (b.type === 'income' ? '+' : '-') + '\u20ba' + Number(b.amount).toLocaleString('tr-TR'),
                                user
                            ];
                        });
                        doc.autoTable({
                            startY: y + 4,
                            head: [['Tur', 'Kategori', 'Aciklama', 'Tarih', 'Tutar', 'Islemi Yapan']],
                            body: budgetRows,
                            theme: 'grid',
                            headStyles: { fillColor: [245, 158, 11] },
                            styles: { fontSize: 9 }
                        });

                        doc.save(`${event.name || 'organizasyon'}_butce_raporu.pdf`);
                    } catch(err) {
                        console.error('PDF error', err);
                    }
                });
            }
        }

        // Add Expense/Income
        const btnAdd = container.querySelector('#btnAddBudget');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const formHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">İşlem Türü</label>
                            <select id="budType" class="form-select" ${isAdmin ? '' : 'disabled'}>
                                ${isAdmin ? '<option value="income">Gelir</option>' : ''}
                                <option value="expense" ${!isAdmin ? 'selected' : ''}>Gider / Masraf</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kategori</label>
                            <select id="budCategory" class="form-select">
                                ${isAdmin ? '<option value="Sponsorluk">Sponsorluk</option>' : ''}
                                ${EXPENSE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Açıklama / Fiş Detayı</label>
                        <input type="text" id="budDesc" class="form-input" placeholder="Taksi, fatura no vb...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tutar (₺)</label>
                        <input type="number" id="budAmount" class="form-input" value="">
                    </div>
                    ${!isAdmin ? `<div style="font-size:0.8rem; color:var(--warning); margin-top:8px;"><i data-lucide="info" style="width:12px;"></i> Bu masraf yönetici onayından sonra bütçeye işlenecektir.</div>` : ''}
                `;
                openModal({
                    title: isAdmin ? 'Yeni İşlem Ekle' : 'Masraf Fişi Ekle',
                    content: formHTML,
                    width: '500px',
                    saveText: isAdmin ? 'Kaydet' : 'Onaya Gönder',
                    onSave: () => {
                        const amount = Number(document.getElementById('budAmount').value);
                        if (amount <= 0) {
                            alert('Lütfen geçerli bir tutar giriniz.');
                            return;
                        }
                        DB.budgets.create({
                            eventId: selectedEventId,
                            type: type,
                            category: category,
                            description: description,
                            amount: amount,
                            status: isAdmin ? 'approved' : 'pending',
                            createdBy: currentUser?.name || 'Bilinmiyor'
                        });
                        DB.logs.add(`Bütçeye yeni bir ${type === 'income' ? 'gelir' : 'gider'} kalemi eklendi: ${description} (${amount}₺)`, 'success');
                        closeModal();
                        render();
                    }
                });
            });
        }

        // Approval Logic
        container.querySelectorAll('.btn-approve-budget').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                DB.budgets.update(id, { status: 'approved' });
                render();
            });
        });

        container.querySelectorAll('.btn-reject-budget').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (window.confirm('Bu masrafı reddetmek istediğinize emin misiniz?')) {
                    const id = e.currentTarget.dataset.id;
                    DB.budgets.update(id, { status: 'rejected' });
                    render();
                }
            });
        });

        // Resubmit Logic (Manager)
        container.querySelectorAll('.btn-resubmit-budget').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const b = DB.budgets.getAll().find(x => x.id === id);
                if (!b) return;

                const formHTML = `
                    <div class="form-group">
                        <label class="form-label">Kategori</label>
                        <select id="budCategory" class="form-select">
                            ${EXPENSE_CATEGORIES.map(c => `<option value="${c}" ${c === b.category ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Açıklama / Fiş Detayı</label>
                        <input type="text" id="budDesc" class="form-input" value="${b.description || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tutar (₺)</label>
                        <input type="number" id="budAmount" class="form-input" value="${b.amount}">
                    </div>
                `;
                openModal({
                    title: 'Düzelt ve Tekrar Gönder',
                    content: formHTML,
                    width: '500px',
                    saveText: 'Onaya Gönder',
                    onSave: () => {
                        const amount = Number(document.getElementById('budAmount').value);
                        if (amount <= 0) return alert('Geçerli bir tutar girin.');
                        DB.budgets.update(id, {
                            category: document.getElementById('budCategory').value,
                            description: document.getElementById('budDesc').value,
                            amount: amount,
                            status: 'pending'
                        });
                        closeModal();
                        render();
                    }
                });
            });
        });

        // Delete Logic
        container.querySelectorAll('.btn-delete-budget').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (window.confirm('Bu bütçe kalemini silmek istediğinize emin misiniz?')) {
                    const id = e.currentTarget.dataset.id;
                    const item = DB.budgets.getAll().find(b => b.id === id);
                    if (item) {
                        DB.logs.add(`Bütçe kalemi silindi: ${item.description}`, 'warning');
                    }
                    DB.budgets.delete(id);
                    render();
                }
            });
        });
    };

    render();
}
