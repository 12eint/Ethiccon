/**
 * Kayıt (misafir) yönetimi.
 *
 * Bu modül daha önce hiçbir yerden import edilmiyordu; bütçe ve proforma
 * hesaplarının dayandığı alanları (regPeriod, accommodation, roomType…)
 * yazan tek yer olduğu için sistemin gelir tarafı boş çalışıyordu.
 */
import { DB } from '../../core/store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatAmount } from '../../core/format.js';
import { html, raw, showToast, refreshIcons, initSearchableSelects, bindClick, alertBand } from '../../core/ui.js';
import { getCurrentUser, isAdmin, hasPermission } from '../../core/auth.js';
import { registrationPrice, ROOM_TYPES, ROOM_TYPE_LABELS } from '../../core/pricing.js';

const DRAFT_KEY = 'ethiccon_draft_registration';

const PERIOD_BADGES = {
  early: '<span class="badge badge-success">Erken Kayıt</span>',
  late: '<span class="badge badge-warning">Geç Kayıt</span>',
  custom: '<span class="badge badge-purple">Özel Fiyat</span>',
};

/** Excel şablonundaki sütun başlıkları ile katılımcı alanlarının eşlemesi. */
const EXCEL_COLUMNS = {
  'YETKİLİ': 'authorizedPerson',
  'FİRMA': 'company',
  'İSİM': 'firstName',
  'SOYAD': 'lastName',
  'MAİL ADRESİ': 'email',
  'TELEFON': 'phone',
  'DOĞUM T.': 'birthDate',
  'TC NO': 'tcNo',
  'PASAPORT NO': 'passportNo',
  'GEÇERLİLİK TARİHİ': 'passportExpiry',
  'KALKIŞ ŞEHRİ': 'depCity',
};

export function renderRegistrationModule(container, eventId, onChange) {
  const refresh = () => (onChange ? onChange() : renderRegistrationModule(container, eventId));

  const admin = isAdmin();
  const event = DB.events.getById(eventId) ?? {};
  const participants = DB.participants.getByEventId(eventId);
  const canDelete = hasPermission('delete_pax');
  const canExport = hasPermission('export_excel');

  const pricesUnset = !Number(event.earlyRegPrice) && !Number(event.lateRegPrice);
  const companies = [...new Set(participants.map((p) => p.company).filter(Boolean))].sort();

  container.innerHTML = html`
    <div class="page-header" style="flex-wrap:wrap;gap:12px;">
      <h2>Kayıt (Misafir) Yönetimi</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" data-action="template">
          <i data-lucide="download"></i> Excel Şablonu
        </button>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0;">
          <i data-lucide="upload"></i> Excel'den Yükle
          <input type="file" data-action="import" accept=".xlsx,.xls" hidden>
        </label>
        <button class="btn btn-secondary btn-sm" data-action="rooming">
          <i data-lucide="building"></i> Rooming List
        </button>
        ${canExport ? raw('<button class="btn btn-secondary btn-sm" data-action="export"><i data-lucide="file-down"></i> Excel\'e Aktar</button>') : ''}
        <button class="btn btn-primary btn-sm" data-action="add">
          <i data-lucide="user-plus"></i> Manuel Kayıt
        </button>
      </div>
    </div>

    ${pricesUnset ? raw(alertBand({
      type: 'warning',
      message: 'Bu organizasyonun erken/geç kayıt fiyatı belirlenmemiş; kayıt geliri sıfır hesaplanır.',
      action: { label: 'Ayarlara Git', attrs: 'data-tab-link="settings"' },
    })) : ''}

    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
      <div style="position:relative;flex:1;min-width:220px;">
        <i data-lucide="search" style="width:15px;height:15px;opacity:0.4;position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;"></i>
        <input type="text" id="regSearch" class="form-input" placeholder="İsim, e-posta veya telefon ara..." style="padding-left:34px;height:36px;font-size:0.85rem;">
      </div>
      <select id="regCompanyFilter" class="form-select" style="height:36px;font-size:0.85rem;min-width:180px;width:auto;">
        <option value="">Tüm Firmalar</option>
        ${companies.map((name) => raw(html`<option value="${name}">${name}</option>`))}
      </select>
    </div>

    <div class="table-container">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Yetkili</th><th>Firma</th><th>İsim Soyisim</th><th>İletişim</th>
              <th>TC / Pasaport</th><th>Kalkış</th><th>Kayıt Tipi</th>
              <th>Konaklama</th><th>İşlemi Yapan</th><th style="text-align:right;">İşlem</th>
            </tr>
          </thead>
          <tbody id="regRows">
            ${participants.length === 0
              ? raw('<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--slate-400);">Kayıtlı misafir bulunmuyor.</td></tr>')
              : participants.map((pax) => raw(participantRow(pax, event, admin, canDelete)))}
          </tbody>
        </table>
      </div>
    </div>
  `;

  wireFilters(container, participants);
  wireActions(container, { eventId, event, participants, refresh });
  refreshIcons(container);
}

