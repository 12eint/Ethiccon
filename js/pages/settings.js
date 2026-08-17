import { DB } from '../db.js';

export function renderSettings(container) {
    const currentUser = DB.users.getCurrentUser();
    if (currentUser?.role !== 'admin') {
        container.innerHTML = `<div class="card" style="padding:48px; text-align:center; color:var(--danger);">Bu sayfayı görüntüleme yetkiniz yok.</div>`;
        return;
    }

    const settings = DB.settings.get();

    const html = `
        <div class="page-fade-in">
            <div class="page-header" style="margin-bottom: 24px;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--slate-900);">Sistem Ayarları</h2>
                <p style="color: var(--slate-500); font-size: 0.875rem;">Acente bilgileri, faturaya yansıyacak detaylar ve veritabanı yedekleme işlemleri</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start;">
                <!-- Agency Settings -->
                <div class="card" style="padding: 24px;">
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid var(--slate-100); padding-bottom: 12px;">
                        <i data-lucide="building" style="width:18px; display:inline-block; vertical-align:middle; margin-right:8px;"></i> Acente Bilgileri
                    </h3>
                    <div class="form-group">
                        <label class="form-label">Acente Unvanı</label>
                        <input type="text" id="stgAgencyName" class="form-input" value="${settings.agencyName || ''}" placeholder="Örn: X Turizm Seyahat Acentesi">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Fatura Adresi</label>
                        <textarea id="stgAgencyAddress" class="form-textarea" rows="2" placeholder="Acente tam fatura adresi...">${settings.agencyAddress || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">IBAN Bilgileri (Proforma için)</label>
                        <textarea id="stgAgencyIban" class="form-textarea" rows="3" placeholder="Örn: TR12 3456... Garanti Bankası">${settings.agencyIban || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Acente Logosu (Proforma Fatura Başlığı)</label>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <div style="width: 80px; height: 80px; border: 1px dashed var(--slate-300); border-radius: var(--radius-md); display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--slate-50);">
                                ${settings.agencyLogo ? `<img src="${settings.agencyLogo}" style="max-width:100%; max-height:100%; object-fit:contain;">` : `<i data-lucide="image" style="color:var(--slate-300);"></i>`}
                            </div>
                            <div style="flex:1;">
                                <input type="file" id="stgLogoUpload" accept="image/png, image/jpeg" style="display:none;">
                                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('stgLogoUpload').click()">
                                    <i data-lucide="upload"></i> Logo Seç
                                </button>
                                <p style="font-size:0.75rem; color:var(--slate-400); margin-top:8px;">Sadece yatay, şeffaf arka planlı PNG/JPG (Maks 1MB)</p>
                            </div>
                        </div>
                        <input type="hidden" id="stgLogoBase64" value="${settings.agencyLogo || ''}">
                    </div>
                    
                    <div style="margin-top: 24px; text-align: right;">
                        <button class="btn btn-primary" id="btnSaveSettings">
                            <i data-lucide="save"></i> Ayarları Kaydet
                        </button>
                    </div>
                </div>

                <!-- Database Backup -->
                <div class="card" style="padding: 24px; border: 1px solid var(--info-light);">
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid var(--slate-100); padding-bottom: 12px; color: var(--info);">
                        <i data-lucide="database" style="width:18px; display:inline-block; vertical-align:middle; margin-right:8px;"></i> Veritabanı Yedekleme (Master Backup)
                    </h3>
                    
                    <p style="font-size: 0.85rem; color: var(--slate-600); margin-bottom: 24px;">
                        Tüm organizasyon, bütçe, uçak ve misafir verileriniz tarayıcınızda (Local Storage) tutulmaktadır. 
                        Veri kaybını önlemek için düzenli olarak yedek almanız tavsiye edilir.
                    </p>

                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <button class="btn btn-primary" id="btnExportDb" style="justify-content:center; background-color: var(--success); box-shadow:none;">
                            <i data-lucide="download"></i> Tüm Sistemi İndir (.json)
                        </button>
                        
                        <div style="position: relative; margin-top: 16px; padding-top: 24px; border-top: 1px dashed var(--slate-200);">
                            <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 12px;">Sistemi Geri Yükle</h4>
                            <p style="font-size: 0.8rem; color: var(--danger); margin-bottom: 12px;">
                                <strong>DİKKAT:</strong> Bu işlem mevcut tüm verilerinizi siler ve yüklediğiniz dosyadaki verileri yazar!
                            </p>
                            <input type="file" id="stgImportUpload" accept=".json" style="display:none;">
                            <button class="btn btn-secondary" style="width: 100%; justify-content:center; color: var(--danger); border-color: var(--danger-light);" onclick="document.getElementById('stgImportUpload').click()">
                                <i data-lucide="upload-cloud"></i> Yedekten Yükle
                            </button>
                        </div>
                    </div>
                </div>
                <!-- Role & Permissions Builder -->
                <div class="card" style="padding: 24px;">
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid var(--slate-100); padding-bottom: 12px; color: var(--primary-700);">
                        <i data-lucide="shield" style="width:18px; display:inline-block; vertical-align:middle; margin-right:8px;"></i> Rol ve Yetki Yönetimi
                    </h3>
                    <p style="font-size: 0.85rem; color: var(--slate-600); margin-bottom: 16px;">
                        "Operasyon Sorumlusu (Staff)" hesabı için sistemde hangi sayfaların ve aksiyonların aktif olacağını belirleyin.
                    </p>
                    <div id="roleBuilderForm" style="display: flex; flex-direction: column; gap: 12px; background: var(--slate-50); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--slate-200);">
                        <!-- Rendered by JS -->
                    </div>
                    <div style="margin-top: 16px; text-align: right;">
                        <button class="btn btn-primary" id="btnSaveRoles">
                            <i data-lucide="save"></i> Yetkileri Güncelle
                        </button>
                    </div>
                </div>

            </div>
        </div>
    `;

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Image Upload to Base64
    const logoUpload = container.querySelector('#stgLogoUpload');
    if (logoUpload) {
        logoUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.size > 1024 * 1024) {
                alert("Logo boyutu 1MB'den küçük olmalıdır!");
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                container.querySelector('#stgLogoBase64').value = base64;
                // Preview
                const previewContainer = logoUpload.parentElement.previousElementSibling;
                previewContainer.innerHTML = `<img src="${base64}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
            };
            reader.readAsDataURL(file);
        });
    }

    // Save Settings
    container.querySelector('#btnSaveSettings').addEventListener('click', () => {
        const newData = {
            agencyName: document.getElementById('stgAgencyName').value.trim(),
            agencyAddress: document.getElementById('stgAgencyAddress').value.trim(),
            agencyIban: document.getElementById('stgAgencyIban').value.trim(),
            agencyLogo: document.getElementById('stgLogoBase64').value
        };
        
        DB.settings.save(newData);
        
        const toastContainer = document.getElementById('toastContainer');
        const t = document.createElement('div');
        t.className = 'toast toast-success';
        t.innerHTML = '<i data-lucide="check-circle"></i> Ayarlar kaydedildi!';
        toastContainer.appendChild(t);
        if (typeof lucide !== 'undefined') lucide.createIcons({nodes:[t]});
        setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
    });

    // --- Role Builder Logic ---
    const users = DB.users.getAll();
    const staffUser = users.find(u => u.role === 'staff');
    const staffPerms = staffUser?.permissions || [];

    const availablePermissions = [
        { id: 'view_budget', label: 'Bütçe Modülünü Görüntüleme' },
        { id: 'view_proforma', label: 'Proforma Faturaları Görüntüleme' },
        { id: 'view_settings', label: 'Ayarlar Sayfasına Erişim' },
        { id: 'delete_pax', label: 'Misafir (Katılımcı) Kaydı Silebilme' },
        { id: 'export_excel', label: 'Katılımcı Listesini Excel Olarak İndirebilme' }
    ];

    const roleBuilderContainer = container.querySelector('#roleBuilderForm');
    if (roleBuilderContainer && staffUser) {
        roleBuilderContainer.innerHTML = availablePermissions.map(p => `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem;">
                <input type="checkbox" class="perm-checkbox" value="${p.id}" ${staffPerms.includes(p.id) ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary-600);">
                ${p.label}
            </label>
        `).join('');
    }

    container.querySelector('#btnSaveRoles')?.addEventListener('click', () => {
        const checkboxes = container.querySelectorAll('.perm-checkbox:checked');
        const newPerms = Array.from(checkboxes).map(cb => cb.value);
        // Base permissions that staff always has
        const basePerms = ['view_participants', 'add_participants'];
        
        DB.users.update(staffUser.id, { permissions: [...basePerms, ...newPerms] });
        
        const toastContainer = document.getElementById('toastContainer');
        const t = document.createElement('div');
        t.className = 'toast toast-success';
        t.innerHTML = '<i data-lucide="check-circle"></i> Yetkiler güncellendi!';
        toastContainer.appendChild(t);
        if (typeof lucide !== 'undefined') lucide.createIcons({nodes:[t]});
        setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
    });

    // Export DB
    container.querySelector('#btnExportDb').addEventListener('click', () => {
        const allData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('ethiccon_')) {
                allData[key] = localStorage.getItem(key);
            }
        }
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `ethiccon_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        document.body.removeChild(dlAnchorElem);
    });

    // Import DB
    const importUpload = container.querySelector('#stgImportUpload');
    if (importUpload) {
        importUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!confirm('Emin misiniz? Mevcut TÜM verileriniz silinecek ve seçtiğiniz dosyadaki veriler yüklenecektir.')) {
                e.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    // Clear existing ethiccon keys
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        if (localStorage.key(i).startsWith('ethiccon_')) keysToRemove.push(localStorage.key(i));
                    }
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    
                    // Import new
                    for (const key in data) {
                        localStorage.setItem(key, data[key]);
                    }
                    
                    alert('Veriler başarıyla yüklendi. Sistem yeniden başlatılacak.');
                    window.location.reload();
                } catch (err) {
                    alert('Geçersiz veya bozuk yedek dosyası!');
                    console.error(err);
                }
            };
            reader.readAsText(file);
        });
    }
}
