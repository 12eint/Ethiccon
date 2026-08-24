/**
 * Sponsor yönetimi — tek organizasyon kapsamında.
 * Hem #org/:id/sponsors sekmesi hem de Sponsorlar sayfası bunu kullanır.
 */
import { DB, distinctValues } from '../../core/store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatAmount } from '../../core/format.js';
import { html, raw, showToast, refreshIcons, emptyState, bindClick, suggestInput } from '../../core/ui.js';
import { getCurrentUser } from '../../core/auth.js';

export const SPONSOR_PACKAGES = [
  { id: 'ana-sponsor', name: 'Ana Sponsor', color: '#4f46e5' },
  { id: 'platin', name: 'Platin Sponsor', color: '#94a3b8' },
  { id: 'gold', name: 'Altın Sponsor', color: '#f59e0b' },
  { id: 'silver', name: 'Gümüş Sponsor', color: '#64748b' },
  { id: 'bronze', name: 'Bronz Sponsor', color: '#b45309' },
  { id: 'stand', name: 'Stand Katılımı', color: '#3b82f6' },
];

const STATUSES = {
  confirmed: { badge: 'badge-success', label: 'Onaylı' },
  pending: { badge: 'badge-warning', label: 'Beklemede' },
  cancelled: { badge: 'badge-danger', label: 'İptal' },
};

const packageOf = (id) => SPONSOR_PACKAGES.find((p) => p.id === id) ?? SPONSOR_PACKAGES.at(-1);

export function renderSponsorsModule(container, eventId, onChange) {
  const refresh = () => (onChange ? onChange() : renderSponsorsModule(container, eventId));
  const sponsors = DB.sponsors.getByEventId(eventId);

  container.innerHTML = html`
    <div class="page-header">
      <h2>Sponsorlar</h2>
      <button class="btn btn-primary btn-sm" data-action="add">
        <i data-lucide="plus"></i> Yeni Sponsor
      </button>
    </div>
    ${sponsors.length === 0
      ? raw(emptyState({
          icon: 'building-2',
          title: 'Henüz sponsor eklenmedi',
          text: 'Yeni sponsor eklemek için yukarıdaki butonu kullanın.',
        }))
      : raw(html`
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Firma Adı</th>
                <th>Paket</th>
                <th>Sözleşme Tutarı</th>
                <th>Stand</th>
                <th>İletişim</th>
                <th>Durum</th>
                <th style="text-align:right;">İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${sponsors.map((sponsor) => {
                const pkg = packageOf(sponsor.packageType);
                const status = STATUSES[sponsor.status] ?? STATUSES.pending;
                return raw(html`
                  <tr>
                    <td><strong>${sponsor.companyName}</strong></td>
                    <td>
                      <span class="badge" style="background:${pkg.color}15;color:${pkg.color};border:1px solid ${pkg.color}30;">
                        ${pkg.name}
                      </span>
                    </td>
                    <td style="font-weight:600;color:var(--success);">
                      ${sponsor.amount ? formatAmount(sponsor.amount) : '-'}
                    </td>
                    <td>${sponsor.standArea ? `${sponsor.standArea} m²` : '-'}</td>
                    <td>
                      <div style="font-size:0.8rem;font-weight:600;">${sponsor.contactPerson || '-'}</div>
                      <div style="font-size:0.75rem;color:var(--slate-500);">${sponsor.contactEmail || ''}</div>
                    </td>
                    <td><span class="badge ${status.badge}">${status.label}</span></td>
                    <td style="text-align:right;">
                      <div class="action-btns" style="justify-content:flex-end;">
                        <button class="action-btn edit" data-edit="${sponsor.id}" title="Düzenle">
                          <i data-lucide="pencil"></i>
                        </button>
                        <button class="action-btn delete" data-delete="${sponsor.id}" title="Sil">
                          <i data-lucide="trash-2"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `);
              })}
            </tbody>
          </table>
        </div>
      `)}
  `;

  container.querySelector('[data-action="add"]').addEventListener('click', () => {
    openSponsorModal(null, eventId, refresh);
  });

  bindClick(container, (event) => {
    const editId = event.target.closest('[data-edit]')?.dataset.edit;
    if (editId) {
      openSponsorModal(DB.sponsors.getById(editId), eventId, refresh);
      return;
    }

    const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
    if (!deleteId) return;

    const sponsor = DB.sponsors.getById(deleteId);
    if (!sponsor) return;
    const message = `"${sponsor.companyName}" sponsoru silinecek. Bütçeye işlenmiş sponsorluk geliri de kaldırılacaktır. Devam edilsin mi?`;
    if (!window.confirm(message)) return;

    DB.sponsors.delete(deleteId);
    DB.logs.add(`Sponsor silindi: ${sponsor.companyName}`, 'warning');
    showToast('Sponsor ve bağlı bütçe geliri silindi.');
    refresh();
  });

  refreshIcons(container);
}

