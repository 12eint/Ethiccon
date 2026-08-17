import { DB } from '../../db.js';
import { openModal, closeModal } from '../../components/modal.js';

export function renderFlightModule(container, orgId) {
    const currentUser = DB.users.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';
    const flights = DB.flights.getByEventId(orgId);
    
    let totalFlightProfit = 0;
    if (isAdmin) {
        flights.forEach(f => {
            totalFlightProfit += (Number(f.sellPrice) || 0) - (Number(f.buyPrice) || 0);
        });
    }
    
    container.innerHTML = `
        <div class="card" style="animation: slideInRight 0.3s ease; margin-bottom: 24px;">
            <div class="card-header">
                <h3 class="card-title">Toplu Uçuş Bilet Yönetimi</h3>
                <button class="btn btn-secondary btn-sm" id="btnAddFlightGuest">
                    <i data-lucide="plus"></i> Uçak Ekstra Misafir Ekle
                </button>
            </div>
            
            <div style="padding: 24px; overflow-x: auto;">
                <table class="data-table" style="font-size: 0.75rem; white-space: nowrap;">
                    <thead>
                        <tr>
                            <th colspan="4" style="background: var(--slate-100); text-align: center; border-right: 1px solid var(--slate-300);">Misafir & Finans</th>
                            <th colspan="7" style="background: var(--primary-50); text-align: center; border-right: 1px solid var(--slate-300);">Gidiş (Outbound)</th>
                            <th colspan="7" style="background: var(--warning-light); text-align: center;">Dönüş (Inbound)</th>
                            <th rowspan="2">İşlem</th>
                        </tr>
                        <tr>
                            <!-- Misafir & Finans -->
                            <th>Misafir Adı</th>
                            <th>Tedarikçi</th>
                            <th>Havayolu</th>
                            <th style="border-right: 1px solid var(--slate-300);">Alış / Satış</th>
                            
                            <!-- Gidiş -->
                            <th>Kalkış Ş.</th>
                            <th>Geliş T.</th>
                            <th>İç Hat Kod</th>
                            <th>Kalkış-Varış</th>
                            <th>Dış Hat Kod</th>
                            <th>Kalkış-Varış</th>
                            <th style="border-right: 1px solid var(--slate-300);">Varış Ş.</th>
                            
                            <!-- Dönüş -->
                            <th>Dönüş T.</th>
                            <th>Dış Hat Kod</th>
                            <th>Kalkış-Varış</th>
                            <th>İç Dönüş T.</th>
                            <th>İç Hat Kod</th>
                            <th>Kalkış-Varış</th>
                            <th>Varış Ş.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${flights.length === 0 ? `
                            <tr><td colspan="19" style="text-align: center; padding: 24px;">Uçuş kaydı bulunmuyor.</td></tr>
                        ` : flights.map(f => {
                            const p = DB.participants.getById(f.participantId);
                            const pName = p ? (p.firstName + ' ' + p.lastName) : 'Bilinmeyen Misafir';
                            const out = f.outbound || {};
                            const inb = f.inbound || {};
                            
                            return `
                            <tr>
                                <td><strong>${pName}</strong></td>
                                <td>${f.supplier || '-'}</td>
                                <td>${f.airline || '-'}</td>
                                <td style="border-right: 1px solid var(--slate-200);">
                                    <div style="color: var(--danger); font-weight: 600;">A: ${f.buyPrice}₺</div>
                                    <div style="color: var(--success); font-weight: 600;">S: ${f.sellPrice}₺</div>
                                </td>
                                
                                <!-- Gidiş -->
                                <td>${out.depCity || '-'}</td>
                                <td>${out.arrDate || '-'}</td>
                                <td>${out.domFlightCode || '-'}</td>
                                <td>${out.depTime || '-'}-${out.arrTime || '-'}</td>
                                <td>${out.intFlightCode || '-'}</td>
                                <td>${out.intDepTime || '-'}-${out.intArrTime || '-'}</td>
                                <td style="border-right: 1px solid var(--slate-200);">${out.arrCity || '-'}</td>
                                
                                <!-- Dönüş -->
                                <td>${inb.depDate || '-'}</td>
                                <td>${inb.intFlightCode || '-'}</td>
                                <td>${inb.intDepTime || '-'}-${inb.intArrTime || '-'}</td>
                                <td>${inb.domDepDate || '-'}</td>
                                <td>${inb.domFlightCode || '-'}</td>
                                <td>${inb.domDepTime || '-'}-${inb.domArrTime || '-'}</td>
                                <td>${out.depCity || '-'}</td> <!-- Genelde gidişteki kalkış şehri olur -->
                                
                                <td>
                                    <button class="btn btn-ghost btn-icon btn-edit-flight" data-id="${f.id}" title="Düzenle"><i data-lucide="edit" style="width: 14px; height: 14px;"></i></button>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            ${isAdmin ? `
            <div class="card-footer" style="padding: 16px 24px; border-top: 1px solid var(--slate-100); text-align: right;">
                <span style="font-weight: 600; color: var(--slate-700);">
                    Toplam Uçak Bileti Kârı: 
                    <span style="color: var(--success); font-size: 1.25rem;">
                        ₺${totalFlightProfit.toLocaleString('tr-TR')}
                    </span>
                </span>
            </div>
            ` : ''}
        </div>
    `;

    // Add Guest Flight
    container.querySelector('#btnAddFlightGuest').addEventListener('click', () => {
        const pool = DB.participants.getByEventId(orgId); // Any participant can get a flight

        let content = `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Kayıtlı Misafir Seç</label>
                    <select id="flGuest" class="form-select">
                        <option value="">Seçiniz...</option>
                        ${pool.map(p => `<option value="${p.id}">${p.firstName} ${p.lastName} (${p.company || 'Bireysel'})</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Tedarikçi</label><input type="text" class="form-input" id="flSupplier"></div>
                <div class="form-group"><label class="form-label">Havayolu</label><input type="text" class="form-input" id="flAirline"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Alış Fiyatı (₺)</label><input type="number" class="form-input" id="flBuy" value="0"></div>
                <div class="form-group"><label class="form-label">Satış Fiyatı (₺)</label><input type="number" class="form-input" id="flSell" value="0"></div>
            </div>
            
            <h4 style="margin-top: 16px; border-bottom: 1px solid var(--slate-200); padding-bottom: 8px;">Gidiş (Outbound)</h4>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Kalkış Şehri</label><input type="text" class="form-input" id="flOutDepCity"></div>
                <div class="form-group"><label class="form-label">Geliş Tarihi</label><input type="date" class="form-input" id="flOutArrDate"></div>
                <div class="form-group"><label class="form-label">Varış Şehri</label><input type="text" class="form-input" id="flOutArrCity"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">İç Hat Uçuş Kodu</label><input type="text" class="form-input" id="flOutDomCode"></div>
                <div class="form-group"><label class="form-label">Kalkış Saati</label><input type="time" class="form-input" id="flOutDomDep"></div>
                <div class="form-group"><label class="form-label">Varış Saati</label><input type="time" class="form-input" id="flOutDomArr"></div>
            </div>
            
            <h4 style="margin-top: 16px; border-bottom: 1px solid var(--slate-200); padding-bottom: 8px;">Dönüş (Inbound)</h4>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Dönüş Tarihi</label><input type="date" class="form-input" id="flInbDepDate"></div>
                <div class="form-group"><label class="form-label">İç Dönüş Tarihi</label><input type="date" class="form-input" id="flInbDomDate"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">İç Hat Uçuş Kodu</label><input type="text" class="form-input" id="flInbDomCode"></div>
                <div class="form-group"><label class="form-label">Kalkış Saati</label><input type="time" class="form-input" id="flInbDomDep"></div>
                <div class="form-group"><label class="form-label">Varış Saati</label><input type="time" class="form-input" id="flInbDomArr"></div>
            </div>
        `;

        openModal({
            title: 'Misafire Uçak Bileti Tanımla',
            content: content,
            width: '800px',
            onSave: () => {
                const participantId = document.getElementById('flGuest').value;
                if (!participantId) {
                    alert('Lütfen bir misafir seçin.');
                    return;
                }

                DB.flights.create({
                    eventId: orgId,
                    participantId: participantId,
                    supplier: document.getElementById('flSupplier').value,
                    airline: document.getElementById('flAirline').value,
                    buyPrice: Number(document.getElementById('flBuy').value) || 0,
                    sellPrice: Number(document.getElementById('flSell').value) || 0,
                    outbound: {
                        depCity: document.getElementById('flOutDepCity').value,
                        arrDate: document.getElementById('flOutArrDate').value,
                        domFlightCode: document.getElementById('flOutDomCode').value,
                        depTime: document.getElementById('flOutDomDep').value,
                        arrTime: document.getElementById('flOutDomArr').value,
                        arrCity: document.getElementById('flOutArrCity').value
                    },
                    inbound: {
                        depDate: document.getElementById('flInbDepDate').value,
                        domDepDate: document.getElementById('flInbDomDate').value,
                        domFlightCode: document.getElementById('flInbDomCode').value,
                        domDepTime: document.getElementById('flInbDomDep').value,
                        domArrTime: document.getElementById('flInbDomArr').value
                    }
                });

                closeModal();
                renderFlightModule(container, orgId);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    });
    
    container.querySelectorAll('.btn-edit-flight').forEach(btn => {
        btn.addEventListener('click', () => {
            alert('Uçuş detay düzenleme formu açılacaktır. (Yapım aşamasında)');
        });
    });
}
