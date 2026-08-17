import { DB } from '../../db.js';
import { openModal, closeModal } from '../../components/modal.js';

export function renderAccommodationModule(container, orgId) {
    const currentUser = DB.users.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';

    const accData = DB.accommodations.getByEventId(orgId) || {
        allotment: { 
            SNG: { count: 0, buyPrice: 0, sellPrice: 0 },
            DBL: { count: 0, buyPrice: 0, sellPrice: 0 },
            TRPL: { count: 0, buyPrice: 0, sellPrice: 0 }
        },
        companyPrices: {}
    };
    if (!accData.companyPrices) accData.companyPrices = {};
    
    // All participants in the pool
    const allParticipants = DB.participants.getByEventId(orgId);
    
    // Guests with accommodation
    const guests = allParticipants.filter(p => p.accommodation === true);

    const calcProfit = (type) => {
        const al = accData.allotment[type];
        const guestsOfType = guests.filter(g => g.roomType === type);
        
        let totalRevenue = 0;
        guestsOfType.forEach(g => {
            let price = g.accSellPrice;
            if (price === undefined || price === null || price === '') {
                // Determine default price
                if (g.company && accData.companyPrices[g.company] && accData.companyPrices[g.company][type]) {
                    price = accData.companyPrices[g.company][type];
                } else {
                    price = al.sellPrice;
                }
            }
            totalRevenue += Number(price);
        });

        const soldRooms = guestsOfType.length;
        const totalCost = al.count * al.buyPrice;
        
        return {
            sold: soldRooms,
            totalCost: totalCost,
            totalRevenue: totalRevenue,
            profit: totalRevenue - totalCost
        };
    };

    const sngCalc = calcProfit('SNG');
    const dblCalc = calcProfit('DBL');
    const trplCalc = calcProfit('TRPL');

    container.innerHTML = `
        <div class="card" style="animation: slideInRight 0.3s ease; margin-bottom: 24px;">
            <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
                <h3 class="card-title">Oda Kontenjan ve Fiyatlandırma</h3>
                <div style="display: flex; gap: 12px;">
                    <button class="btn btn-secondary btn-sm" id="btnCompanyPrices">Firma Fiyatları</button>
                    <button class="btn btn-primary btn-sm" id="btnSaveAcc">Kaydet</button>
                </div>
            </div>
            
            <div style="padding: 24px; overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Oda Tipi</th>
                            <th>Kontenjan (Satın Alınan)</th>
                            <th>Maliyet (Alış ₺)</th>
                            <th>Genel Satış (₺)</th>
                            <th>Satılan</th>
                            ${isAdmin ? `<th>Kâr / Zarar Durumu</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${['SNG', 'DBL', 'TRPL'].map(type => {
                            const al = accData.allotment[type];
                            const calc = type === 'SNG' ? sngCalc : (type === 'DBL' ? dblCalc : trplCalc);
                            const profitClass = calc.profit >= 0 ? 'color: var(--success)' : 'color: var(--danger)';
                            return `
                            <tr>
                                <td><strong>${type}</strong></td>
                                <td><input type="number" class="form-input acc-input" data-type="${type}" data-field="count" value="${al.count}" style="width: 80px;"></td>
                                <td><input type="number" class="form-input acc-input" data-type="${type}" data-field="buyPrice" value="${al.buyPrice}" style="width: 100px;"></td>
                                <td><input type="number" class="form-input acc-input" data-type="${type}" data-field="sellPrice" value="${al.sellPrice}" style="width: 100px;" title="Firması veya özel fiyatı olmayan misafirlere bu fiyat uygulanır"></td>
                                <td>${calc.sold}</td>
                                ${isAdmin ? `<td><strong style="${profitClass}">₺${calc.profit.toLocaleString('tr-TR')}</strong></td>` : ''}
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card" style="animation: slideInRight 0.3s ease;">
            <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
                <h3 class="card-title">Konaklayan Misafir Listesi</h3>
                <div style="display: flex; gap: 12px;">
                    <button class="btn btn-secondary btn-sm" id="btnExportAccExcel">
                        <i data-lucide="download"></i> Excel İndir
                    </button>
                    <button class="btn btn-secondary btn-sm" id="btnAddGuest">
                        <i data-lucide="plus"></i> Havuzdan Seç
                    </button>
                </div>
            </div>
            
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Misafir Adı</th>
                            <th>Firma</th>
                            <th>Oda Tipi</th>
                            <th>Özel Satış Fiyatı</th>
                            <th>DBL İsmi</th>
                            <th>TRPL İsmi</th>
                            <th>TC / Pass</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${guests.length === 0 ? `
                            <tr><td colspan="8" style="text-align: center; padding: 24px;">Konaklayan misafir bulunmuyor.</td></tr>
                        ` : guests.map(g => {
                            let defaultPrice = accData.allotment[g.roomType]?.sellPrice || 0;
                            let hasCompanyPrice = false;
                            if (g.company && accData.companyPrices[g.company] && accData.companyPrices[g.company][g.roomType]) {
                                defaultPrice = accData.companyPrices[g.company][g.roomType];
                                hasCompanyPrice = true;
                            }
                            
                            const displayPrice = (g.accSellPrice !== undefined && g.accSellPrice !== null && g.accSellPrice !== '') ? g.accSellPrice : defaultPrice;

                            return `
                            <tr>
                                <td><strong>${g.firstName} ${g.lastName}</strong></td>
                                <td>${g.company || '-'}</td>
                                <td>
                                    <select class="form-select room-type-select" data-id="${g.id}">
                                        <option value="SNG" ${g.roomType === 'SNG' ? 'selected' : ''}>SNG</option>
                                        <option value="DBL" ${g.roomType === 'DBL' ? 'selected' : ''}>DBL</option>
                                        <option value="TRPL" ${g.roomType === 'TRPL' ? 'selected' : ''}>TRPL</option>
                                    </select>
                                </td>
                                <td>
                                    <input type="number" class="form-input ind-price-input" data-id="${g.id}" value="${displayPrice}" style="width: 90px; ${hasCompanyPrice && g.accSellPrice == null ? 'border-color: var(--info);' : ''}" title="${hasCompanyPrice ? 'Firma anlaşmalı fiyatı' : 'Genel satış fiyatı'}">
                                </td>
                                <td>
                                    <input type="text" class="form-input dbl-name-input" data-id="${g.id}" value="${g.dblName || ''}" placeholder="Oda Arkadaşı 1" ${g.roomType === 'SNG' ? 'disabled' : ''} style="width: 120px;">
                                </td>
                                <td>
                                    <input type="text" class="form-input trpl-name-input" data-id="${g.id}" value="${g.trplName || ''}" placeholder="Oda Arkadaşı 2" ${g.roomType !== 'TRPL' ? 'disabled' : ''} style="width: 120px;">
                                </td>
                                <td>${g.tcNo || g.passportNo || '-'}</td>
                                <td>
                                    <button class="btn btn-danger btn-icon btn-remove-guest" data-id="${g.id}" title="Otelden Çıkar"><i data-lucide="trash-2"></i></button>
                                </td>
                            </tr>
                        `; }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Save Allotment Data
    container.querySelector('#btnSaveAcc').addEventListener('click', () => {
        const inputs = container.querySelectorAll('.acc-input');
        const newData = {
            allotment: {
                SNG: { count: 0, buyPrice: 0, sellPrice: 0 },
                DBL: { count: 0, buyPrice: 0, sellPrice: 0 },
                TRPL: { count: 0, buyPrice: 0, sellPrice: 0 }
            }
        };

        inputs.forEach(input => {
            const type = input.dataset.type;
            const field = input.dataset.field;
            newData.allotment[type][field] = Number(input.value) || 0;
        });

        // Preserve company prices
        newData.companyPrices = accData.companyPrices;

        DB.accommodations.createOrUpdate(orgId, newData);
        alert('Fiyat ve kontenjan bilgileri kaydedildi.');
        renderAccommodationModule(container, orgId); // Re-render for calculations
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    // Change Room Type
    container.querySelectorAll('.room-type-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const participantId = e.target.dataset.id;
            const newType = e.target.value;
            DB.participants.update(participantId, { roomType: newType });
            renderAccommodationModule(container, orgId); // Re-render to update profit table
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });

    // Remove Guest from Hotel
    container.querySelectorAll('.btn-remove-guest').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const participantId = e.currentTarget.dataset.id;
            if (confirm('Misafiri otel listesinden çıkarmak istediğinize emin misiniz? (Kayıt havuzundan silinmez)')) {
                DB.participants.update(participantId, { accommodation: false, roomType: '', dblName: '', trplName: '' });
                renderAccommodationModule(container, orgId);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    });

    // Handle DBL/TRPL Name Inputs & Individual Price
    const saveNames = (e) => {
        const id = e.target.dataset.id;
        const field = e.target.classList.contains('dbl-name-input') ? 'dblName' : 'trplName';
        DB.participants.update(id, { [field]: e.target.value });
    };
    const savePrice = (e) => {
        const id = e.target.dataset.id;
        DB.participants.update(id, { accSellPrice: Number(e.target.value) });
        renderAccommodationModule(container, orgId); // update profit
    };

    container.querySelectorAll('.dbl-name-input, .trpl-name-input').forEach(input => {
        input.addEventListener('change', saveNames);
    });
    container.querySelectorAll('.ind-price-input').forEach(input => {
        input.addEventListener('change', savePrice);
    });

    // Company Prices Modal
    container.querySelector('#btnCompanyPrices').addEventListener('click', () => {
        // Unique companies in registration
        const companies = [...new Set(allParticipants.map(p => p.company).filter(c => c && c.trim() !== ''))];
        
        let content = `
            <p style="margin-bottom: 16px; font-size: 0.85rem; color: var(--slate-500);">Aşağıdaki firmalardan kayıtlı misafiriniz bulunmaktadır. Firmalara özel oda satış fiyatlarını buradan belirleyebilirsiniz.</p>
            <table class="data-table">
                <thead><tr><th>Firma</th><th>SNG Fiyat</th><th>DBL Fiyat</th><th>TRPL Fiyat</th></tr></thead>
                <tbody>
                    ${companies.map(c => {
                        const prices = accData.companyPrices[c] || { SNG: '', DBL: '', TRPL: '' };
                        return `
                        <tr>
                            <td><strong>${c}</strong></td>
                            <td><input type="number" class="form-input cp-input" data-company="${c}" data-type="SNG" value="${prices.SNG}" style="width:80px"></td>
                            <td><input type="number" class="form-input cp-input" data-company="${c}" data-type="DBL" value="${prices.DBL}" style="width:80px"></td>
                            <td><input type="number" class="form-input cp-input" data-company="${c}" data-type="TRPL" value="${prices.TRPL}" style="width:80px"></td>
                        </tr>
                        `;
                    }).join('')}
                    ${companies.length === 0 ? '<tr><td colspan="4" style="text-align:center;">Sistemde şirket bilgisine sahip katılımcı bulunamadı.</td></tr>' : ''}
                </tbody>
            </table>
        `;

        openModal({
            title: 'Firma Özel Fiyatları',
            content: content,
            width: '700px',
            onSave: () => {
                const inputs = document.querySelectorAll('.cp-input');
                const newCP = {};
                inputs.forEach(inp => {
                    const comp = inp.dataset.company;
                    const type = inp.dataset.type;
                    const val = inp.value;
                    if (!newCP[comp]) newCP[comp] = {};
                    newCP[comp][type] = val !== '' ? Number(val) : '';
                });
                
                accData.companyPrices = newCP;
                DB.accommodations.createOrUpdate(orgId, { allotment: accData.allotment, companyPrices: newCP });
                
                closeModal();
                renderAccommodationModule(container, orgId);
            }
        });
    });

    // Excel Export
    container.querySelector('#btnExportAccExcel').addEventListener('click', () => {
        if (guests.length === 0) {
            alert('Dışa aktarılacak kayıt bulunamadı.');
            return;
        }

        const exportData = guests.map(g => ({
            'YETKİLİ': g.authorizedPerson || '',
            'FİRMA': g.company || '',
            'İSİM': g.firstName || '',
            'SOYAD': g.lastName || '',
            'TELEFON': g.phone || '',
            'DOĞUM T.': g.birthDate || '',
            'TC NO': g.tcNo || '',
            'PASAPORT NO': g.passportNo || '',
            'GEÇERLİLİK TARİHİ': g.passportExpiry || '',
            'ODA TİPİ': g.roomType || '',
            'DBL İSMİ': g.dblName || '',
            'TRPL İSMİ': g.trplName || ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Konaklama Listesi");
        XLSX.writeFile(wb, "konaklama_listesi.xlsx");
    });

    // Add Guest Placeholder
    container.querySelector('#btnAddGuest').addEventListener('click', () => {
        const pool = allParticipants.filter(p => !p.accommodation);
        
        let content = `
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="data-table" style="font-size: 0.8rem;">
                    <thead>
                        <tr>
                            <th>Seç</th>
                            <th>İsim Soyisim</th>
                            <th>Firma</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pool.length === 0 ? `<tr><td colspan="3" style="text-align:center;">Havuzda uygun kişi bulunmuyor. Önce kayıt ekleyin.</td></tr>` : ''}
                        ${pool.map(p => `
                            <tr>
                                <td><input type="checkbox" class="guest-checkbox" value="${p.id}"></td>
                                <td>${p.firstName} ${p.lastName}</td>
                                <td>${p.company || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 16px;">
                <label class="form-label">Oda Tipi</label>
                <select id="bulkRoomType" class="form-select">
                    <option value="SNG">SNG (Single)</option>
                    <option value="DBL">DBL (Double)</option>
                    <option value="TRPL">TRPL (Triple)</option>
                </select>
            </div>
        `;

        openModal({
            title: 'Havuzdan Misafir Seç',
            content: content,
            width: '600px',
            onSave: () => {
                const checked = document.querySelectorAll('.guest-checkbox:checked');
                const roomType = document.getElementById('bulkRoomType').value;
                
                if (checked.length === 0) {
                    alert('Lütfen en az bir kişi seçin.');
                    return;
                }
                
                checked.forEach(cb => {
                    DB.participants.update(cb.value, { accommodation: true, roomType: roomType });
                });
                
                closeModal();
                renderAccommodationModule(container, orgId);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    });
}