function openSponsorModal(sponsor, eventId, onDone) {
  const isEdit = Boolean(sponsor);
  const data = sponsor ?? {};

  const content = html`
    <form id="sponsorForm">
      <div class="form-group">
        <label class="form-label">Firma Adı *</label>
        ${raw(suggestInput({
          name: 'companyName',
          value: data.companyName,
          options: DB.companies.getAll().map((company) => company.name),
          placeholder: 'Kayıtlı firmalardan seçin veya yeni yazın',
          required: true,
        }))}
        <p style="font-size:0.75rem;color:var(--slate-400);margin-top:6px;">
          Firmalar veritabanındaki kayıtlar önerilir. Kayıtlı bir firma seçilirse
          proformada vergi dairesi ve numarası otomatik gelir.
        </p>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Sponsorluk Paketi</label>
          <select class="form-select" name="packageType">
            ${SPONSOR_PACKAGES.map((pkg) => raw(html`
              <option value="${pkg.id}" ${data.packageType === pkg.id ? raw('selected') : ''}>${pkg.name}</option>
            `))}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Sözleşme Tutarı (₺) *</label>
          <input class="form-input" type="number" name="amount" value="${data.amount ?? ''}" min="0" step="0.01" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Yetkili Kişi</label>
          ${raw(suggestInput({
            name: 'contactPerson',
            value: data.contactPerson,
            // Firma kartlarındaki yetkililer ve daha önce girilmiş sponsor yetkilileri.
            options: [
              ...DB.companies.getAll().map((company) => company.contactName),
              ...distinctValues(DB.sponsors.getAll(), 'contactPerson'),
            ],
          }))}
        </div>
        <div class="form-group">
          <label class="form-label">E-posta</label>
          <input class="form-input" type="email" name="contactEmail" value="${data.contactEmail ?? ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Telefon</label>
          <input class="form-input mask-phone" type="tel" name="contactPhone" value="${data.contactPhone ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Stand Alanı (m²)</label>
          <input class="form-input" type="number" name="standArea" value="${data.standArea ?? ''}" min="0" step="0.5">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Durum</label>
        <select class="form-select" name="status">
          ${Object.entries(STATUSES).map(([value, meta]) => raw(html`
            <option value="${value}" ${data.status === value ? raw('selected') : ''}>${meta.label}</option>
          `))}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Ek Talepler</label>
        <textarea class="form-textarea" name="additionalRequests" rows="2">${data.additionalRequests ?? ''}</textarea>
      </div>
      <div style="font-size:0.8rem;color:var(--info);display:flex;gap:6px;padding:12px;background:var(--info-light);border-radius:var(--radius-md);">
        <i data-lucide="info" style="width:16px;flex-shrink:0;"></i>
        <span>Yalnızca onaylı sponsorların sözleşme tutarı bütçeye "Sponsorluk" geliri olarak işlenir. Durum beklemeye veya iptale alınırsa gelir kaldırılır.</span>
      </div>
    </form>
  `;

  openModal({
    title: isEdit ? 'Sponsoru Düzenle' : 'Yeni Sponsor',
    content,
    width: '640px',
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    onSave: () => {
      const form = document.getElementById('sponsorForm');
      const values = Object.fromEntries(new FormData(form).entries());
      values.eventId = eventId;
      values.amount = Number(values.amount) || 0;
      values.standArea = Number(values.standArea) || 0;

      if (!values.companyName.trim()) {
        showToast('Firma adı zorunludur.', 'error');
        return;
      }
      if (values.amount <= 0) {
        showToast('Sözleşme tutarı sıfırdan büyük olmalıdır.', 'error');
        return;
      }

      const saved = isEdit
        ? DB.sponsors.update(sponsor.id, values)
        : DB.sponsors.create(values);

      syncSponsorIncome(saved);
      DB.logs.add(
        `${isEdit ? 'Sponsor güncellendi' : 'Yeni sponsor eklendi'}: ${values.companyName}`,
        'success',
      );
      const incomeMessage = values.status === 'confirmed'
        ? ' Onaylı tutar bütçeye işlendi.'
        : ' Bütçeye gelir işlenmedi.';
      showToast(`${isEdit ? 'Sponsor güncellendi.' : 'Sponsor eklendi.'}${incomeMessage}`);
      closeModal();
      onDone();
    },
  });
}

/**
 * Onaylı sponsorun bütçedeki gelir satırını oluşturur ya da tutar/isim
 * değiştiyse günceller. Bekleyen veya iptal edilen sponsor bütçe geliri
 * değildir; daha önce oluşmuş satırı da kaldırır.
 *
 * Satır sourceType/sourceId ile sponsora bağlanır; sponsor tamamen silinirse
 * store katmanı da aynı bağ üzerinden güvenlik ağı olarak temizler.
 */
export function syncSponsorIncome(sponsor) {
  const existing = DB.budgets.getAll().find(
    (row) => row.sourceType === 'sponsor' && row.sourceId === sponsor.id,
  );

  if (sponsor.status !== 'confirmed') {
    if (existing) DB.budgets.delete(existing.id);
    return;
  }

  const payload = {
    eventId: sponsor.eventId,
    type: 'income',
    category: 'Sponsorluk',
    description: `${sponsor.companyName} (${packageOf(sponsor.packageType).name})`,
    amount: Number(sponsor.amount) || 0,
    status: 'approved',
    sourceType: 'sponsor',
    sourceId: sponsor.id,
    createdBy: getCurrentUser()?.name ?? 'Sistem',
  };

  if (existing) DB.budgets.update(existing.id, payload);
  else DB.budgets.create(payload);
}
