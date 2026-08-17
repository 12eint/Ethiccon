import { DB } from '../../db.js';
import { openModal, closeModal } from '../../components/modal.js';
import { initSearchableSelects } from '../../app.js';

export function renderTransfersModule(container, eventId) {
    const render = () => {
        const event = DB.events.getById(eventId);
        if (!event) return;

        const transfers = DB.transfers.getByEventId(eventId);
        const flights = DB.flights.getByEventId(eventId);
        const participants = DB.participants.getByEventId(eventId);

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700;">Lojistik ve Transfer Yönetimi</h3>
                <button class="btn btn-primary" id="btnNewTransfer">
                    <i data-lucide="plus"></i> Yeni Transfer / Araç Ata
                </button>
            </div>
            
            <div class="table-container">
                <div class="table-toolbar">
                    <div class="table-search">
                        <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; color: var(--slate-400);"></i>
                        <input type="text" id="transferSearch" placeholder="Araç, şoför veya misafir ara...">
                    </div>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Tarih / Saat</th>
                            <th>Güzergah</th>
                            <th>Araç & Şoför</th>
                            <th>Yolcu Sayısı</th>
                            <th style="text-align: right;">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transfers.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><i data-lucide="car"></i><p>Henüz planlanmış bir transfer bulunmuyor.</p></div></td></tr>` : ''}
                        ${transfers.map(t => {
                            return `
                                <tr>
                                    <td>
                                        <div style="font-weight: 600;">${new Date(t.date).toLocaleDateString('tr-TR')}</div>
                                        <div style="font-size: 0.8rem; color: var(--slate-500);">${t.time}</div>
                                    </td>
                                    <td>
                                        <div style="font-weight: 600;">${t.direction === 'arrival' ? 'Havaalanı ➔ Otel' : 'Otel ➔ Havaalanı'}</div>
                                        <div style="font-size: 0.8rem; color: var(--slate-500);">${t.notes || '-'}</div>
                                    </td>
                                    <td>
                                        <div style="font-weight: 600;">${t.vehicle}</div>
                                        <div style="font-size: 0.8rem; color: var(--slate-500);">${t.driver || '-'} / ${t.driverPhone || '-'}</div>
                                    </td>
                                    <td>
                                        <span class="badge badge-purple">${t.passengers?.length || 0} Yolcu</span>
                                    </td>
                                    <td style="text-align: right;">
                                        <div class="action-btns" style="justify-content: flex-end;">
                                            <button class="action-btn btn-view-manifest" data-id="${t.id}" title="Manifesto (Yolcu Listesi)">
                                                <i data-lucide="users"></i>
                                            </button>
                                            <button class="action-btn btn-delete-transfer" data-id="${t.id}" style="color: var(--danger);">
                                                <i data-lucide="trash-2"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({nodes: [container]});

        // Search
        const searchInput = container.querySelector('#transferSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                container.querySelectorAll('tbody tr').forEach(tr => {
                    if (tr.querySelector('.empty-state')) return;
                    tr.style.display = tr.textContent.toLowerCase().includes(query) ? '' : 'none';
                });
            });
        }

        // New Transfer Modal
        container.querySelector('#btnNewTransfer')?.addEventListener('click', () => {
            // Get participants with flights
            const paxOptions = flights.map(f => {
                const p = participants.find(p => p.id === f.participantId);
                if (!p) return null;
                const fDesc = f.type === 'departure' ? `Gidiş: ${f.flightNo} (${f.time})` : `Dönüş: ${f.flightNo} (${f.time})`;
                return `<option value="${p.id}">${p.firstName} ${p.lastName} - ${fDesc}</option>`;
            }).filter(Boolean).join('');

            const formHTML = `
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Tarih *</label>
                        <input type="date" class="form-input" id="trfDate" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Saat *</label>
                        <input type="time" class="form-input" id="trfTime" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Yön (Güzergah)</label>
                        <select class="form-select" id="trfDirection">
                            <option value="arrival">Havaalanı ➔ Otel (Karşılama)</option>
                            <option value="departure">Otel ➔ Havaalanı (Uğurlama)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Araç Tipi / Plaka *</label>
                        <input type="text" class="form-input" id="trfVehicle" placeholder="Örn: 34 VIP 123 veya Minibüs" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Şoför Adı</label>
                        <input type="text" class="form-input" id="trfDriver">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Şoför Telefonu</label>
                        <input type="text" class="form-input mask-phone" id="trfDriverPhone" placeholder="05XX XXX XX XX">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Yolcular (Çoklu Seçim)</label>
                    <select class="form-select searchable-select" id="trfPassengers" multiple>
                        ${paxOptions}
                    </select>
                    <p style="font-size: 0.75rem; color: var(--slate-500); margin-top: 4px;">Sadece uçak bileti sisteme girilmiş misafirler listelenir.</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Notlar</label>
                    <textarea class="form-textarea" id="trfNotes" rows="2" placeholder="Karşılama tabelası, uçuş rötar notu vs."></textarea>
                </div>
            `;

            openModal({
                title: 'Yeni Transfer Ata',
                content: formHTML,
                width: '600px',
                onSave: () => {
                    const date = document.getElementById('trfDate').value;
                    const time = document.getElementById('trfTime').value;
                    const vehicle = document.getElementById('trfVehicle').value;

                    if (!date || !time || !vehicle) {
                        alert('Lütfen zorunlu alanları (*) doldurunuz.');
                        return;
                    }

                    const paxSelect = document.getElementById('trfPassengers');
                    const selectedPax = Array.from(paxSelect.selectedOptions).map(opt => opt.value);

                    DB.transfers.create({
                        eventId,
                        date,
                        time,
                        direction: document.getElementById('trfDirection').value,
                        vehicle,
                        driver: document.getElementById('trfDriver').value,
                        driverPhone: document.getElementById('trfDriverPhone').value,
                        notes: document.getElementById('trfNotes').value,
                        passengers: selectedPax
                    });

                    DB.logs.add(`${vehicle} aracı için transfer kaydı oluşturuldu.`, 'success');
                    closeModal();
                    render();
                }
            });
            setTimeout(() => {
                if(typeof initSearchableSelects === 'function') initSearchableSelects();
            }, 100);
        });

        // View Manifest
        container.querySelectorAll('.btn-view-manifest').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const trf = transfers.find(t => t.id === id);
                if(!trf) return;

                let paxHtml = '<div class="empty-state"><p>Bu transfere yolcu atanmamış.</p></div>';
                if(trf.passengers && trf.passengers.length > 0) {
                    paxHtml = `
                        <table class="data-table" style="margin-top: 16px;">
                            <thead>
                                <tr>
                                    <th>Misafir Adı</th>
                                    <th>Firma</th>
                                    <th>Telefon</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${trf.passengers.map(pid => {
                                    const p = participants.find(x => x.id === pid);
                                    if(!p) return '';
                                    return `<tr>
                                        <td style="font-weight:600;">${p.firstName} ${p.lastName}</td>
                                        <td>${p.company || '-'}</td>
                                        <td>${p.phone || '-'}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    `;
                }

                const content = `
                    <div style="background: var(--slate-50); padding: 16px; border-radius: var(--radius-md); margin-bottom: 24px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div><strong>Araç:</strong> ${trf.vehicle}</div>
                            <div><strong>Güzergah:</strong> ${trf.direction === 'arrival' ? 'Havaalanı ➔ Otel' : 'Otel ➔ Havaalanı'}</div>
                            <div><strong>Tarih / Saat:</strong> ${new Date(trf.date).toLocaleDateString('tr-TR')} ${trf.time}</div>
                            <div><strong>Şoför:</strong> ${trf.driver || '-'} (${trf.driverPhone || '-'})</div>
                        </div>
                    </div>
                    <h4 style="font-size: 1rem; font-weight: 600;">Yolcu Manifestosu</h4>
                    ${paxHtml}
                `;

                openModal({
                    title: 'Transfer Detayı',
                    content,
                    width: '600px'
                });
                
                // Remove save button from manifest modal
                const modalSaveBtn = document.querySelector('.modal .btn-primary');
                if(modalSaveBtn) modalSaveBtn.style.display = 'none';
            });
        });

        // Delete
        container.querySelectorAll('.btn-delete-transfer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(confirm('Transfer kaydını silmek istediğinize emin misiniz?')) {
                    DB.transfers.delete(e.currentTarget.dataset.id);
                    DB.logs.add('Bir transfer kaydı silindi.', 'warning');
                    render();
                }
            });
        });
    };

    render();
}
