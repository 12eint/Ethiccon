import { DB } from '../../db.js';
import { initSearchableSelects } from '../../app.js';

export function renderCommunicationModule(container, eventId) {
    const render = () => {
        const participants = DB.participants.getByEventId(eventId);
        const sponsors = DB.sponsors.getByEventId(eventId);

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700;">Toplu İletişim & E-Posta Gönderimi</h3>
                <div class="badge badge-success"><i data-lucide="check-circle" style="width:14px; margin-right:4px;"></i>SMTP Aktif</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 24px;">
                <!-- Left Sidebar: Selection -->
                <div class="card" style="margin: 0;">
                    <h4 style="font-size: 1rem; margin-top: 0; margin-bottom: 16px;">Kime Gönderilecek?</h4>
                    
                    <div class="form-group">
                        <label class="form-label">Hedef Kitle Seçimi</label>
                        <select class="form-select" id="mailTargetType">
                            <option value="all">Tüm Kayıtlı Misafirler (${participants.length} Kişi)</option>
                            <option value="specific">Belirli Kişileri Seç</option>
                            <option value="sponsors">Tüm Sponsor Firmalar (${sponsors.length} Firma)</option>
                        </select>
                    </div>

                    <div class="form-group" id="specificUsersGroup" style="display: none;">
                        <label class="form-label">Kişi Seçin</label>
                        <select class="form-select searchable-select" id="mailSpecificUsers" multiple>
                            ${participants.map(p => `<option value="${p.email || p.id}">${p.firstName} ${p.lastName} (${p.email || 'E-posta yok'})</option>`).join('')}
                        </select>
                    </div>

                    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--slate-100);">
                        <h4 style="font-size: 1rem; margin-top: 0; margin-bottom: 16px;">Hazır Şablonlar</h4>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <button class="btn btn-secondary template-btn" data-template="welcome">Karşılama / Bilgilendirme</button>
                            <button class="btn btn-secondary template-btn" data-template="ticket">Uçuş & Otel Bileti Gönderimi</button>
                            <button class="btn btn-secondary template-btn" data-template="proforma">Proforma Fatura Gönderimi</button>
                        </div>
                    </div>
                </div>

                <!-- Right Side: Composer -->
                <div class="card" style="margin: 0; display: flex; flex-direction: column;">
                    <div class="form-group">
                        <label class="form-label">E-Posta Konusu</label>
                        <input type="text" class="form-input" id="mailSubject" placeholder="Örn: Kongre Katılım Detaylarınız Hakkında">
                    </div>
                    
                    <div class="form-group" style="flex: 1; display: flex; flex-direction: column;">
                        <label class="form-label">Mesaj İçeriği</label>
                        <textarea class="form-textarea" id="mailBody" style="flex: 1; min-height: 250px; font-family: monospace;" placeholder="Mesajınızı buraya yazın..."></textarea>
                    </div>

                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-top: 16px;">
                        <label class="form-checkbox-group" style="color: var(--slate-500); font-size: 0.85rem;">
                            <input type="checkbox" class="form-checkbox" checked> Gönderim loglarını kaydet
                        </label>
                        <button class="btn btn-primary" id="btnSendMail" style="padding-left: 32px; padding-right: 32px;">
                            <i data-lucide="send"></i> Gönder
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({nodes: [container]});

        // Toggle specific users
        const targetType = container.querySelector('#mailTargetType');
        const specificGroup = container.querySelector('#specificUsersGroup');
        targetType.addEventListener('change', (e) => {
            if (e.target.value === 'specific') {
                specificGroup.style.display = 'block';
                if(typeof initSearchableSelects === 'function') initSearchableSelects(specificGroup);
            } else {
                specificGroup.style.display = 'none';
            }
        });

        // Templates
        const templates = {
            welcome: {
                subject: 'Kongre Katılımınız Hakkında Bilgilendirme',
                body: `Sayın Katılımcımız,\n\nOrganizasyonumuza kaydınız başarıyla alınmıştır. Etkinlik detayları ve yaka kartı QR kodunuz ekte yer almaktadır.\n\nSaygılarımızla,\nOrganizasyon Komitesi`
            },
            ticket: {
                subject: 'Uçuş ve Konaklama Biletiniz (E-Bilet)',
                body: `Sayın Katılımcımız,\n\nOrganizasyon kapsamındaki uçuş ve konaklama rezervasyonlarınız yapılmıştır. Bilet detaylarınıza sistem üzerinden veya e-posta ekinden ulaşabilirsiniz.\n\nİyi yolculuklar dileriz.`
            },
            proforma: {
                subject: 'Etkinlik Katılımı - Proforma Fatura',
                body: `Sayın Yetkili,\n\nEtkinlik katılımınıza istinaden hazırlanan proforma fatura ektedir. Ödemenizi faturada belirtilen hesap numaralarına yapmanızı rica ederiz.\n\nİyi çalışmalar.`
            }
        };

        container.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.currentTarget.dataset.template;
                container.querySelector('#mailSubject').value = templates[key].subject;
                container.querySelector('#mailBody').value = templates[key].body;
                
                container.querySelectorAll('.template-btn').forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-secondary');
                });
                e.currentTarget.classList.remove('btn-secondary');
                e.currentTarget.classList.add('btn-primary');
            });
        });

        // Send logic
        container.querySelector('#btnSendMail').addEventListener('click', () => {
            const subject = container.querySelector('#mailSubject').value;
            const body = container.querySelector('#mailBody').value;
            
            if(!subject || !body) {
                alert('Lütfen e-posta konusu ve içeriğini doldurun.');
                return;
            }

            // Simulate Send
            const btn = container.querySelector('#btnSendMail');
            btn.innerHTML = `<div class="loader-spinner" style="width:16px;height:16px;border-width:2px;"></div> Gönderiliyor...`;
            btn.disabled = true;

            setTimeout(() => {
                let count = targetType.value === 'all' ? participants.length : 
                            targetType.value === 'sponsors' ? sponsors.length : 
                            container.querySelector('#mailSpecificUsers').selectedOptions.length;
                            
                if (count === 0) count = 1; // fallback if someone selects specific but forgets to choose
                
                DB.logs.add(`${count} kişiye "${subject}" konulu e-posta başarıyla gönderildi.`, 'success');
                
                const toast = document.createElement('div');
                toast.className = 'toast toast-success';
                toast.textContent = `${count} e-posta başarıyla SMTP kuyruğuna alındı.`;
                document.getElementById('toastContainer').appendChild(toast);
                setTimeout(() => toast.remove(), 4000);

                btn.innerHTML = `<i data-lucide="send"></i> Gönder`;
                btn.disabled = false;
                lucide.createIcons({nodes: [btn]});
            }, 1200);
        });
    };

    render();
}
