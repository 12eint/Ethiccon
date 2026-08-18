/**
 * Konaklama: oda kontenjanı, fiyatlandırma ve misafir yerleşimi.
 * Fiyat mantığı core/pricing.js'te; burada yalnızca arayüz var.
 */
import { DB } from '../../core/store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatAmount } from '../../core/format.js';
import { html, raw, showToast, refreshIcons, bindClick } from '../../core/ui.js';
import { isAdmin } from '../../core/auth.js';
import {
  ROOM_TYPES,
  getAccommodationConfig,
  accommodationBreakdown,
  accommodationPrice,
  accommodationPriceSource,
} from '../../core/pricing.js';

const PRICE_SOURCE_HINTS = {
  individual: 'Kişiye özel fiyat',
  company: 'Firma anlaşmalı fiyatı',
  list: 'Genel liste fiyatı',
};

export function renderAccommodationModule(container, eventId, onChange) {
  const refresh = () => (onChange ? onChange() : renderAccommodationModule(container, eventId));

  const admin = isAdmin();
  const config = getAccommodationConfig(eventId);
  const allParticipants = DB.participants.getByEventId(eventId);
  const guests = allParticipants.filter((pax) => pax.accommodation);
  const breakdown = accommodationBreakdown(eventId);
  const totalProfit = breakdown.reduce((sum, row) => sum + row.profit, 0);

  container.innerHTML = html`
    <div class="page-header">
      <h2>Oda Kontenjan ve Fiyatlandırma</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" data-action="company-prices">
          <i data-lucide="tags"></i> Firma Fiyatları
        </button>
        <button class="btn btn-primary btn-sm" data-action="save-allotment">
          <i data-lucide="save"></i> Kontenjanı Kaydet
        </button>
      </div>
    </div>

    <div class="table-container" style="margin-bottom:24px;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Oda Tipi</th>
            <th>Kontenjan</th>
            <th>Maliyet (Alış ₺)</th>
            <th>Liste Satış (₺)</th>
            <th>Satılan</th>
            <th>Doluluk</th>
            ${admin ? raw('<th>Kâr / Zarar</th>') : ''}
          </tr>
        </thead>
        <tbody>
          ${breakdown.map((row) => {
            const occupancy = row.allotment.count > 0
              ? Math.round((row.sold / row.allotment.count) * 100)
              : 0;
            const over = row.allotment.count > 0 && row.sold > row.allotment.count;
            return raw(html`
              <tr>
                <td><strong>${row.type}</strong></td>
                <td><input type="number" class="form-input allotment-input" data-type="${row.type}" data-field="count" value="${row.allotment.count}" min="0" style="width:90px;"></td>
                <td><input type="number" class="form-input allotment-input" data-type="${row.type}" data-field="buyPrice" value="${row.allotment.buyPrice}" min="0" step="0.01" style="width:110px;"></td>
                <td><input type="number" class="form-input allotment-input" data-type="${row.type}" data-field="sellPrice" value="${row.allotment.sellPrice}" min="0" step="0.01" style="width:110px;"></td>
                <td>
                  <strong style="color:${over ? 'var(--danger)' : 'inherit'};">${row.sold}</strong>
                  ${over ? raw('<span class="badge badge-danger" style="margin-left:6px;">Kontenjan aşıldı</span>') : ''}
                </td>
                <td>
                  <div style="height:6px;width:80px;background:var(--slate-200);border-radius:var(--radius-full);overflow:hidden;">
                    <div style="height:100%;width:${Math.min(100, occupancy)}%;background:${over ? 'var(--danger)' : 'var(--primary-500)'};"></div>
                  </div>
                </td>
                ${admin ? raw(html`
                  <td><strong style="color:${row.profit >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatAmount(row.profit)}</strong></td>
                `) : ''}
              </tr>
            `);
          })}
        </tbody>
        ${admin ? raw(html`
          <tfoot>
            <tr style="background:var(--slate-50);">
              <td colspan="6" style="text-align:right;font-weight:700;">Toplam Konaklama Marjı</td>
              <td><strong style="color:${totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatAmount(totalProfit)}</strong></td>
            </tr>
          </tfoot>
        `) : ''}
      </table>
    </div>
    <p style="font-size:0.8rem;color:var(--slate-500);margin:-12px 0 24px;">
      Maliyet, satılan oda değil satın alınan kontenjan üzerinden hesaplanır — bağlanan allotment satılmasa da ödenir.
    </p>

    <div class="page-header">
      <h2>Konaklayan Misafirler</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" data-action="export"><i data-lucide="download"></i> Excel İndir</button>
        <button class="btn btn-secondary btn-sm" data-action="add-guest"><i data-lucide="user-plus"></i> Havuzdan Seç</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Misafir</th><th>Firma</th><th>Oda Tipi</th><th>Satış Fiyatı</th>
            <th>Oda Arkadaşı 1</th><th>Oda Arkadaşı 2</th><th>TC / Pasaport</th>
            <th style="text-align:right;">İşlem</th>
          </tr>
        </thead>
        <tbody>
          ${guests.length === 0
            ? raw('<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--slate-400);">Konaklayan misafir bulunmuyor.</td></tr>')
            : guests.map((guest) => {
                const source = accommodationPriceSource(guest, config);
                return raw(html`
                  <tr>
                    <td><strong>${guest.firstName} ${guest.lastName}</strong></td>
                    <td>${guest.company || '-'}</td>
                    <td>
                      <select class="form-select guest-room-type" data-id="${guest.id}" style="width:100px;">
                        ${ROOM_TYPES.map((type) => raw(html`
                          <option value="${type}" ${guest.roomType === type ? raw('selected') : ''}>${type}</option>
                        `))}
                      </select>
                    </td>
                    <td>
                      <input type="number" class="form-input guest-price" data-id="${guest.id}"
                        value="${accommodationPrice(guest, config)}" min="0" step="0.01" style="width:100px;"
                        title="${PRICE_SOURCE_HINTS[source]}">
                    </td>
                    <td><input type="text" class="form-input guest-field" data-id="${guest.id}" data-field="dblName" value="${guest.dblName ?? ''}" ${guest.roomType === 'SNG' ? raw('disabled') : ''} style="width:130px;"></td>
                    <td><input type="text" class="form-input guest-field" data-id="${guest.id}" data-field="trplName" value="${guest.trplName ?? ''}" ${guest.roomType !== 'TRPL' ? raw('disabled') : ''} style="width:130px;"></td>
                    <td>${guest.tcNo || guest.passportNo || '-'}</td>
                    <td style="text-align:right;">
                      <button class="action-btn delete" data-remove="${guest.id}" title="Otelden çıkar"><i data-lucide="user-minus"></i></button>
                    </td>
                  </tr>
                `);
              })}
        </tbody>
      </table>
    </div>
  `;

  wireAccommodation(container, { eventId, config, allParticipants, guests, refresh });
  refreshIcons(container);
}

