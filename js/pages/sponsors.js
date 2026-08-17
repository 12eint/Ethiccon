import { DB } from '../db.js';
import { openModal, closeModal } from '../components/modal.js';
import { initSearchableSelects } from '../app.js';

const PACKAGES = [
    { id: 'ana-sponsor', name: 'Ana Sponsor', color: 'var(--primary-600)' },
    { id: 'platin', name: 'Platin Sponsor', color: '#94a3b8' },
    { id: 'gold', name: 'Altın Sponsor', color: '#f59e0b' },
    { id: 'silver', name: 'Gümüş Sponsor', color: '#64748b' },
    { id: 'stand', name: 'Stand Katılımı', color: '#3b82f6' }
];

export function renderSponsors(container) {
    const events = DB.events.getAll();
    if (events.length === 0) {
        container.innerHTML = `<div class="card" style="padding:48px; text-align:center;">Hiç organizasyon bulunamadı.</div>`;
        return;
    }

    let selectedEventId = events[0].id;

    const render = () => {
        const sponsors = DB.sponsors.getByEventId(selectedEventId);
        
        let html = `
            <div class="page-fade-in">
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--slate-900);">Sponsor & Sergi Yönetimi</h2>
                        <p style="color: var(--slate-500); font-size: 0.875rem;">Etkinlik sponsorlukları, stand tahsisleri ve sözleşmeleri yönetin.</p>
                    </div>
                    <div>
                        <select class="form-select searchable-select" id="eventSelector" style="width: 300px; font-weight: 600; font-size: 0.95rem; box-shadow: var(--shadow-sm);">
                            ${events.map(e => `<option value="${e.id}" ${e.id === selectedEventId ? 'selected' : ''}>${e.name}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 class="card-title">Sponsor Listesi</h3>
                        <button class="btn btn-primary btn-sm" id="btnAddSponsor">
                            <i data-lucide="plus" style="width:16px;"></i> Yeni Sponsor Ekle
                        </button>
                    </div>
                    
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Firma Adı</th>
                                    <th>Paket</th>
                                    <th>Sözleşme Tutarı</th>
                                    <th>Stand Alanı (m²)</th>
                                    <th>İletişim</th>
                                    <th style="text-align:right;">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sponsors.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding: 32px; color:var(--slate-400);">Kayıtlı sponsor bulunmuyor.</td></tr>` : ''}
                                ${sponsors.map(s => {
                                    const pkg = PACKAGES.find(p => p.id === s.packageType) || PACKAGES[4];
                                    return `
                                    <tr>
                                        <td><strong>${s.companyName}</strong></td>
                                        <td>
                                            <span class="badge" style="background-color: ${pkg.color}15; color: ${pkg.color}; border: 1px solid ${pkg.color}30;">
                                                ${pkg.name}
                                            </span>
                                        </td>
                                        <td style="font-weight:600; color:var(--success);">
                                            ${s.amount ? '₺' + Number(s.amount).toLocaleString('tr-TR') : '-'}
                                        </td>
                                        <td>${s.standArea ? s.standArea + ' m²' : '-'}</td>
                                        <td>
                                            <div style="font-size:0.8rem; font-weight:600;">${s.contactPerson || '-'}</div>
                                            <div style="font-size:0.75rem; color:var(--slate-500);">${s.contactEmail || ''}</div>
                                        </td>
                                        <td style="text-align:right;">
                                            <button class="btn btn-ghost btn-icon btn-delete-sponsor" data-id="${s.id}" style="color:var(--danger);" title="Sil">
                                                <i data-lucide="trash-2" style="width:16px;"></i>
                                            </button>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        initSearchableSelects(container);

        // Event Selector
        const sel = container.querySelector('#eventSelector');
        if (sel) {
            sel.addEventListener('change', (e) => {
                selectedEventId = e.target.value;
                render();
            });
        }

        // Add Sponsor
        const btnAdd = container.querySelector('#btnAddSponsor');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const formHTML = `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Sponsor Firma Adı *</label>
                            <input type="text" id="spCompany" class="form-input" placeholder="Örn: X İlaç A.Ş.">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Sponsorluk Paketi</label>
                            <select id="spPackage" class="form-select">
                                ${PACKAGES.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Sözleşme Tutarı (₺) *</label>
                            <input type="number" id="spAmount" class="form-input" placeholder="0.00" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tahsis Edilen Stand (m²)</label>
                            <input type="number" id="spStand" class="form-input" placeholder="Örn: 9">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">İletişim Kişisi</label>
                            <input type="text" id="spContactName" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">İletişim E-posta</label>
                            <input type="email" id="spContactEmail" class="form-input">
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--info); display: flex; gap: 6px; padding: 12px; background: var(--info-light); border-radius: var(--radius-md);">
                        <i data-lucide="info" style="width: 16px; flex-shrink: 0;"></i>
                        <span>Sözleşme tutarı, Finansal Kokpit (Bütçe) ekranına otomatik olarak "Sponsorluk Geliri" şeklinde işlenecektir.</span>
                    </div>
                `;

                openModal({
                    title: 'Yeni Sponsor Ekle',
                    content: formHTML,
                    width: '600px',
                    saveText: 'Kaydet',
                    onSave: () => {
                        const companyName = document.getElementById('spCompany').value.trim();
                        const amount = Number(document.getElementById('spAmount').value);
                        
                        if (!companyName || amount <= 0) {
                            alert('Lütfen firma adını ve geçerli bir tutar girin.');
                            return;
                        }

                        const pkgId = document.getElementById('spPackage').value;
                        const pkg = PACKAGES.find(p => p.id === pkgId);

                        // 1. Create Sponsor
                        DB.sponsors.create({
                            eventId: selectedEventId,
                            companyName: companyName,
                            packageType: pkgId,
                            amount: amount,
                            standArea: document.getElementById('spStand').value,
                            contactPerson: document.getElementById('spContactName').value,
                            contactEmail: document.getElementById('spContactEmail').value,
                            status: 'confirmed'
                        });

                        // 2. Automatically Inject into Budget
                        const currentUser = DB.users.getCurrentUser();
                        DB.budgets.create({
                            eventId: selectedEventId,
                            type: 'income',
                            category: 'Sponsorluk',
                            description: companyName + ' (' + pkg.name + ')',
                            amount: amount,
                            status: 'approved', // Auto-approved as it is system generated
                            createdBy: currentUser?.name || 'Sistem'
                        });

                        closeModal();
                        
                        // Toast
                        const toastContainer = document.getElementById('toastContainer');
                        if (toastContainer) {
                            const t = document.createElement('div');
                            t.className = 'toast toast-success';
                            t.innerHTML = '<i data-lucide="check-circle"></i> Sponsor başarıyla eklendi ve bütçeye işlendi.';
                            toastContainer.appendChild(t);
                            if (typeof lucide !== 'undefined') lucide.createIcons({nodes:[t]});
                            setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3500);
                        }

                        render();
                    }
                });
            });
        }

        // Delete Sponsor
        container.querySelectorAll('.btn-delete-sponsor').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (window.confirm('Bu sponsoru silmek istediğinize emin misiniz? (Not: Bütçeye işlenen gelir otomatik olarak silinmez, bütçe sayfasından manuel silmeniz gerekir)')) {
                    const id = e.currentTarget.dataset.id;
                    DB.sponsors.delete(id);
                    render();
                }
            });
        });
    };

    render();
}