function participantRow(pax, event, admin, canDelete) {
  const price = registrationPrice(pax, event);
  const searchIndex = [pax.firstName, pax.lastName, pax.email, pax.phone]
    .filter(Boolean).join(' ').toLowerCase();

  return html`
    <tr data-search="${searchIndex}" data-company="${(pax.company ?? '').toLowerCase()}">
      <td>${pax.authorizedPerson || '-'}</td>
      <td>${pax.company || '-'}</td>
      <td><strong>${pax.firstName} ${pax.lastName}</strong></td>
      <td>
        <div style="font-size:0.75rem;">
          <div>${pax.phone || '-'}</div>
          <div style="color:var(--slate-500);">${pax.email || '-'}</div>
        </div>
      </td>
      <td>
        <div style="font-size:0.75rem;">
          <div>TC: ${pax.tcNo || '-'}</div>
          <div style="color:var(--slate-500);">Pas: ${pax.passportNo || '-'}</div>
        </div>
      </td>
      <td>${pax.depCity || '-'}</td>
      <td>
        <div style="margin-bottom:4px;">${raw(PERIOD_BADGES[pax.regPeriod] ?? PERIOD_BADGES.early)}</div>
        ${admin ? raw(html`<div style="color:var(--success);font-weight:600;font-size:0.8rem;">${formatAmount(price)}</div>`) : ''}
      </td>
      <td>
        ${pax.accommodation
          ? raw(html`<span class="badge badge-info">${pax.roomType || 'Oda?'}</span>`)
          : raw('<span style="color:var(--slate-400);">-</span>')}
      </td>
      <td style="font-size:0.75rem;color:var(--slate-500);">${pax.createdBy || '-'}</td>
      <td style="text-align:right;">
        <div class="action-btns" style="justify-content:flex-end;">
          <button class="action-btn edit" data-edit="${pax.id}" title="Düzenle"><i data-lucide="pencil"></i></button>
          ${canDelete ? raw(html`<button class="action-btn delete" data-delete="${pax.id}" title="Sil"><i data-lucide="trash-2"></i></button>`) : ''}
        </div>
      </td>
    </tr>
  `;
}

function wireFilters(container) {
  const search = container.querySelector('#regSearch');
  const companyFilter = container.querySelector('#regCompanyFilter');

  const apply = () => {
    const query = search.value.trim().toLowerCase();
    const company = companyFilter.value.toLowerCase();
    container.querySelectorAll('#regRows tr[data-search]').forEach((row) => {
      const matchesQuery = !query || row.dataset.search.includes(query);
      const matchesCompany = !company || row.dataset.company === company;
      row.style.display = matchesQuery && matchesCompany ? '' : 'none';
    });
  };

  search.addEventListener('input', apply);
  companyFilter.addEventListener('change', apply);
}

