import { DB } from '../db.js';
import { initSearchableSelects } from '../app.js';

export function renderProforma(container) {
    const events = DB.events.getAll();
    const companies = DB.companies.getAll();
    
    if (events.length === 0) {
        container.innerHTML = `<div class="card" style="padding:48px; text-align:center;">Hiç organizasyon bulunamadı.</div>`;
        return;
    }

    let selectedEventId = events[0].id;
    let selectedCompany = '';

    const render = () => {
        let contentHTML = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--slate-900);">Proforma Fatura Modülü</h2>
                    <p style="color: var(--slate-500); font-size: 0.875rem;">Firma bazlı maliyetlendirme ve otomatik fatura özeti</p>
                </div>
            </div>

            <div class="card" style="margin-bottom: 24px; padding: 24px; display: flex; gap: 16px; align-items: flex-end; animation: slideUp 0.3s ease;">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Organizasyon</label>
                    <select class="form-select searchable-select" id="profEvent">
                        ${events.map(e => `<option value="${e.id}" ${e.id === selectedEventId ? 'selected' : ''}>${e.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Fatura Edilecek Firma</label>
                    <select class="form-select searchable-select" id="profCompany">
                        <option value="">-- Firma Seçin --</option>
                        ${companies.map(c => `<option value="${c.name}" ${c.name === selectedCompany ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <button class="btn btn-primary" id="btnGenerateProforma" style="padding: 10px 24px;" ${!selectedCompany ? 'disabled' : ''}>
                        <i data-lucide="file-text"></i> Görüntüle
                    </button>
                </div>
            </div>
        `;

        if (selectedCompany) {
            contentHTML += generateProformaTable(selectedEventId, selectedCompany);
        }

        container.innerHTML = contentHTML;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        initSearchableSelects(container);

        container.querySelector('#profEvent').addEventListener('change', (e) => {
            selectedEventId = e.target.value;
            render();
        });

        container.querySelector('#profCompany').addEventListener('change', (e) => {
            selectedCompany = e.target.value;
            // Enable button dynamically
            const btn = container.querySelector('#btnGenerateProforma');
            if (selectedCompany) btn.removeAttribute('disabled');
            else btn.setAttribute('disabled', 'true');
        });

        container.querySelector('#btnGenerateProforma').addEventListener('click', () => {
            render(); // Re-render to show table
        });

        const printBtn = container.querySelector('#btnPrintProforma');
        if (printBtn) {
            printBtn.addEventListener('click', exportToPDF);
        }
    };

    const generateProformaTable = (eventId, companyName) => {
        const participants = DB.participants.getByEventId(eventId).filter(p => p.company === companyName);
        const flights = DB.flights.getByEventId(eventId).filter(f => {
            const p = DB.participants.getById(f.participantId);
            return p && p.company === companyName;
        });
        const accData = DB.accommodations.getByEventId(eventId) || { allotment: {}, companyPrices: {} };

        if (participants.length === 0 && flights.length === 0) {
            return `<div class="card" style="padding:48px; text-align:center;">Bu firmaya ait veri bulunamadı.</div>`;
        }

        const compDetails = DB.companies.getAll().find(c => c.name === companyName) || {};
        const eventData = DB.events.getById(eventId);
        const settings = DB.settings.get();

        let html = `
            <div class="card" id="proformaDocument" style="padding: 48px; animation: slideUp 0.4s ease;">
                <!-- Proforma Header -->
                <div style="display: flex; justify-content: space-between; border-bottom: 2px solid var(--slate-200); padding-bottom: 24px; margin-bottom: 32px; align-items: center;">
                    <div style="display: flex; gap: 24px; align-items: center;">
                        ${settings.agencyLogo ? `<img src="${settings.agencyLogo}" style="max-height: 80px; max-width: 150px; object-fit: contain;">` : ''}
                        <div>
                            <h1 style="font-size: 2rem; font-weight: 800; color: var(--primary-700); margin: 0;">PROFORMA FATURA</h1>
                            <p style="color: var(--slate-500); font-size: 0.875rem; margin-top: 4px;">Tarih: ${new Date().toLocaleDateString('tr-TR')}</p>
                            ${settings.agencyName ? `<p style="font-size:0.875rem; font-weight:600; margin-top:4px;">${settings.agencyName}</p>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="font-size: 1.125rem; font-weight: 700; color: var(--slate-900);">${eventData.name}</h3>
                        <p style="color: var(--slate-500); font-size: 0.875rem;">${eventData.city || ''} / ${eventData.venue || ''}</p>
                        <p style="color: var(--slate-500); font-size: 0.875rem;">${eventData.startDate || ''} - ${eventData.endDate || ''}</p>
                    </div>
                </div>

                <!-- Client Details -->
                <div style="margin-bottom: 32px; padding: 16px; background: var(--slate-50); border-radius: var(--radius-md);">
                    <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 8px;">Fatura Edilecek Firma:</h4>
                    <p style="margin:0; font-weight: 600;">${compDetails.commercialTitle || compDetails.name || companyName}</p>
                    <p style="margin:4px 0 0 0; font-size: 0.875rem; color: var(--slate-600);">${compDetails.address || 'Adres bilgisi yok'}</p>
                    <p style="margin:4px 0 0 0; font-size: 0.875rem; color: var(--slate-600);">VD: ${compDetails.taxOffice || '-'} / VN: ${compDetails.taxNumber || '-'}</p>
                </div>
        `;

        let totalSub = 0;
        let totalTax = 0;

        // 1. Kayıtlar (Registration) -> %20 KDV
        let regTotal = 0;
        const regRows = participants.filter(p => p.regSellPrice && p.regSellPrice > 0).map(p => {
            const price = Number(p.regSellPrice);
            regTotal += price;
            return `<tr><td>${p.firstName} ${p.lastName}</td><td>Kayıt Bedeli</td><td style="text-align:right;">1</td><td style="text-align:right;">₺${price.toLocaleString('tr-TR')}</td><td style="text-align:right;">₺${price.toLocaleString('tr-TR')}</td></tr>`;
        });

        // 2. Konaklama (Accommodation) -> %8 KDV (veya %10)
        let accTotal = 0;
        const accRows = participants.filter(p => p.accommodation).map(p => {
            const type = p.roomType;
            const al = accData.allotment[type] || { sellPrice: 0 };
            let price = p.accSellPrice;
            if (price === undefined || price === null || price === '') {
                if (p.company && accData.companyPrices[p.company] && accData.companyPrices[p.company][type]) {
                    price = accData.companyPrices[p.company][type];
                } else { price = al.sellPrice; }
            }
            price = Number(price) || 0;
            accTotal += price;
            return `<tr><td>${p.firstName} ${p.lastName}</td><td>${type} Oda Konaklama</td><td style="text-align:right;">1</td><td style="text-align:right;">₺${price.toLocaleString('tr-TR')}</td><td style="text-align:right;">₺${price.toLocaleString('tr-TR')}</td></tr>`;
        });

        // 3. Uçak (Flights) -> %18 KDV (veya %20)
        let flTotal = 0;
        const flRows = flights.map(f => {
            const p = DB.participants.getById(f.participantId);
            const pName = p ? `${p.firstName} ${p.lastName}` : 'Misafir';
            const price = Number(f.sellPrice) || 0;
            flTotal += price;
            return `<tr><td>${pName}</td><td>Uçak Bileti (${f.airline || '-'})</td><td style="text-align:right;">1</td><td style="text-align:right;">₺${price.toLocaleString('tr-TR')}</td><td style="text-align:right;">₺${price.toLocaleString('tr-TR')}</td></tr>`;
        });

        if (regRows.length > 0 || accRows.length > 0 || flRows.length > 0) {
            html += `
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 0.875rem;">
                    <thead>
                        <tr style="background: var(--slate-100); border-bottom: 2px solid var(--slate-300);">
                            <th style="padding: 12px; text-align: left;">Misafir</th>
                            <th style="padding: 12px; text-align: left;">Hizmet Tipi</th>
                            <th style="padding: 12px; text-align: right;">Adet</th>
                            <th style="padding: 12px; text-align: right;">Birim Fiyat</th>
                            <th style="padding: 12px; text-align: right;">Toplam</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${regRows.join('')}
                        ${accRows.join('')}
                        ${flRows.join('')}
                    </tbody>
                </table>
            `;

            totalSub = regTotal + accTotal + flTotal;
            // Basit KDV hesaplaması (Kayıt: %20, Oda: %10, Uçak: %20)
            totalTax = (regTotal * 0.20) + (accTotal * 0.10) + (flTotal * 0.20);
        }

        html += `
                <div style="display: flex; justify-content: flex-end; margin-bottom: 48px;">
                    <div style="width: 300px;">
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--slate-200);">
                            <span style="color: var(--slate-600);">Ara Toplam:</span>
                            <span style="font-weight: 600;">₺${totalSub.toLocaleString('tr-TR')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--slate-200);">
                            <span style="color: var(--slate-600);">Hesaplanan KDV:</span>
                            <span style="font-weight: 600;">₺${totalTax.toLocaleString('tr-TR')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 16px 0; font-size: 1.25rem;">
                            <span style="font-weight: 700; color: var(--slate-900);">GENEL TOPLAM:</span>
                            <span style="font-weight: 800; color: var(--primary-600);">₺${(totalSub + totalTax).toLocaleString('tr-TR')}</span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--slate-200); padding-top: 24px; margin-bottom: 24px;">
                    <div style="flex: 1; margin-right: 24px;">
                        <strong>Banka ve Ödeme Bilgileri:</strong>
                        <div style="color: var(--slate-600); font-size: 0.875rem; margin-top: 4px; white-space: pre-wrap;">${settings.agencyIban || 'Lütfen sistem ayarlarından IBAN bilginizi giriniz.'}</div>
                    </div>
                    <div style="flex: 1; text-align: right;">
                        <strong>Acente Adres:</strong>
                        <div style="color: var(--slate-600); font-size: 0.875rem; margin-top: 4px; white-space: pre-wrap;">${settings.agencyAddress || 'Adres bilgisi bulunmuyor.'}</div>
                    </div>
                </div>

                <div style="text-align: center; border-top: 1px solid var(--slate-200); padding-top: 24px;" id="proformaActionArea">
                    <button class="btn btn-secondary" id="btnPrintProforma" style="margin-right: 12px;">
                        <i data-lucide="printer"></i> PDF Olarak İndir / Yazdır
                    </button>
                    <p style="margin-top: 16px; font-size: 0.75rem; color: var(--slate-400);">Bu belge bilgi amaçlı proforma faturadır, mali değeri yoktur.</p>
                </div>
            </div>
        `;

        return html;
    };

    const exportToPDF = () => {
        const element = document.getElementById('proformaDocument');
        if (!element) return;
        
        // Hide action area for PDF
        const actionArea = element.querySelector('#proformaActionArea');
        if (actionArea) actionArea.style.display = 'none';
        
        // Remove box-shadow/animations for clean render
        const originalShadow = element.style.boxShadow;
        const originalAnimation = element.style.animation;
        element.style.boxShadow = 'none';
        element.style.animation = 'none';

        const opt = {
            margin:       10,
            filename:     `proforma_${selectedCompany.replace(/\s+/g, '_')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(element).save().then(() => {
                // Restore UI
                if (actionArea) actionArea.style.display = 'block';
                element.style.boxShadow = originalShadow;
                element.style.animation = originalAnimation;
                
                const toast = document.createElement('div');
                toast.className = 'toast toast-success';
                toast.textContent = 'Proforma fatura başarıyla indirildi.';
                document.getElementById('toastContainer').appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }).catch(err => {
                console.error('PDF oluşturma hatası:', err);
                if (actionArea) actionArea.style.display = 'block';
                const toast = document.createElement('div');
                toast.className = 'toast toast-error';
                toast.textContent = 'PDF oluşturulurken hata oluştu.';
                document.getElementById('toastContainer').appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            });
        } else {
            alert("PDF motoru yüklenemedi. Lütfen sayfayı yenileyin.");
            if (actionArea) actionArea.style.display = 'block';
        }
    };

    render();
}
