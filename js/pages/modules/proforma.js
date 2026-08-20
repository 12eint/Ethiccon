/**
 * Proforma fatura — tek organizasyon kapsamında.
 *
 * Önceden iki ayrı proforma vardı: kayıtlı kalemleri olan elle düzenlenen
 * fatura (etkinlik sekmesi) ve firma verisinden otomatik üretilen hesap
 * özeti (ayrı sayfa). İkisi birleştirildi: fatura kayıtlı tutulur, kalemler
 * istenirse firmanın hizmetlerinden otomatik doldurulur.
 */
import { DB } from '../../core/store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatCurrency, formatDate } from '../../core/format.js';
import { html, raw, showToast, refreshIcons, emptyState, bindClick } from '../../core/ui.js';
import { getAccommodationConfig, accommodationPrice, registrationPrice } from '../../core/pricing.js';

const VAT_DEFAULT = 20;

const lineTotal = (item) => (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
const subtotalOf = (items) => items.reduce((sum, item) => sum + lineTotal(item), 0);
const grandTotal = (items, vatRate) => subtotalOf(items) * (1 + (Number(vatRate) || 0) / 100);

export function renderProformaModule(container, eventId, onChange) {
  const refresh = () => (onChange ? onChange() : renderProformaModule(container, eventId));
  const proformas = DB.proformas.getByEventId(eventId);

  container.innerHTML = html`
    <div class="page-header">
      <h2>Proforma Faturalar</h2>
      <button class="btn btn-primary btn-sm" data-action="add">
        <i data-lucide="plus"></i> Yeni Proforma
      </button>
    </div>
    ${proformas.length === 0
      ? raw(emptyState({
          icon: 'file-text',
          title: 'Henüz proforma oluşturulmadı',
          text: 'Yeni proforma oluşturmak için yukarıdaki butonu kullanın.',
        }))
      : raw(html`
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fatura No</th><th>Firma</th><th>Düzenleme</th><th>Vade</th>
                <th>Toplam</th><th>Alınan</th><th>Kalan</th><th style="text-align:right;">İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${proformas.map((proforma) => {
                const items = DB.proformaItems.getByProformaId(proforma.id);
                const total = grandTotal(items, proforma.vatRate);
                const paid = Number(proforma.paymentReceived) || 0;
                const balance = total - paid;
                return raw(html`
                  <tr>
                    <td><strong>${proforma.invoiceNo}</strong></td>
                    <td>${resolveCompany(proforma).name || '-'}</td>
                    <td>${formatDate(proforma.issueDate)}</td>
                    <td>${formatDate(proforma.dueDate)}</td>
                    <td style="font-weight:600;">${formatCurrency(total)}</td>
                    <td style="color:var(--success);font-weight:600;">${formatCurrency(paid)}</td>
                    <td style="color:${balance > 0.005 ? 'var(--danger)' : 'var(--slate-500)'};font-weight:600;">
                      ${formatCurrency(balance)}
                    </td>
                    <td style="text-align:right;">
                      <div class="action-btns" style="justify-content:flex-end;">
                        <button class="action-btn view" data-print="${proforma.id}" title="Görüntüle / PDF"><i data-lucide="printer"></i></button>
                        <button class="action-btn edit" data-edit="${proforma.id}" title="Düzenle"><i data-lucide="pencil"></i></button>
                        <button class="action-btn delete" data-delete="${proforma.id}" title="Sil"><i data-lucide="trash-2"></i></button>
                      </div>
                    </td>
                  </tr>
                `);
              })}
            </tbody>
          </table>
        </div>
      `)}
    <div id="proformaPrintArea"></div>
  `;

  container.querySelector('[data-action="add"]').addEventListener('click', () => {
    openProformaModal(null, eventId, refresh);
  });

  bindClick(container, (event) => {
    const editId = event.target.closest('[data-edit]')?.dataset.edit;
    if (editId) {
      openProformaModal(DB.proformas.getById(editId), eventId, refresh);
      return;
    }

    const printId = event.target.closest('[data-print]')?.dataset.print;
    if (printId) {
      showPrintable(container.querySelector('#proformaPrintArea'), printId);
      return;
    }

    const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
    if (!deleteId) return;
    if (!window.confirm('Bu proformayı ve kalemlerini silmek istediğinize emin misiniz?')) return;
    DB.proformas.delete(deleteId);
    showToast('Proforma silindi.');
    refresh();
  });

  refreshIcons(container);
}

function nextInvoiceNo() {
  const year = new Date().getFullYear();
  const count = DB.proformas.getAll().filter((p) => (p.invoiceNo ?? '').includes(`PF-${year}`)).length;
  return `PF-${year}-${String(count + 1).padStart(3, '0')}`;
}

/**
 * Bir firmanın bu etkinlikteki hizmetlerinden fatura kalemi üretir.
 * Kayıt ücreti, konaklama ve uçak biletlerini merkezî fiyat mantığından okur.
 */
function autoFillItems(eventId, companyName) {
  const event = DB.events.getById(eventId);
  const config = getAccommodationConfig(eventId);
  const guests = DB.participants.getByEventId(eventId).filter((p) => p.company === companyName);
  const items = [];

  guests.forEach((guest) => {
    const fullName = `${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim();

    const regPrice = registrationPrice(guest, event);
    if (regPrice > 0) {
      items.push({ description: `${fullName} — Kayıt Bedeli`, quantity: 1, unitPrice: regPrice });
    }

    if (guest.accommodation && guest.roomType) {
      const accPrice = accommodationPrice(guest, config);
      if (accPrice > 0) {
        items.push({ description: `${fullName} — ${guest.roomType} Oda Konaklama`, quantity: 1, unitPrice: accPrice });
      }
    }
  });

  const guestIds = new Set(guests.map((g) => g.id));
  DB.flights.getByEventId(eventId)
    .filter((flight) => guestIds.has(flight.participantId))
    .forEach((flight) => {
      const guest = DB.participants.getById(flight.participantId);
      const price = Number(flight.sellPrice) || 0;
      if (price <= 0) return;
      items.push({
        description: `${guest?.firstName ?? ''} ${guest?.lastName ?? ''} — Uçak Bileti (${flight.airline || 'Havayolu'})`.trim(),
        quantity: 1,
        unitPrice: price,
      });
    });

  return items;
}

function itemRow(item = { description: '', quantity: 1, unitPrice: 0 }) {
  return html`
    <tr>
      <td><input class="form-input item-desc" type="text" value="${item.description ?? ''}"></td>
      <td><input class="form-input item-qty" type="number" value="${item.quantity ?? 1}" min="1"></td>
      <td><input class="form-input item-price" type="number" value="${item.unitPrice ?? 0}" min="0" step="0.01"></td>
      <td class="item-total" style="text-align:right;font-weight:600;">${formatCurrency(lineTotal(item))}</td>
      <td><button type="button" class="btn btn-ghost btn-sm btn-icon" data-remove-item title="Sil"><i data-lucide="trash-2"></i></button></td>
    </tr>
  `;
}

function openProformaModal(proforma, eventId, onDone) {
  const isEdit = Boolean(proforma);
  const data = proforma ?? {};
  const companies = DB.companies.getAll();

  let items = isEdit ? DB.proformaItems.getByProformaId(proforma.id) : [];
  if (items.length === 0) items = [{ description: '', quantity: 1, unitPrice: 0 }];

  const today = new Date().toISOString().slice(0, 10);
  const inThirtyDays = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  openModal({
    title: isEdit ? 'Proforma Düzenle' : 'Yeni Proforma',
    width: '840px',
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    content: html`
      <form id="proformaForm" class="proforma-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fatura No</label>
            <input class="form-input" type="text" name="invoiceNo" value="${data.invoiceNo ?? nextInvoiceNo()}">
          </div>
          <div class="form-group">
            <label class="form-label">KDV Oranı (%)</label>
            <input class="form-input" type="number" name="vatRate" id="pfVat" value="${data.vatRate ?? VAT_DEFAULT}" min="0" max="100">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fatura Edilecek Firma</label>
            <select class="form-select" name="companyName" id="pfCompany">
              <option value="">Firma seçin...</option>
              ${companies.map((company) => raw(html`
                <option value="${company.name}" ${data.companyName === company.name ? raw('selected') : ''}>${company.name}</option>
              `))}
            </select>
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end;">
            <button type="button" class="btn btn-secondary" id="pfAutoFill" style="width:100%;">
              <i data-lucide="wand-2" style="width:15px;"></i> Hizmetlerden Doldur
            </button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Düzenleme Tarihi</label>
            <input class="form-input" type="date" name="issueDate" value="${(data.issueDate ?? today).slice(0, 10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Vade Tarihi</label>
            <input class="form-input" type="date" name="dueDate" value="${(data.dueDate ?? inThirtyDays).slice(0, 10)}">
          </div>
        </div>

        <div style="background:var(--success-light);border:1px solid var(--success);border-radius:var(--radius-md);padding:16px;margin-top:16px;">
          <label class="form-label" style="color:#065f46;">Şu Ana Kadar Alınan Ödeme (₺)</label>
          <input class="form-input" type="number" name="paymentReceived" value="${data.paymentReceived ?? 0}" min="0" step="0.01" style="background:#fff;">
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin:24px 0 12px;">
          <h3 style="margin:0;font-size:1rem;">Fatura Kalemleri</h3>
          <button type="button" class="btn btn-sm btn-secondary" id="pfAddItem"><i data-lucide="plus"></i> Kalem Ekle</button>
        </div>

        <table class="proforma-items-table">
          <thead>
            <tr>
              <th>Hizmet Açıklaması</th>
              <th style="width:90px;">Miktar</th>
              <th style="width:130px;">Birim Fiyat</th>
              <th style="width:130px;">Toplam</th>
              <th style="width:48px;"></th>
            </tr>
          </thead>
          <tbody id="pfItems">${items.map((item) => raw(itemRow(item)))}</tbody>
        </table>

        <div class="proforma-totals">
          <div class="proforma-total-row"><span>Ara Toplam:</span><span id="pfSubtotal">-</span></div>
          <div class="proforma-total-row"><span>KDV:</span><span id="pfVatAmount">-</span></div>
          <div class="proforma-total-row grand-total"><span>Genel Toplam:</span><span id="pfGrandTotal">-</span></div>
        </div>

        <div class="form-group" style="margin-top:16px;">
          <label class="form-label">Notlar</label>
          <textarea class="form-textarea" name="notes" rows="2">${data.notes ?? ''}</textarea>
        </div>
      </form>
    `,
    onSave: () => {
      const form = document.getElementById('proformaForm');
      const values = Object.fromEntries(new FormData(form).entries());
      values.eventId = eventId;
      values.vatRate = Number(values.vatRate) || 0;
      values.paymentReceived = Number(values.paymentReceived) || 0;

      if (!values.invoiceNo.trim()) {
        showToast('Fatura numarası zorunludur.', 'error');
        return;
      }

      const collected = readItems();
      if (collected.length === 0) {
        showToast('En az bir dolu kalem ekleyin.', 'error');
        return;
      }

      const id = isEdit
        ? (DB.proformas.update(proforma.id, values), proforma.id)
        : DB.proformas.create(values).id;

      DB.proformaItems.deleteByProformaId(id);
      collected.forEach((item) => DB.proformaItems.create({ ...item, proformaId: id }));

      closeModal();
      showToast(isEdit ? 'Proforma güncellendi.' : 'Proforma oluşturuldu.');
      onDone();
    },
  });

  // ── Modal içi etkileşim ──
  const body = document.getElementById('pfItems');
  const vatInput = document.getElementById('pfVat');

  function readItems() {
    return [...body.querySelectorAll('tr')]
      .map((row) => ({
        description: row.querySelector('.item-desc').value.trim(),
        quantity: Number(row.querySelector('.item-qty').value) || 0,
        unitPrice: Number(row.querySelector('.item-price').value) || 0,
      }))
      .filter((item) => item.description || item.unitPrice > 0);
  }

  function recalc() {
    body.querySelectorAll('tr').forEach((row) => {
      const value = (Number(row.querySelector('.item-qty').value) || 0)
        * (Number(row.querySelector('.item-price').value) || 0);
      row.querySelector('.item-total').textContent = formatCurrency(value);
    });

    const subtotal = subtotalOf(readItems());
    const vatRate = Number(vatInput.value) || 0;
    document.getElementById('pfSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('pfVatAmount').textContent = formatCurrency(subtotal * vatRate / 100);
    document.getElementById('pfGrandTotal').textContent = formatCurrency(subtotal * (1 + vatRate / 100));
  }

  body.addEventListener('input', recalc);
  vatInput.addEventListener('input', recalc);

  body.addEventListener('click', (event) => {
    if (!event.target.closest('[data-remove-item]')) return;
    if (body.querySelectorAll('tr').length === 1) {
      showToast('En az bir kalem gereklidir.', 'error');
      return;
    }
    event.target.closest('tr').remove();
    recalc();
  });

  document.getElementById('pfAddItem').addEventListener('click', () => {
    body.insertAdjacentHTML('beforeend', itemRow());
    refreshIcons(body.lastElementChild);
    recalc();
  });

  document.getElementById('pfAutoFill').addEventListener('click', () => {
    const companyName = document.getElementById('pfCompany').value;
    if (!companyName) {
      showToast('Önce fatura edilecek firmayı seçin.', 'error');
      return;
    }
    const generated = autoFillItems(eventId, companyName);
    if (generated.length === 0) {
      showToast('Bu firmaya ait ücretlendirilmiş hizmet bulunamadı.', 'error');
      return;
    }
    body.innerHTML = generated.map((item) => itemRow(item)).join('');
    refreshIcons(body);
    recalc();
    showToast(`${generated.length} kalem dolduruldu.`);
  });

  recalc();
}

/**
 * Faturanın hangi firmaya kesildiğini çözer.
 * Eski kayıtlarda firma yalnızca sponsorId üzerinden bağlıydı; companyName
 * alanı sonradan eklendi, o yüzden ikisine de bakılır.
 */
function resolveCompany(proforma) {
  const companies = DB.companies.getAll();
  const byName = companies.find((c) => c.name === proforma.companyName);
  if (byName) return { record: byName, name: byName.name };

  if (proforma.companyName) return { record: {}, name: proforma.companyName };

  // Eski proformalar: sponsor kaydından firma adını türet.
  const sponsorName = proforma.sponsorId ? DB.sponsors.getById(proforma.sponsorId)?.companyName : null;
  if (!sponsorName) return { record: {}, name: '' };

  const bySponsor = companies.find((c) => c.name === sponsorName);
  return { record: bySponsor ?? {}, name: sponsorName };
}

/** Fatura gövdesinin HTML'i. Hem ekran önizlemesi hem PDF bunu kullanır. */
function invoiceMarkup(proforma) {
  const items = DB.proformaItems.getByProformaId(proforma.id);
  const settings = DB.settings.get();
  const event = DB.events.getById(proforma.eventId) ?? {};
  const { record: company, name: companyName } = resolveCompany(proforma);
  const subtotal = subtotalOf(items);
  const vatAmount = subtotal * (Number(proforma.vatRate) || 0) / 100;

  return html`
    <div class="invoice-body">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid var(--slate-200);padding-bottom:24px;margin-bottom:32px;align-items:center;gap:24px;">
        <div style="display:flex;gap:24px;align-items:center;">
          ${settings.agencyLogo ? raw(`<img src="${settings.agencyLogo}" style="max-height:80px;max-width:150px;object-fit:contain;" alt="">`) : ''}
          <div>
            <h1 style="font-size:2rem;font-weight:800;color:var(--primary-700);margin:0;">PROFORMA FATURA</h1>
            <p style="color:var(--slate-500);font-size:0.875rem;margin-top:4px;">${proforma.invoiceNo} · ${formatDate(proforma.issueDate)}</p>
            ${settings.agencyName ? raw(html`<p style="font-size:0.875rem;font-weight:600;margin-top:4px;">${settings.agencyName}</p>`) : ''}
          </div>
        </div>
        <div style="text-align:right;">
          <h3 style="font-size:1.125rem;font-weight:700;color:var(--slate-900);">${event.name ?? ''}</h3>
          <p style="color:var(--slate-500);font-size:0.875rem;">${[event.city, event.venue].filter(Boolean).join(' / ')}</p>
          <p style="color:var(--slate-500);font-size:0.875rem;">Vade: ${formatDate(proforma.dueDate)}</p>
        </div>
      </div>

      <div class="pf-block" style="margin-bottom:32px;padding:16px;background:var(--slate-50);border-radius:var(--radius-md);">
        <h4 style="font-size:1rem;font-weight:700;margin-bottom:8px;">Fatura Edilecek Firma</h4>
        <p style="margin:0;font-weight:600;">${company.commercialTitle || companyName || 'Firma seçilmedi'}</p>
        <p style="margin:4px 0 0;font-size:0.875rem;color:var(--slate-600);">${company.address || 'Adres bilgisi yok'}</p>
        <p style="margin:4px 0 0;font-size:0.875rem;color:var(--slate-600);">VD: ${company.taxOffice || '-'} / VN: ${company.taxNumber || '-'}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;font-size:0.875rem;">
        <thead>
          <tr style="background:var(--slate-100);border-bottom:2px solid var(--slate-300);">
            <th style="padding:12px;text-align:left;">Hizmet Açıklaması</th>
            <th style="padding:12px;text-align:right;">Adet</th>
            <th style="padding:12px;text-align:right;">Birim Fiyat</th>
            <th style="padding:12px;text-align:right;">Toplam</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => raw(html`
            <tr>
              <td style="padding:10px 12px;">${item.description}</td>
              <td style="padding:10px 12px;text-align:right;">${item.quantity}</td>
              <td style="padding:10px 12px;text-align:right;">${formatCurrency(item.unitPrice)}</td>
              <td style="padding:10px 12px;text-align:right;">${formatCurrency(lineTotal(item))}</td>
            </tr>
          `))}
        </tbody>
      </table>

      <div class="pf-block" style="display:flex;justify-content:flex-end;margin-bottom:32px;">
        <div style="width:320px;">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--slate-200);">
            <span style="color:var(--slate-600);">Ara Toplam:</span><span style="font-weight:600;">${formatCurrency(subtotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--slate-200);">
            <span style="color:var(--slate-600);">KDV (%${proforma.vatRate ?? 0}):</span><span style="font-weight:600;">${formatCurrency(vatAmount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:16px 0;font-size:1.25rem;">
            <span style="font-weight:700;">GENEL TOPLAM:</span>
            <span style="font-weight:800;color:var(--primary-600);">${formatCurrency(subtotal + vatAmount)}</span>
          </div>
          ${Number(proforma.paymentReceived) > 0 ? raw(html`
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--slate-200);">
              <span style="color:var(--slate-600);">Alınan Ödeme:</span>
              <span style="font-weight:600;color:var(--success);">${formatCurrency(proforma.paymentReceived)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;">
              <span style="font-weight:700;">Kalan:</span>
              <span style="font-weight:800;color:var(--danger);">${formatCurrency(subtotal + vatAmount - Number(proforma.paymentReceived))}</span>
            </div>
          `) : ''}
        </div>
      </div>

      ${proforma.notes ? raw(html`<p style="font-size:0.875rem;color:var(--slate-600);margin-bottom:24px;">${proforma.notes}</p>`) : ''}

      <div class="pf-block" style="display:flex;justify-content:space-between;border-top:1px solid var(--slate-200);padding-top:24px;gap:24px;">
        <div style="flex:1;">
          <strong>Banka ve Ödeme Bilgileri:</strong>
          <div style="color:var(--slate-600);font-size:0.875rem;margin-top:4px;white-space:pre-wrap;">${settings.agencyIban || 'Sistem ayarlarından IBAN girin.'}</div>
        </div>
        <div style="flex:1;text-align:right;">
          <strong>Acente Adresi:</strong>
          <div style="color:var(--slate-600);font-size:0.875rem;margin-top:4px;white-space:pre-wrap;">${settings.agencyAddress || 'Adres bilgisi bulunmuyor.'}</div>
        </div>
      </div>

      <p style="text-align:center;margin-top:24px;font-size:0.75rem;color:var(--slate-400);">
        Bu belge bilgi amaçlı proforma faturadır, mali değeri yoktur.
      </p>
    </div>
  `;
}

/** A4 genişliği, 96 dpi. PDF her zaman bu ölçüde üretilir. */
const A4_WIDTH_PX = 794;

/** Kenar boşluğu (~11 mm). jsPDF margin'i yerine sahnenin padding'i kullanılır. */
const A4_PADDING_PX = 40;

/** Ekranda önizleme çizer ve indirme düğmesini bağlar. */
function showPrintable(host, proformaId) {
  const proforma = DB.proformas.getById(proformaId);
  if (!proforma || !host) return;

  host.innerHTML = html`
    <div class="card" style="padding:48px;margin-top:24px;">
      ${raw(invoiceMarkup(proforma))}
      <div style="text-align:center;border-top:1px solid var(--slate-200);padding-top:24px;margin-top:24px;">
        <button class="btn btn-secondary" data-download><i data-lucide="printer"></i> PDF Olarak İndir</button>
      </div>
    </div>
  `;

  refreshIcons(host);
  host.scrollIntoView({ block: 'start' });

  host.querySelector('[data-download]').addEventListener('click', (event) => {
    downloadInvoicePdf(proforma, event.currentTarget);
  });
}

/**
 * PDF'i, belgenin en başına geçici olarak yerleştirilen temiz bir sahneden
 * üretir.
 *
 * Neden ekrandaki önizleme doğrudan yakalanmıyor: önizlemenin atası olan
 * `.content` elemanı `.page-fade-in` sınıfıyla `transform: translateY()`
 * uyguluyor. Dönüşümlü bir ata yeni bir kapsayıcı blok oluşturuyor ve
 * html2canvas'ın koordinat hesabını kaydırıyor — belge sayfanın ortasından
 * başlayıp sağdan kesiliyordu.
 *
 * Neden ekran dışına (left:-10000px) taşınmıyor: html2pdf elemanı zaten
 * kendi gizli kabına klonluyor; ikinci bir ekran dışı kaydırma ya da
 * html2canvas'a windowWidth/scrollX/scrollY geçirmek bu telafiyle çakışıp
 * tamamen boş PDF üretiyor.
 *
 * Bu yüzden sahne `<body>`'nin doğrudan çocuğu olarak belge başına konuyor,
 * uygulama yakalama süresince gizleniyor: dönüşümlü ata yok, kaydırma yok,
 * genişlik sabit.
 */
async function downloadInvoicePdf(proforma, button) {
  if (typeof html2pdf === 'undefined') {
    showToast('PDF motoru yüklenemedi. Sayfayı yenileyin.', 'error');
    return;
  }

  const app = document.querySelector('.app-container');
  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  // Kenar boşluğu jsPDF'e değil sahnenin padding'ine bırakılıyor (aşağıya bak).
  stage.style.cssText = `
    width:${A4_WIDTH_PX}px; padding:${A4_PADDING_PX}px; margin:0;
    background:#ffffff; color:#1e293b;
    font-family:var(--font-family); line-height:1.5;
  `;
  stage.innerHTML = invoiceMarkup(proforma);

  const originalLabel = button.innerHTML;
  const scrollBefore = window.scrollY;
  button.disabled = true;
  button.textContent = 'PDF hazırlanıyor...';

  try {
    if (document.fonts?.ready) await document.fonts.ready;

    document.body.prepend(stage);
    if (app) app.style.display = 'none';
    window.scrollTo(0, 0);
    // Gizleme ve yerleştirmenin yerleşime yansıması için bir kare bekle.
    await new Promise((resolve) => setTimeout(resolve, 50));

    console.info('[proforma] yakalanan sahne:', stage.offsetWidth, 'x', stage.offsetHeight);

    await html2pdf()
      .set({
        // margin:0 kasıtlı. jsPDF kenar boşluğu verildiğinde görüntüyü sayfa
        // içerik alanından geniş yerleştiriyor ve sağdan kesiyordu; sahne
        // tam sayfa genişliğine eşlenip boşluk padding ile veriliyor.
        margin: 0,
        filename: `proforma_${(proforma.invoiceNo ?? 'belge').replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // Uzun faturalar bölünebilsin ama satırlar ve toplam bloğu kesilmesin.
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.pf-block'] },
      })
      .from(stage)
      .save();

    showToast('Proforma indirildi.');
  } catch (error) {
    console.error('[proforma] PDF hatası:', error);
    showToast('PDF oluşturulurken hata oluştu.', 'error');
  } finally {
    stage.remove();
    if (app) app.style.display = '';
    window.scrollTo(0, scrollBefore);
    button.disabled = false;
    button.innerHTML = originalLabel;
    refreshIcons(button);
  }
}