function wireActions(container, ctx) {
  const { eventId, event, participants, refresh } = ctx;

  // Butonların bir kısmı yetkiye bağlı render edildiği için tek tek
  // querySelector yerine delegasyon kullanıyoruz; eksik buton hata vermez.
  bindClick(container, (clickEvent) => {
    const action = clickEvent.target.closest('[data-action]')?.dataset.action;

    if (action === 'template') return downloadTemplate();
    if (action === 'export') return exportParticipants(event, participants);
    if (action === 'rooming') return exportRoomingList(event, participants);
    if (action === 'add') return openParticipantModal({ eventId, participant: null, onDone: refresh });

    const editId = clickEvent.target.closest('[data-edit]')?.dataset.edit;
    if (editId) {
      return openParticipantModal({
        eventId,
        participant: DB.participants.getById(editId),
        onDone: refresh,
      });
    }

    const deleteId = clickEvent.target.closest('[data-delete]')?.dataset.delete;
    if (!deleteId) return;
    const pax = DB.participants.getById(deleteId);
    if (!pax) return;
    if (!window.confirm(`"${pax.firstName} ${pax.lastName}" ve bağlı uçuş kayıtları silinecek. Emin misiniz?`)) return;
    DB.participants.delete(deleteId);
    DB.logs.add(`Misafir silindi: ${pax.firstName} ${pax.lastName}`, 'warning');
    showToast('Misafir silindi.');
    refresh();
  });

  container.querySelector('[data-action="import"]')
    ?.addEventListener('change', (changeEvent) => importParticipants(changeEvent, eventId, refresh));
}

// ── Excel ────────────────────────────────────────────────────────────────

function downloadTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([Object.keys(EXCEL_COLUMNS)]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Kayıtlar');
  XLSX.writeFile(workbook, 'kayit_sablonu.xlsx');
}

