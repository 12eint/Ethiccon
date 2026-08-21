/**
 * Organizasyon ayarları.
 *
 * Buradaki alanlar organizasyona ait olmasına rağmen daha önce Etkinlikler
 * listesindeki düzenleme modalında (fiyatlar, sorumlu, kontenjan) ve Bütçe
 * modülündeki ayrı bir modalda (kategori limitleri) duruyordu. Kayıt geliri
 * organizasyonun içinde hesaplandığı hâlde fiyatın dışarıda tanımlanması,
 * "önce nereye gitmeliyim" sorusunun başlıca kaynağıydı.
 */
import { DB, distinctValues } from '../../core/store.js';
import { formatAmount } from '../../core/format.js';
import { html, raw, showToast, refreshIcons, bindClick, suggestInput } from '../../core/ui.js';
import { isAdmin } from '../../core/auth.js';
import { EXPENSE_CATEGORIES } from './budget.js';

const STATUS_OPTIONS = {
  planned: 'Planlanan',
  active: 'Aktif',
  completed: 'Tamamlanan',
};

export function renderOrgSettingsModule(container, eventId, onChange) {
  const event = DB.events.getById(eventId);
  if (!event) return;

  const admin = isAdmin();
  const users = DB.users.getAll();
  const limits = event.budgetLimits ?? {};

  container.innerHTML = html`
    <div class="page-header">
      <h2>Organizasyon Ayarları</h2>
      <button class="btn btn-primary btn-sm" data-action="save">
        <i data-lucide="save"></i> Ayarları Kaydet
      </button>
    </div>

    <form id="orgSettingsForm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px;align-items:start;">

      <div class="card" style="padding:24px;">
        <h3 class="settings-card-title"><i data-lucide="info"></i> Temel Bilgiler</h3>
        <div class="form-group">
          <label class="form-label">Organizasyon Adı *</label>
          <input class="form-input" type="text" name="name" value="${event.name ?? ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Şehir</label>
            ${raw(suggestInput({ name: 'city', value: event.city,
              options: distinctValues(DB.events.getAll(), 'city') }))}
          </div>
          <div class="form-group">
            <label class="form-label">Mekan</label>
            ${raw(suggestInput({ name: 'venue', value: event.venue,
              options: distinctValues(DB.events.getAll(), 'venue') }))}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Başlangıç</label>
            <input class="form-input" type="date" name="startDate" value="${event.startDate ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Bitiş</label>
            <input class="form-input" type="date" name="endDate" value="${event.endDate ?? ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kontenjan</label>
            <input class="form-input" type="number" name="capacity" value="${event.capacity ?? ''}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Durum</label>
            <select class="form-select" name="status">
              ${Object.entries(STATUS_OPTIONS).map(([value, label]) => raw(html`
                <option value="${value}" ${event.status === value ? raw('selected') : ''}>${label}</option>
              `))}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <textarea class="form-textarea" name="description" rows="2">${event.description ?? ''}</textarea>
        </div>
      </div>

      <div class="card" style="padding:24px;">
        <h3 class="settings-card-title"><i data-lucide="tag"></i> Kayıt Fiyatlandırması</h3>
        <p style="font-size:0.85rem;color:var(--slate-600);margin-bottom:16px;">
          Misafir kayıtlarının geliri bu fiyatlardan hesaplanır. Boş bırakılırsa
          kayıt geliri sıfır görünür. Kişiye özel fiyat, kayıt formunda tanımlanır.
        </p>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Erken Kayıt (₺)</label>
            <input class="form-input" type="number" name="earlyRegPrice" value="${event.earlyRegPrice ?? ''}" min="0" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">Geç Kayıt (₺)</label>
            <input class="form-input" type="number" name="lateRegPrice" value="${event.lateRegPrice ?? ''}" min="0" step="0.01">
          </div>
        </div>

        <h3 class="settings-card-title" style="margin-top:24px;"><i data-lucide="user-check"></i> Sorumluluk</h3>
        <div class="form-group">
          <label class="form-label">Sorumlu Personel</label>
          <select class="form-select" name="assignedManagerId" ${admin ? '' : raw('disabled')}>
            <option value="">(Atanmadı — herkes görebilir)</option>
            ${users.map((user) => raw(html`
              <option value="${user.id}" ${event.assignedManagerId === user.id ? raw('selected') : ''}>${user.name}</option>
            `))}
          </select>
          ${admin ? '' : raw('<p style="font-size:0.75rem;color:var(--slate-400);margin-top:6px;">Yalnızca yönetici değiştirebilir.</p>')}
        </div>
      </div>

      ${admin ? raw(html`
        <div class="card" style="padding:24px;grid-column:1/-1;">
          <h3 class="settings-card-title"><i data-lucide="sliders"></i> Bütçe Kategori Limitleri</h3>
          <p style="font-size:0.85rem;color:var(--slate-600);margin-bottom:16px;">
            Kategoriler için planlanan üst sınırlar. 0 girilenler "Limit Yok" sayılır.
            Toplam planlanan bütçe: <strong>${formatAmount(EXPENSE_CATEGORIES.reduce((s, c) => s + (Number(limits[c]) || 0), 0))}</strong>
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
            ${EXPENSE_CATEGORIES.map((category) => raw(html`
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--slate-50);padding:12px;border-radius:var(--radius-md);border:1px solid var(--slate-100);">
                <label class="form-label" style="margin:0;font-size:0.85rem;">${category}</label>
                <input class="form-input budget-limit" type="number" data-category="${category}"
                  value="${Number(limits[category]) || 0}" min="0" step="0.01" style="width:140px;">
              </div>
            `))}
          </div>
        </div>
      `) : ''}
    </form>
  `;

  bindClick(container, (event_) => {
    if (!event_.target.closest('[data-action="save"]')) return;

    const form = container.querySelector('#orgSettingsForm');
    const values = Object.fromEntries(new FormData(form).entries());

    if (!values.name?.trim()) {
      showToast('Organizasyon adı zorunludur.', 'error');
      return;
    }
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      showToast('Bitiş tarihi başlangıçtan önce olamaz.', 'error');
      return;
    }

    const patch = {
      ...values,
      capacity: Number(values.capacity) || 0,
      earlyRegPrice: Number(values.earlyRegPrice) || 0,
      lateRegPrice: Number(values.lateRegPrice) || 0,
    };

    // Yönetici değilse sorumlu alanı disabled olduğu için FormData'ya girmez;
    // mevcut değeri korumak gerekir.
    if (!admin) patch.assignedManagerId = event.assignedManagerId ?? '';

    if (admin) {
      const budgetLimits = {};
      container.querySelectorAll('.budget-limit').forEach((input) => {
        budgetLimits[input.dataset.category] = Number(input.value) || 0;
      });
      patch.budgetLimits = budgetLimits;
    }

    DB.events.update(eventId, patch);
    DB.logs.add(`Organizasyon ayarları güncellendi: ${patch.name}`, 'info');
    showToast('Ayarlar kaydedildi.');
    if (onChange) onChange();
  });

  refreshIcons(container);
}
