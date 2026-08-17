import { DB } from '../../db.js';
import { openModal, closeModal } from '../../components/modal.js';
import { initSearchableSelects } from '../../app.js';

export function renderRegistrationModule(container, orgId) {
    const participants = DB.participants.getByEventId(orgId);
    const currentUser = DB.users.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';
    const perms = currentUser?.permissions || (isAdmin ? ['all'] : []);
    const hasPerm = (p) => perms.includes('all') || perms.includes(p);

    const event = DB.events.getById(orgId) || {};
    
    const earlyPrice = Number(event.earlyRegPrice) || 0;
    const latePrice = Number(event.lateRegPrice) || 0;

    let totalRegProfit = 0;
    if (isAdmin) {
        participants.forEach(p => {
            const price = p.regPeriod === 'custom' ? Number(p.regCustomPrice || 0) : (p.regPeriod === 'late' ? latePrice : earlyPrice);
            totalRegProfit += price;
        });
    }

    // Build price warning HTML
    const priceWarningHTML = (earlyPrice === 0 && latePrice === 0) ? `
            <div id="priceWarningBanner" style="background: var(--warning-light); border: 1px solid var(--warning); border-radius: var(--radius-md); padding: 12px 16px; margin: 16px 0; display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: #92400e;">
                <i data-lucide="alert-triangle" style="width:18px; height:18px;"></i>
                <span>⚠ Bu organizasyonun erken/geç kayıt fiyatı henüz belirlenmemiş. Lütfen organizasyon ayarlarından fiyatlandırmayı yapınız.</span>
            </div>` : '';

    // Build company list for filter dropdown
    const companySet = new Set();
    participants.forEach(p => { if (p.company) companySet.add(p.company); });
    const companyFilterOptions = Array.from(companySet).sort().map(c => `<option value="${c}">${c}</option>`).join('');

    container.innerHTML = `
        <div class="card" style="animation: slideInRight 0.3s ease;">
            <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
                <h3 class="card-title">Kayıt (Misafir) Yönetimi</h3>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="btn btn-secondary" id="btnDownloadTemplate">
                        <i data-lucide="download"></i> Excel Şablonu İndir
                    </button>
                    <label class="btn btn-secondary" style="cursor: pointer; margin: 0;">
                        <i data-lucide="upload"></i> Excel'den Yükle
                        <input type="file" id="fileUploadExcel" accept=".xlsx, .xls" style="display: none;">
                    </label>
                    <button class="btn btn-primary" id="btnManuelKayit">
                        <i data-lucide="user-plus"></i> Manuel Kayıt Ekle
                    </button>
                    <button class="btn btn-secondary btn-sm" id="btnExportRooming">
                        <i data-lucide="building"></i> Rooming List (Oda)
                    </button>
                    ${hasPerm('export_excel') ? `<button class="btn btn-secondary btn-sm" id="btnExportExcel">
                        <i data-lucide="file-down"></i> Excel'e Aktar
                    </button>` : ''}
                </div>
            </div>
            ${priceWarningHTML}
            <div id="regSearchToolbar" style="display: flex; gap: 12px; align-items: center; padding: 0 20px; margin-bottom: 12px; flex-wrap: wrap;">
                <div style="position: relative; flex: 1; min-width: 200px;">
                    <i data-lucide="search" style="width:15px;height:15px;opacity:0.4;position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;"></i>
                    <input type="text" id="regSearchInput" class="form-input" placeholder="İsim, soyisim, e-posta veya telefon ile ara..." style="padding-left:34px; height:36px; font-size:0.85rem;">
                </div>
                <select id="regCompanyFilter" class="form-select searchable-select" style="height:36px; font-size:0.85rem; min-width:160px; width:auto;">
                    <option value="">Tüm Firmalar</option>
                    ${companyFilterOptions}
                </select>
            </div>
            <div class="table-container">
                <div style="overflow-x: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Yetkili</th>
                                <th>Firma</th>
                                <th>İsim Soyisim</th>
                                <th>İletişim</th>
                                <th>TC / Pasaport</th>
                                <th>Kalkış Şehri</th>
                                <th>Kayıt Tipi / Satış</th>
                                <th>İşlemi Yapan</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody id="regTableBody">
                            ${participants.length === 0 ? `
                                <tr><td colspan="9" style="text-align: center; padding: 24px;">Kayıtlı misafir bulunmuyor.</td></tr>
                            ` : participants.map(p => {
                                const price = p.regPeriod === 'custom' ? Number(p.regCustomPrice || 0) : (p.regPeriod === 'late' ? latePrice : earlyPrice);
                                let periodLabel = '';
                                if (p.regPeriod === 'custom') periodLabel = '<span class="badge badge-purple">Özel Fiyat</span>';
                                else if (p.regPeriod === 'late') periodLabel = '<span class="badge badge-warning">Geç Kayıt</span>';
                                else periodLabel = '<span class="badge badge-success">Erken Kayıt</span>';
                                
                                const financeHTML = isAdmin 
                                    ? `<div style="margin-bottom:4px;">${periodLabel}</div>
                                       <div style="color: var(--success); font-weight: 600;">${price}₺</div>`
                                    : `<div style="margin-bottom:4px;">${periodLabel}</div>`;

                                return `
                                <tr data-search-name="${(p.firstName || '').toLowerCase()} ${(p.lastName || '').toLowerCase()}" data-search-email="${(p.email || '').toLowerCase()}" data-search-phone="${(p.phone || '').toLowerCase()}" data-search-company="${(p.company || '').toLowerCase()}">
                                    <td>${p.authorizedPerson || '-'}</td>
                                    <td>${p.company || '-'}</td>
                                    <td><strong>${p.firstName} ${p.lastName}</strong></td>
                                    <td>
                                        <div style="font-size: 0.75rem;">
                                            <div><i data-lucide="phone" style="width:12px; height:12px;"></i> ${p.phone || '-'}</div>
                                            <div><i data-lucide="mail" style="width:12px; height:12px;"></i> ${p.email || '-'}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style="font-size: 0.75rem;">
                                            <div>TC: ${p.tcNo || '-'}</div>
                                            <div>Pass: ${p.passportNo || '-'}</div>
                                        </div>
                                    </td>
                                    <td>${p.depCity || '-'}</td>
                                    <td>${financeHTML}</td>
                                    <td style="font-size: 0.75rem; color: var(--slate-500);"><i data-lucide="user" style="width:12px; height:12px;"></i> ${p.createdBy || '-'}</td>
                                    <td>
                                        <button class="btn btn-ghost btn-icon btn-edit-reg" data-id="${p.id}" title="Düzenle"><i data-lucide="edit"></i></button>
                                        ${hasPerm('delete_pax') ? `<button class="btn btn-ghost btn-icon btn-delete-reg" data-id="${p.id}" title="Sil" style="color:var(--danger);"><i data-lucide="trash-2"></i></button>` : ''}
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
        </div>
    `;

    initSearchableSelects(container);

    // Registration search & filter logic
    const regSearchInput = container.querySelector('#regSearchInput');
    const regCompanyFilter = container.querySelector('#regCompanyFilter');

    function filterRegTable() {
        const query = (regSearchInput.value || '').trim().toLowerCase();
        const company = (regCompanyFilter.value || '').toLowerCase();
        const rows = container.querySelectorAll('#regTableBody tr[data-search-name]');
        rows.forEach(row => {
            const name = row.dataset.searchName || '';
            const email = row.dataset.searchEmail || '';
            const phone = row.dataset.searchPhone || '';
            const comp = row.dataset.searchCompany || '';

            const matchesSearch = !query || name.includes(query) || email.includes(query) || phone.includes(query);
            const matchesCompany = !company || comp === company;

            row.style.display = (matchesSearch && matchesCompany) ? '' : 'none';
        });
    }

    regSearchInput.addEventListener('input', filterRegTable);
    regCompanyFilter.addEventListener('change', filterRegTable);

    // Download Template
    container.querySelector('#btnDownloadTemplate').addEventListener('click', () => {
        const wb = XLSX.utils.book_new();
        const wsData = [
            ['YETKİLİ', 'FİRMA', 'İSİM', 'SOYAD', 'MAİL ADRESİ', 'TELEFON', 'DOĞUM T.', 'TC NO', 'PASAPORT NO', 'GEÇERLİLİK TARİHİ', 'KALKIŞ ŞEHRİ']
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Kayıtlar");
        XLSX.writeFile(wb, "kayit_sablonu.xlsx");
    });

    // Excel Upload
    container.querySelector('#fileUploadExcel').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const workbook = XLSX.read(evt.target.result, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet);
                
                let added = 0;
                data.forEach(row => {
                    DB.participants.create({
                        eventId: orgId,
                        authorizedPerson: row['YETKİLİ'] || '',
                        company: row['FİRMA'] || '',
                        firstName: row['İSİM'] || '',
                        lastName: row['SOYAD'] || '',
                        email: row['MAİL ADRESİ'] || '',
                        phone: row['TELEFON'] || '',
                        birthDate: row['DOĞUM T.'] || '',
                        tcNo: row['TC NO'] || '',
                        passportNo: row['PASAPORT NO'] || '',
                        passportExpiry: row['GEÇERLİLİK TARİHİ'] || '',
                        depCity: row['KALKIŞ ŞEHRİ'] || '',
                        createdBy: currentUser?.name || 'Bilinmiyor'
                    });
                    added++;
                });
                
                alert(`${added} adet kayıt başarıyla eklendi!`);
                // Re-render module
                renderRegistrationModule(container, orgId);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch(err) {
                console.error(err);
                alert('Dosya okunurken hata oluştu.');
            }
        };
        reader.readAsBinaryString(file);
    });

    // Excel Export
    container.querySelector('#btnExportExcel').addEventListener('click', () => {
        const exportParticipants = DB.participants.getByEventId(orgId);
        if (exportParticipants.length === 0) {
            const toast = document.createElement('div');
            toast.className = 'toast toast-error';
            toast.textContent = 'Dışa aktarılacak kayıt bulunamadı.';
            document.getElementById('toastContainer').appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
            return;
        }

        const headers = ['Yetkili', 'Firma', 'İsim', 'Soyisim', 'E-posta', 'Telefon', 'TC No', 'Pasaport No', 'Kalkış Şehri', 'Kayıt Dönemi', 'Fiyat', 'İşlemi Yapan'];
        const rows = exportParticipants.map(p => {
            let periodLabel = p.regPeriod === 'custom' ? 'Özel Fiyat' : (p.regPeriod === 'late' ? 'Geç Kayıt' : 'Erken Kayıt');
            const price = p.regPeriod === 'custom' ? Number(p.regCustomPrice || 0) : (p.regPeriod === 'late' ? latePrice : earlyPrice);
            return [
                p.authorizedPerson || '',
                p.company || '',
                p.firstName || '',
                p.lastName || '',
                p.email || '',
                p.phone || '',
                p.tcNo || '',
                p.passportNo || '',
                p.depCity || '',
                periodLabel,
                price,
                p.createdBy || ''
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Katılımcılar");
        
        const eventName = event.name || 'organizasyon';
        XLSX.writeFile(wb, `${eventName}_katilimcilar.xlsx`);

        const toast = document.createElement('div');
        toast.className = 'toast toast-success';
        toast.textContent = `${exportParticipants.length} katılımcı başarıyla dışa aktarıldı.`;
        document.getElementById('toastContainer').appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    });

    // Rooming List Export
    container.querySelector('#btnExportRooming')?.addEventListener('click', () => {
        const pList = DB.participants.getByEventId(orgId).filter(p => p.accommodation); // Only those with accommodation
        const accs = DB.accommodations.getByEventId(orgId);
        
        if (pList.length === 0) {
            alert('Konaklamalı misafir bulunamadı.');
            return;
        }

        const headers = ['Giriş Tarihi', 'Çıkış Tarihi', 'Oda Tipi', 'Ad Soyad', 'Firma', 'Telefon', 'TC/Pass', 'Notlar'];
        const rows = pList.map(p => {
            const match = accs ? accs.items.find(a => a.participantId === p.id) : null;
            // Default to values in p object if not in accs (from old implementation)
            const cIn = match ? match.checkIn : p.checkIn;
            const cOut = match ? match.checkOut : p.checkOut;
            const rType = match ? match.roomType : p.roomType;
            return [
                cIn ? new Date(cIn).toLocaleDateString('tr-TR') : '-',
                cOut ? new Date(cOut).toLocaleDateString('tr-TR') : '-',
                rType || '-',
                `${p.firstName} ${p.lastName}`,
                p.company || '-',
                p.phone || '-',
                p.tc || p.pass || '-',
                ''
            ];
        });

        // Sort by Check-in Date, then Room Type
        rows.sort((a,b) => {
            if(a[0] !== b[0]) return a[0].localeCompare(b[0]);
            return a[2].localeCompare(b[2]);
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rooming List");
        
        const eventName = event.name || 'organizasyon';
        XLSX.writeFile(wb, `${eventName}_rooming_list.xlsx`);

        const toast = document.createElement('div');
        toast.className = 'toast toast-success';
        toast.textContent = `Rooming list (${pList.length} oda kaydı) başarıyla dışa aktarıldı.`;
        document.getElementById('toastContainer').appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    });

    // Manual Add Button
    container.querySelector('#btnManuelKayit').addEventListener('click', () => {
        const companies = DB.companies.getAll();
        const companyOptions = companies.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        let draft = null;
        try {
            draft = JSON.parse(localStorage.getItem('ethiccon_draft_registration_manual'));
        } catch(e) {}

        const formHTML = `
            <form id="regForm">
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Yetkili</label><input type="text" class="form-input" id="regAuth" value="${draft?.auth || ''}"></div>
                    <div class="form-group">
                        <label class="form-label">Firma</label>
                        <select class="form-select searchable-select" id="regCompany">
                            <option value="">Seçiniz...</option>
                            ${companyOptions}
                            <option value="Bireysel" ${draft?.company === 'Bireysel' ? 'selected' : ''}>Bireysel / Diğer</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">İsim*</label><input type="text" class="form-input" id="regFirstName" value="${draft?.firstName || ''}" required></div>
                    <div class="form-group"><label class="form-label">Soyad*</label><input type="text" class="form-input" id="regLastName" value="${draft?.lastName || ''}" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Telefon*</label><input type="text" class="form-input mask-phone" id="regPhone" value="${draft?.phone || ''}" required placeholder="05XX XXX XX XX"></div>
                    <div class="form-group"><label class="form-label">E-posta</label><input type="email" class="form-input" id="regEmail" value="${draft?.email || ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Doğum Tarihi</label><input type="date" class="form-input" id="regBirth" value="${draft?.birth || ''}"></div>
                    <div class="form-group"><label class="form-label">Kalkış Şehri</label><input type="text" class="form-input" id="regCity" value="${draft?.city || ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">TC Kimlik No</label><input type="text" class="form-input mask-tc" id="regTc" value="${draft?.tc || ''}"></div>
                    <div class="form-group"><label class="form-label">Pasaport No</label><input type="text" class="form-input mask-pass" id="regPass" value="${draft?.pass || ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Kayıt Dönemi</label>
                        <select class="form-select" id="regPeriod">
                            <option value="early" ${draft?.period === 'early' ? 'selected' : ''}>Erken Kayıt</option>
                            <option value="late" ${draft?.period === 'late' ? 'selected' : ''}>Geç Kayıt</option>
                            <option value="custom" ${draft?.period === 'custom' ? 'selected' : ''}>Özel Fiyat Belirle</option>
                        </select>
                    </div>
                    <div class="form-group" id="regCustomPriceGroup" style="${draft?.period === 'custom' ? 'display: block;' : 'display: none;'}">
                        <label class="form-label">Özel Fiyat (₺)</label>
                        <input type="number" class="form-input" id="regCustomPrice" value="${draft?.customPrice || 0}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Otel Seçimi (İsteğe Bağlı)</label>
                        <select class="form-select" id="regHotel">
                            <option value="">Konaklama Yok</option>
                            ${DB.hotels.getByEventId(orgId).map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Oda Tipi</label>
                        <select class="form-select" id="regRoomType" disabled>
                            <option value="SNG">Tek Kişilik (SNG)</option>
                            <option value="DBL">Çift Kişilik (DBL)</option>
                            <option value="TRPL">Üç Kişilik (TRPL)</option>
                        </select>
                    </div>
                </div>
                <div class="form-row" id="regAccPriceGroup" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">Konaklama Özel Fiyatı (₺)</label>
                        <input type="number" class="form-input" id="regAccPrice" value="0">
                    </div>
                </div>
            </form>
        `;
        
        openModal({
            title: 'Manuel Kayıt Ekle',
            content: formHTML,
            width: '600px',
            onSave: () => {
                // Reset borders
                ['regFirstName', 'regLastName', 'regPhone', 'regTc', 'regEmail'].forEach(id => {
                    document.getElementById(id).style.borderColor = 'var(--slate-200)';
                });

                const firstName = document.getElementById('regFirstName').value;
                const lastName = document.getElementById('regLastName').value;
                const phone = document.getElementById('regPhone').value;
                const tcNo = document.getElementById('regTc').value;
                const email = document.getElementById('regEmail').value;
                
                let hasError = false;

                if (!firstName || !lastName || !phone) {
                    alert('Lütfen zorunlu alanları (*) doldurun.');
                    if(!firstName) document.getElementById('regFirstName').style.borderColor = 'var(--danger)';
                    if(!lastName) document.getElementById('regLastName').style.borderColor = 'var(--danger)';
                    if(!phone) document.getElementById('regPhone').style.borderColor = 'var(--danger)';
                    hasError = true;
                }
                
                if (tcNo && tcNo.length !== 11) {
                    alert('Hata: TC Kimlik No tam 11 hane olmalıdır!');
                    document.getElementById('regTc').style.borderColor = 'var(--danger)';
                    hasError = true;
                }

                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    alert('Hata: Geçerli bir e-posta formatı giriniz (örnek@alanadi.com)!');
                    document.getElementById('regEmail').style.borderColor = 'var(--danger)';
                    hasError = true;
                }

                if (phone && phone.length < 10) {
                    alert('Hata: Telefon numarası çok kısa, kontrol ediniz.');
                    document.getElementById('regPhone').style.borderColor = 'var(--danger)';
                    hasError = true;
                }

                if (hasError) return;
                
                const hotelId = document.getElementById('regHotel').value;
                const roomType = document.getElementById('regRoomType').value;
                const accPrice = Number(document.getElementById('regAccPrice').value) || 0;
                
                if (hotelId) {
                    const hotel = DB.hotels.getById(hotelId);
                    if (hotel) {
                        // Check allotment
                        const currentGuestsInHotel = DB.participants.getByEventId(orgId).filter(p => p.hotelId === hotelId && p.roomType === roomType);
                        const limit = hotel.allotment?.[roomType]?.count || 0;
                        if (currentGuestsInHotel.length >= limit && limit > 0) {
                            alert(`Hata: ${hotel.name} otelinde ${roomType} kontenjanı dolmuştur! Lütfen kapasiteyi artırın.`);
                            return;
                        }
                    }
                }

                const newPax = DB.participants.create({
                    eventId: orgId,
                    authorizedPerson: document.getElementById('regAuth').value,
                    company: document.getElementById('regCompany').value,
                    firstName: firstName,
                    lastName: lastName,
                    email: document.getElementById('regEmail').value,
                    phone: phone,
                    birthDate: document.getElementById('regBirth').value,
                    tcNo: document.getElementById('regTc').value,
                    passportNo: document.getElementById('regPass').value,
                    depCity: document.getElementById('regCity').value,
                    regPeriod: document.getElementById('regPeriod').value,
                    regCustomPrice: Number(document.getElementById('regCustomPrice').value) || 0,
                    createdBy: currentUser?.name || 'Bilinmiyor',
                    accommodation: !!hotelId,
                    hotelId: hotelId || null,
                    roomType: hotelId ? roomType : null,
                    accSellPrice: accPrice
                });
                
                if (newPax.regCustomPrice > 0) {
                    DB.budgetItems.create({
                        eventId: orgId,
                        type: 'income',
                        category: 'Kayıt Geliri',
                        title: `${firstName} ${lastName} Kayıt Ücreti`,
                        amount: newPax.regCustomPrice,
                        date: new Date().toISOString().split('T')[0]
                    });
                }

                if (newPax.accSellPrice > 0 && newPax.accommodation) {
                    DB.budgetItems.create({
                        eventId: orgId,
                        type: 'income',
                        category: 'Konaklama Geliri',
                        title: `${firstName} ${lastName} Konaklama Ücreti`,
                        amount: newPax.accSellPrice,
                        date: new Date().toISOString().split('T')[0]
                    });
                }
                
                closeModal();
                DB.logs.add(`Yeni misafir eklendi: ${firstName} ${lastName}`, 'success');
                localStorage.removeItem('ethiccon_draft_registration_manual');
                renderRegistrationModule(container, orgId);
                if (typeof lucide !== 'undefined') lucide.createIcons();
                
                const toast = document.createElement('div');
                toast.className = 'toast toast-success';
                toast.textContent = 'Kayıt başarıyla eklendi.';
                document.getElementById('toastContainer').appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }
        });

        // Initialize searchable selects after modal opens
        if(typeof initSearchableSelects === 'function') initSearchableSelects(document.querySelector('.modal-body'));

        // Save draft on input
        const formEl = document.getElementById('regForm');
        if (formEl) {
            formEl.addEventListener('input', () => {
                const draftData = {
                    auth: document.getElementById('regAuth').value,
                    company: document.getElementById('regCompany').value,
                    firstName: document.getElementById('regFirstName').value,
                    lastName: document.getElementById('regLastName').value,
                    phone: document.getElementById('regPhone').value,
                    email: document.getElementById('regEmail').value,
                    birth: document.getElementById('regBirth').value,
                    city: document.getElementById('regCity').value,
                    tc: document.getElementById('regTc').value,
                    pass: document.getElementById('regPass').value,
                    period: document.getElementById('regPeriod').value,
                    customPrice: document.getElementById('regCustomPrice').value
                };
                localStorage.setItem('ethiccon_draft_registration_manual', JSON.stringify(draftData));
            });
        }

        // Custom price toggler
        const periodSel = document.getElementById('regPeriod');
        const customGroup = document.getElementById('regCustomPriceGroup');
        periodSel.addEventListener('change', () => {
            if (periodSel.value === 'custom') {
                customGroup.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
                document.getElementById('regCustomPrice').value = '0';
            }
            formEl.dispatchEvent(new Event('input'));
        });
        // Hotel toggler
        const hotelSel = document.getElementById('regHotel');
        const roomTypeSel = document.getElementById('regRoomType');
        const accPriceGroup = document.getElementById('regAccPriceGroup');
        hotelSel.addEventListener('change', () => {
            if (hotelSel.value) {
                roomTypeSel.disabled = false;
                accPriceGroup.style.display = 'block';
            } else {
                roomTypeSel.disabled = true;
                accPriceGroup.style.display = 'none';
                document.getElementById('regAccPrice').value = '0';
            }
        });
    });

    // Handle Edit
    container.querySelectorAll('.btn-edit-reg').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const p = DB.participants.getById(id);
            if (!p) return;

            const companies = DB.companies.getAll();
            const companyOptions = companies.map(c => `<option value="${c.name}" ${p.company === c.name ? 'selected' : ''}>${c.name}</option>`).join('');

            const formHTML = `
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Yetkili</label><input type="text" class="form-input" id="editAuth" value="${p.authorizedPerson || ''}"></div>
                    <div class="form-group">
                        <label class="form-label">Firma</label>
                        <select class="form-select searchable-select" id="editCompany">
                            <option value="">Seçiniz...</option>
                            ${companyOptions}
                            <option value="Bireysel" ${p.company === 'Bireysel' ? 'selected' : ''}>Bireysel / Diğer</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">İsim*</label><input type="text" class="form-input" id="editFirstName" value="${p.firstName || ''}" required></div>
                    <div class="form-group"><label class="form-label">Soyad*</label><input type="text" class="form-input" id="editLastName" value="${p.lastName || ''}" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Telefon*</label><input type="text" class="form-input mask-phone" id="editPhone" value="${p.phone || ''}" required placeholder="05XX XXX XX XX"></div>
                    <div class="form-group"><label class="form-label">E-posta</label><input type="email" class="form-input" id="editEmail" value="${p.email || ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Doğum Tarihi</label><input type="date" class="form-input" id="editBirth" value="${p.birthDate || ''}"></div>
                    <div class="form-group"><label class="form-label">Kalkış Şehri</label><input type="text" class="form-input" id="editCity" value="${p.depCity || ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">TC Kimlik No</label><input type="text" class="form-input mask-tc" id="editTc" value="${p.tcNo || ''}"></div>
                    <div class="form-group"><label class="form-label">Pasaport No</label><input type="text" class="form-input" id="editPass" value="${p.passportNo || ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Kayıt Dönemi</label>
                        <select class="form-select" id="editPeriod">
                            <option value="early" ${p.regPeriod === 'early' ? 'selected' : ''}>Erken Kayıt</option>
                            <option value="late" ${p.regPeriod === 'late' ? 'selected' : ''}>Geç Kayıt</option>
                            <option value="custom" ${p.regPeriod === 'custom' ? 'selected' : ''}>Özel Fiyat Belirle</option>
                        </select>
                    </div>
                    <div class="form-group" id="editCustomPriceGroup" style="${p.regPeriod === 'custom' ? 'display: block;' : 'display: none;'}">
                        <label class="form-label">Özel Fiyat (₺)</label>
                        <input type="number" class="form-input" id="editCustomPrice" value="${p.regCustomPrice || 0}">
                    </div>
                </div>
                <div style="margin-top: 16px; text-align: left;">
                    <button class="btn btn-danger btn-sm" id="btnDeleteParticipant">
                        <i data-lucide="trash-2"></i> Bu Misafiri Sil
                    </button>
                </div>
            `;
            
            openModal({
                title: 'Misafir Düzenle',
                content: formHTML,
                width: '600px',
                onSave: () => {
                    const firstName = document.getElementById('editFirstName').value;
                    const lastName = document.getElementById('editLastName').value;
                    const phone = document.getElementById('editPhone').value;
                    
                    if (!firstName || !lastName || !phone) {
                        alert('Lütfen zorunlu alanları (*) doldurun.');
                        return;
                    }
                    
                    DB.participants.update(id, {
                        authorizedPerson: document.getElementById('editAuth').value,
                        company: document.getElementById('editCompany').value,
                        firstName: firstName,
                        lastName: lastName,
                        email: document.getElementById('editEmail').value,
                        phone: phone,
                        birthDate: document.getElementById('editBirth').value,
                        tcNo: document.getElementById('editTc').value,
                        passportNo: document.getElementById('editPass').value,
                        depCity: document.getElementById('editCity').value,
                        regPeriod: document.getElementById('editPeriod').value,
                        regCustomPrice: Number(document.getElementById('editCustomPrice').value) || 0
                    });
                    
                    closeModal();
                    renderRegistrationModule(container, orgId);
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            });

            // Re-bind Lucide icons inside modal for the delete button
            if (typeof lucide !== 'undefined') lucide.createIcons();

            // Handle logic for custom price visibility in Edit modal
            const modalEl = document.querySelector('.modal');
            if (modalEl) {
                const periodSelect = modalEl.querySelector('#editPeriod');
                const customPriceGroup = modalEl.querySelector('#editCustomPriceGroup');
                if(periodSelect && customPriceGroup) {
                    periodSelect.addEventListener('change', (e) => {
                        if (e.target.value === 'custom') {
                            customPriceGroup.style.display = 'block';
                        } else {
                            customPriceGroup.style.display = 'none';
                        }
                    });
                }
                
                // Handle Delete
                const btnDelete = modalEl.querySelector('#btnDeleteParticipant');
                if (btnDelete) {
                    btnDelete.addEventListener('click', () => {
                        if (confirm('Bu misafiri ve bağlı olduğu uçuş vb. verileri tamamen silmek istediğinize emin misiniz?')) {
                            DB.participants.delete(id);
                            closeModal();
                            renderRegistrationModule(container, orgId);
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        }
                    });
                }
            }
        });
    });
}