function wireAccommodation(container, ctx) {
  const { eventId, config, allParticipants, guests, refresh } = ctx;

  bindClick(container, (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;

    if (action === 'save-allotment') {
      const allotment = {};
      ROOM_TYPES.forEach((type) => { allotment[type] = { count: 0, buyPrice: 0, sellPrice: 0 }; });
      container.querySelectorAll('.allotment-input').forEach((input) => {
        allotment[input.dataset.type][input.dataset.field] = Number(input.value) || 0;
      });
      DB.accommodations.createOrUpdate(eventId, { allotment, companyPrices: config.companyPrices });
      showToast('Kontenjan ve fiyatlar kaydedildi.');
      refresh();
      return;
    }

    if (action === 'company-prices') return openCompanyPricesModal(eventId, config, allParticipants, refresh);
    if (action === 'add-guest') return openGuestPickerModal(allParticipants, refresh);
    if (action === 'export') return exportAccommodation(guests, config);

    const removeId = event.target.closest('[data-remove]')?.dataset.remove;
    if (!removeId) return;
    if (!window.confirm('Misafir otel listesinden çıkarılsın mı? (Kayıt havuzundan silinmez)')) return;
    DB.participants.update(removeId, { accommodation: false, roomType: '', dblName: '', trplName: '', accSellPrice: '' });
    showToast('Misafir otel listesinden çıkarıldı.');
    refresh();
  });

  // Oda tipi değişince kâr tablosu ve alan kilitleri değiştiği için yeniden çiziyoruz.
  container.querySelectorAll('.guest-room-type').forEach((select) => {
    select.addEventListener('change', () => {
      DB.participants.update(select.dataset.id, { roomType: select.value });
      refresh();
    });
  });

  container.querySelectorAll('.guest-price').forEach((input) => {
    input.addEventListener('change', () => {
      DB.participants.update(input.dataset.id, { accSellPrice: Number(input.value) || 0 });
      refresh();
    });
  });

  // İsim alanları kâr hesabını etkilemez; yeniden çizmeden kaydedilir.
  container.querySelectorAll('.guest-field').forEach((input) => {
    input.addEventListener('change', () => {
      DB.participants.update(input.dataset.id, { [input.dataset.field]: input.value });
      showToast('Oda arkadaşı bilgisi kaydedildi.');
    });
  });
}