function importParticipants(changeEvent, eventId, onDone) {
  const file = changeEvent.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const workbook = XLSX.read(loadEvent.target.result, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      const createdBy = getCurrentUser()?.name ?? 'Bilinmiyor';

      let added = 0;
      let skipped = 0;

      rows.forEach((row) => {
        const record = { eventId, regPeriod: 'early', accommodation: false, createdBy };
        Object.entries(EXCEL_COLUMNS).forEach(([header, field]) => {
          record[field] = row[header] != null ? String(row[header]).trim() : '';
        });

        // Ad veya soyadı olmayan satır kayıt sayılmaz.
        if (!record.firstName && !record.lastName) {
          skipped += 1;
          return;
        }
        DB.participants.create(record);
        added += 1;
      });

      DB.logs.add(`Excel'den ${added} misafir kaydı içe aktarıldı.`, 'success');
      showToast(
        skipped > 0 ? `${added} kayıt eklendi, ${skipped} boş satır atlandı.` : `${added} kayıt eklendi.`,
      );
      onDone();
    } catch (error) {
      console.error('[registration] Excel okunamadı:', error);
      showToast('Dosya okunamadı. Şablona uygun olduğundan emin olun.', 'error');
    } finally {
      changeEvent.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportParticipants(event, participants) {
  if (participants.length === 0) {
    showToast('Dışa aktarılacak kayıt bulunamadı.', 'error');
    return;
  }

  const rows = participants.map((pax) => ({
    'Yetkili': pax.authorizedPerson ?? '',
    'Firma': pax.company ?? '',
    'İsim': pax.firstName ?? '',
    'Soyisim': pax.lastName ?? '',
    'E-posta': pax.email ?? '',
    'Telefon': pax.phone ?? '',
    'TC No': pax.tcNo ?? '',
    'Pasaport No': pax.passportNo ?? '',
    'Kalkış Şehri': pax.depCity ?? '',
    'Kayıt Dönemi': { late: 'Geç Kayıt', custom: 'Özel Fiyat' }[pax.regPeriod] ?? 'Erken Kayıt',
    'Fiyat': registrationPrice(pax, event),
    'Konaklama': pax.accommodation ? (pax.roomType || 'Var') : 'Yok',
    'İşlemi Yapan': pax.createdBy ?? '',
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Katılımcılar');
  XLSX.writeFile(workbook, `${event.name || 'organizasyon'}_katilimcilar.xlsx`);
  showToast(`${participants.length} katılımcı dışa aktarıldı.`);
}

/**
 * Otel için oda listesi.
 * Önceki sürüm var olmayan bir accommodations.items alanını okumaya
 * çalıştığı için bu buton her seferinde hata veriyordu; veriler
 * doğrudan misafir kaydından alınıyor.
 */
function exportRoomingList(event, participants) {
  const guests = participants.filter((pax) => pax.accommodation);
  if (guests.length === 0) {
    showToast('Konaklamalı misafir bulunamadı.', 'error');
    return;
  }

  const rows = guests
    .map((guest) => ({
      'Giriş Tarihi': guest.checkIn ?? '',
      'Çıkış Tarihi': guest.checkOut ?? '',
      'Oda Tipi': guest.roomType ?? '',
      'Ad Soyad': `${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim(),
      'Firma': guest.company ?? '',
      'Telefon': guest.phone ?? '',
      'TC / Pasaport': guest.tcNo || guest.passportNo || '',
      'Oda Arkadaşı 1': guest.dblName ?? '',
      'Oda Arkadaşı 2': guest.trplName ?? '',
    }))
    .sort((a, b) =>
      a['Giriş Tarihi'].localeCompare(b['Giriş Tarihi']) || a['Oda Tipi'].localeCompare(b['Oda Tipi']));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Rooming List');
  XLSX.writeFile(workbook, `${event.name || 'organizasyon'}_rooming_list.xlsx`);
  showToast(`Rooming list oluşturuldu (${guests.length} oda).`);
}

// ── Misafir formu ────────────────────────────────────────────────────────

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) ?? {};
  } catch {
    return {};
  }
}

function openParticipantModal({ eventId, participant, onDone }) {
  const isEdit = Boolean(participant);
  // Taslak yalnızca yeni kayıtta geri yüklenir; düzenlemede mevcut veri esastır.
  const data = isEdit ? participant : readDraft();
  const companyNames = DB.companies.getAll().map((c) => c.name);

  openModal({
    title: isEdit ? 'Misafir Düzenle' : 'Manuel Kayıt Ekle',
    width: '640px',
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    content: html`
      <form id="paxForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Yetkili</label>
            <input type="text" class="form-input" name="authorizedPerson" value="${data.authorizedPerson ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Firma</label>
            <select class="form-select searchable-select" name="company">
              <option value="">Seçiniz...</option>
              ${companyNames.map((name) => raw(html`
                <option value="${name}" ${data.company === name ? raw('selected') : ''}>${name}</option>
              `))}
              <option value="Bireysel" ${data.company === 'Bireysel' ? raw('selected') : ''}>Bireysel / Diğer</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">İsim *</label>
            <input type="text" class="form-input" name="firstName" value="${data.firstName ?? ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Soyad *</label>
            <input type="text" class="form-input" name="lastName" value="${data.lastName ?? ''}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Telefon *</label>
            <input type="text" class="form-input mask-phone" name="phone" value="${data.phone ?? ''}" placeholder="05XX XXX XX XX" required>
          </div>
          <div class="form-group">
            <label class="form-label">E-posta</label>
            <input type="email" class="form-input" name="email" value="${data.email ?? ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Doğum Tarihi</label>
            <input type="date" class="form-input" name="birthDate" value="${data.birthDate ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Kalkış Şehri</label>
            <input type="text" class="form-input" name="depCity" value="${data.depCity ?? ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">TC Kimlik No</label>
            <input type="text" class="form-input mask-tc" name="tcNo" value="${data.tcNo ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Pasaport No</label>
            <input type="text" class="form-input" name="passportNo" value="${data.passportNo ?? ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kayıt Dönemi</label>
            <select class="form-select" name="regPeriod" id="paxPeriod">
              <option value="early" ${data.regPeriod === 'early' ? raw('selected') : ''}>Erken Kayıt</option>
              <option value="late" ${data.regPeriod === 'late' ? raw('selected') : ''}>Geç Kayıt</option>
              <option value="custom" ${data.regPeriod === 'custom' ? raw('selected') : ''}>Özel Fiyat</option>
            </select>
          </div>
          <div class="form-group" id="paxCustomPrice" style="display:${data.regPeriod === 'custom' ? 'block' : 'none'};">
            <label class="form-label">Özel Fiyat (₺)</label>
            <input type="number" class="form-input" name="regCustomPrice" value="${data.regCustomPrice ?? 0}" min="0" step="0.01">
          </div>
        </div>

        <div style="border-top:1px solid var(--slate-100);margin-top:8px;padding-top:16px;">
          <label class="form-checkbox" style="margin-bottom:12px;">
            <input type="checkbox" name="accommodation" id="paxAccommodation" ${data.accommodation ? raw('checked') : ''}>
            <span>Konaklama var</span>
          </label>
          <div class="form-row" id="paxAccFields" style="display:${data.accommodation ? 'flex' : 'none'};">
            <div class="form-group">
              <label class="form-label">Oda Tipi</label>
              <select class="form-select" name="roomType">
                ${ROOM_TYPES.map((type) => raw(html`
                  <option value="${type}" ${data.roomType === type ? raw('selected') : ''}>${ROOM_TYPE_LABELS[type]}</option>
                `))}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Konaklama Özel Fiyatı (₺)</label>
              <input type="number" class="form-input" name="accSellPrice" value="${data.accSellPrice ?? ''}" min="0" step="0.01" placeholder="Boş = liste fiyatı">
            </div>
          </div>
        </div>
      </form>
    `,
    onSave: () => {
      const form = document.getElementById('paxForm');
      const values = Object.fromEntries(new FormData(form).entries());
      const errors = validateParticipant(values);

      form.querySelectorAll('.form-input').forEach((input) => { input.style.borderColor = ''; });
      if (errors.length > 0) {
        errors.forEach(({ field }) => {
          const input = form.querySelector(`[name="${field}"]`);
          if (input) input.style.borderColor = 'var(--danger)';
        });
        showToast(errors[0].message, 'error');
        return;
      }

      const accommodation = form.querySelector('#paxAccommodation').checked;
      const payload = {
        ...values,
        eventId,
        accommodation,
        roomType: accommodation ? values.roomType : '',
        accSellPrice: accommodation && values.accSellPrice !== '' ? Number(values.accSellPrice) : '',
        regCustomPrice: values.regPeriod === 'custom' ? Number(values.regCustomPrice) || 0 : 0,
      };

      if (isEdit) {
        DB.participants.update(participant.id, payload);
        showToast('Misafir güncellendi.');
      } else {
        DB.participants.create({ ...payload, createdBy: getCurrentUser()?.name ?? 'Bilinmiyor' });
        DB.logs.add(`Yeni misafir eklendi: ${payload.firstName} ${payload.lastName}`, 'success');
        showToast('Kayıt eklendi.');
      }

      localStorage.removeItem(DRAFT_KEY);
      closeModal();
      onDone();
    },
  });

  const form = document.getElementById('paxForm');
  const periodSelect = form.querySelector('#paxPeriod');
  const customPriceGroup = form.querySelector('#paxCustomPrice');
  const accCheckbox = form.querySelector('#paxAccommodation');
  const accFields = form.querySelector('#paxAccFields');

  periodSelect.addEventListener('change', () => {
    customPriceGroup.style.display = periodSelect.value === 'custom' ? 'block' : 'none';
  });
  accCheckbox.addEventListener('change', () => {
    accFields.style.display = accCheckbox.checked ? 'flex' : 'none';
  });

  // Yeni kayıtta form taslağı saklanır; modal kazara kapanırsa veri kaybolmaz.
  if (!isEdit) {
    form.addEventListener('input', () => {
      const draft = Object.fromEntries(new FormData(form).entries());
      draft.accommodation = accCheckbox.checked;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    });
  }

  initSearchableSelects(form);
}

/** @returns {Array<{field: string, message: string}>} */
function validateParticipant(values) {
  const errors = [];
  if (!values.firstName?.trim()) errors.push({ field: 'firstName', message: 'İsim zorunludur.' });
  if (!values.lastName?.trim()) errors.push({ field: 'lastName', message: 'Soyad zorunludur.' });

  const phoneDigits = (values.phone ?? '').replace(/\D/g, '');
  if (!phoneDigits) errors.push({ field: 'phone', message: 'Telefon zorunludur.' });
  else if (phoneDigits.length !== 11) errors.push({ field: 'phone', message: 'Telefon 11 hane olmalıdır (05XX XXX XX XX).' });

  if (values.tcNo && values.tcNo.length !== 11) {
    errors.push({ field: 'tcNo', message: 'TC Kimlik No tam 11 hane olmalıdır.' });
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.push({ field: 'email', message: 'Geçerli bir e-posta adresi girin.' });
  }
  return errors;
}
