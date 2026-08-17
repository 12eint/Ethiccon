import { DB } from '../db.js';
import { renderTopbar } from '../components/topbar.js';
import { openModal, closeModal } from '../components/modal.js';

export function renderCompaniesPage(container) {
    const topbarContainer = document.getElementById('topbar');
    if (topbarContainer) {
        renderTopbar(topbarContainer, { title: 'Firmalar', subtitle: 'Sistemde kayıtlı firma veritabanı' });
    }

    const companies = DB.companies.getAll();

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--slate-900);">Firma Listesi</h2>
                <p style="color: var(--slate-500); font-size: 0.875rem; margin-top: 4px;">Kayıt ve konaklama işlemlerinde kullanılacak firmalar</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="btn btn-secondary" id="btnExportCompanies">
                    <i data-lucide="download"></i> Excel İndir
                </button>
                <button class="btn btn-primary" id="btnAddCompany">
                    <i data-lucide="plus"></i> Yeni Firma Ekle
                </button>
            </div>
        </div>

        <div class="card" style="animation: slideUp 0.4s ease;">
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Kısa Adı</th>
                            <th>Ticari Ünvan</th>
                            <th>Vergi Dairesi / No</th>
                            <th>İletişim Kişisi</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${companies.length === 0 ? `
                            <tr><td colspan="5" style="text-align: center; padding: 24px;">Kayıtlı firma bulunmuyor.</td></tr>
                        ` : companies.map(c => `
                            <tr>
                                <td><strong>${c.name}</strong></td>
                                <td>${c.commercialTitle || '-'}</td>
                                <td>
                                    <div style="font-size: 0.75rem;">
                                        <div>VD: ${c.taxOffice || '-'}</div>
                                        <div>VN: ${c.taxNumber || '-'}</div>
                                    </div>
                                </td>
                                <td>
                                    <div style="font-size: 0.75rem;">
                                        <div>${c.contactName || '-'}</div>
                                        <div>${c.contactPhone || '-'}</div>
                                    </div>
                                </td>
                                <td>
                                    <button class="btn btn-ghost btn-icon btn-edit-company" data-id="${c.id}" title="Düzenle"><i data-lucide="edit"></i></button>
                                    <button class="btn btn-danger btn-icon btn-delete-company" data-id="${c.id}" title="Sil"><i data-lucide="trash-2"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Initialize icons
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Add Company
    container.querySelector('#btnAddCompany').addEventListener('click', () => {
        openCompanyModal();
    });

    // Edit Company
    container.querySelectorAll('.btn-edit-company').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const company = DB.companies.getById(id);
            if (company) {
                openCompanyModal(company);
            }
        });
    });

    // Delete Company
    container.querySelectorAll('.btn-delete-company').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm('Bu firmayı silmek istediğinize emin misiniz?')) {
                DB.companies.delete(id);
                renderCompaniesPage(container);
            }
        });
    });

    // Export Excel
    container.querySelector('#btnExportCompanies').addEventListener('click', () => {
        const comps = DB.companies.getAll();
        if (comps.length === 0) {
            alert('Dışa aktarılacak firma bulunamadı.');
            return;
        }

        const exportData = comps.map(c => ({
            'Kısa Ad': c.name || '',
            'Ticari Ünvan': c.commercialTitle || '',
            'Vergi Dairesi': c.taxOffice || '',
            'Vergi No': c.taxNumber || '',
            'Adres': c.address || '',
            'Yetkili': c.contactName || '',
            'Telefon': c.contactPhone || ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Firmalar");
        XLSX.writeFile(wb, "firmalar.xlsx");
    });

    function openCompanyModal(existingCompany = null) {
        const isEdit = !!existingCompany;
        const c = existingCompany || {};

        const content = `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Kısa Adı (Zorunlu)</label>
                    <input type="text" class="form-input" id="compName" value="${c.name || ''}" placeholder="Örn: Novartis">
                </div>
                <div class="form-group">
                    <label class="form-label">Ticari Ünvan</label>
                    <input type="text" class="form-input" id="compTitle" value="${c.commercialTitle || ''}" placeholder="Resmi fatura ünvanı">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Vergi Dairesi</label>
                    <input type="text" class="form-input" id="compTaxOffice" value="${c.taxOffice || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Vergi Numarası</label>
                    <input type="text" class="form-input" id="compTaxNumber" value="${c.taxNumber || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Yetkili Kişi</label>
                    <input type="text" class="form-input" id="compContact" value="${c.contactName || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">İletişim Telefonu</label>
                    <input type="text" class="form-input" id="compPhone" value="${c.contactPhone || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="width: 100%;">
                    <label class="form-label">Adres</label>
                    <textarea class="form-input" id="compAddress" rows="3">${c.address || ''}</textarea>
                </div>
            </div>
        `;

        openModal({
            title: isEdit ? 'Firmayı Düzenle' : 'Yeni Firma Ekle',
            content: content,
            width: '600px',
            onSave: () => {
                const name = document.getElementById('compName').value;
                if (!name) {
                    alert('Lütfen firmanın kısa adını giriniz.');
                    return;
                }

                const data = {
                    name,
                    commercialTitle: document.getElementById('compTitle').value,
                    taxOffice: document.getElementById('compTaxOffice').value,
                    taxNumber: document.getElementById('compTaxNumber').value,
                    contactName: document.getElementById('compContact').value,
                    contactPhone: document.getElementById('compPhone').value,
                    address: document.getElementById('compAddress').value
                };

                if (isEdit) {
                    DB.companies.update(c.id, data);
                } else {
                    DB.companies.create(data);
                }

                closeModal();
                renderCompaniesPage(container);
            }
        });
    }
}