function openCompanyPricesModal(eventId, config, participants, onDone) {
  const companies = [...new Set(participants.map((pax) => pax.company).filter((c) => c && c.trim()))].sort();

  openModal({
    title: 'Firma Özel Oda Fiyatları',
    width: '720px',
    content: html`
      <p style="margin-bottom:16px;font-size:0.85rem;color:var(--slate-500);">
        Boş bırakılan hücrelerde genel liste fiyatı uygulanır. Kişiye özel fiyat girilmişse o her zaman önceliklidir.
      </p>
      ${companies.length === 0
        ? raw('<p style="text-align:center;color:var(--slate-400);padding:24px;">Firma bilgisi olan misafir bulunmuyor.</p>')
        : raw(html`
          <table class="data-table">
            <thead>
              <tr><th>Firma</th>${ROOM_TYPES.map((type) => raw(html`<th>${type}</th>`))}</tr>
            </thead>
            <tbody>
              ${companies.map((company) => raw(html`
                <tr>
                  <td><strong>${company}</strong></td>
                  ${ROOM_TYPES.map((type) => raw(html`
                    <td>
                      <input type="number" class="form-input company-price" data-company="${company}" data-type="${type}"
                        value="${config.companyPrices?.[company]?.[type] ?? ''}" min="0" step="0.01" style="width:100px;">
                    </td>
                  `))}
                </tr>
              `))}
            </tbody>
          </table>
        `)}
    `,
    onSave: () => {
      const companyPrices = {};
      document.querySelectorAll('.company-price').forEach((input) => {
        const { company, type } = input.dataset;
        companyPrices[company] ??= {};
        // Boş değer "fiyat tanımlı değil" demek; 0 ile karıştırılmamalı.
        if (input.value !== '') companyPrices[company][type] = Number(input.value);
      });
      DB.accommodations.createOrUpdate(eventId, { allotment: config.allotment, companyPrices });
      closeModal();
      showToast('Firma fiyatları kaydedildi.');
      onDone();
    },
  });
}

function openGuestPickerModal(participants, onDone) {
  const pool = participants.filter((pax) => !pax.accommodation);

  openModal({
    title: 'Havuzdan Misafir Seç',
    width: '640px',
    content: html`
      <div style="max-height:360px;overflow-y:auto;margin-bottom:16px;">
        <table class="data-table" style="font-size:0.85rem;">
          <thead><tr><th style="width:48px;">Seç</th><th>İsim Soyisim</th><th>Firma</th></tr></thead>
          <tbody>
            ${pool.length === 0
              ? raw('<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--slate-400);">Havuzda uygun misafir yok. Önce kayıt ekleyin.</td></tr>')
              : pool.map((pax) => raw(html`
                <tr>
                  <td><input type="checkbox" class="guest-pick" value="${pax.id}"></td>
                  <td>${pax.firstName} ${pax.lastName}</td>
                  <td>${pax.company || '-'}</td>
                </tr>
              `))}
          </tbody>
        </table>
      </div>
      <div class="form-group">
        <label class="form-label">Atanacak Oda Tipi</label>
        <select class="form-select" id="bulkRoomType">
          ${ROOM_TYPES.map((type) => raw(html`<option value="${type}">${type}</option>`))}
        </select>
      </div>
    `,
    onSave: () => {
      const picked = [...document.querySelectorAll('.guest-pick:checked')];
      if (picked.length === 0) {
        showToast('Lütfen en az bir misafir seçin.', 'error');
        return;
      }
      const roomType = document.getElementById('bulkRoomType').value;
      picked.forEach((checkbox) => {
        DB.participants.update(checkbox.value, { accommodation: true, roomType });
      });
      closeModal();
      showToast(`${picked.length} misafir otele eklendi.`);
      onDone();
    },
  });
}

function exportAccommodation(guests, config) {
  if (guests.length === 0) {
    showToast('Dışa aktarılacak kayıt bulunamadı.', 'error');
    return;
  }

  const rows = guests.map((guest) => ({
    'YETKİLİ': guest.authorizedPerson ?? '',
    'FİRMA': guest.company ?? '',
    'İSİM': guest.firstName ?? '',
    'SOYAD': guest.lastName ?? '',
    'TELEFON': guest.phone ?? '',
    'DOĞUM T.': guest.birthDate ?? '',
    'TC NO': guest.tcNo ?? '',
    'PASAPORT NO': guest.passportNo ?? '',
    'ODA TİPİ': guest.roomType ?? '',
    'SATIŞ FİYATI': accommodationPrice(guest, config),
    'ODA ARKADAŞI 1': guest.dblName ?? '',
    'ODA ARKADAŞI 2': guest.trplName ?? '',
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Konaklama');
  XLSX.writeFile(workbook, 'konaklama_listesi.xlsx');
  showToast(`${guests.length} konaklama kaydı dışa aktarıldı.`);
}
