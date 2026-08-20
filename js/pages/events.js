/**
 * Etkinlik (organizasyon) listesi ve CRUD.
 */
import { DB } from '../core/store.js';
import { createTable } from '../components/table.js';
import { openModal, closeModal } from '../components/modal.js';
import { navigateTo, paths } from '../core/router.js';
import { formatDate, formatAmount } from '../core/format.js';
import { html, raw, showToast, refreshIcons, emptyState, escapeHtml } from '../core/ui.js';
import { isAdmin, visibleEvents } from '../core/auth.js';

const STATUS_MAP = {
  planned: { badge: 'badge-info', label: 'Planlanan' },
  active: { badge: 'badge-success', label: 'Aktif' },
  completed: { badge: 'badge-gray', label: 'Tamamlanan' },
};

export function renderEvents(container) {
  const admin = isAdmin();
  const events = visibleEvents();
  const reload = () => renderEvents(container);

  container.innerHTML = html`
    <div class="page-header">
      <h1>Etkinlik Listesi</h1>
      ${admin ? raw('<button class="btn btn-primary" id="addEventBtn"><i data-lucide="plus"></i> Yeni Etkinlik</button>') : ''}
    </div>
    <div class="card"><div id="eventsTable"></div></div>
  `;

  container.querySelector('#addEventBtn')?.addEventListener('click', () => openEventModal(reload));

  const host = container.querySelector('#eventsTable');

  if (events.length === 0) {
    host.innerHTML = emptyState({
      icon: 'calendar-plus',
      title: 'Henüz etkinlik eklenmedi',
      text: admin ? 'Yeni etkinlik eklemek için yukarıdaki butonu kullanın.' : 'Size atanmış bir organizasyon bulunmuyor.',
    });
    refreshIcons(container);
    return;
  }

  createTable(host, {
    data: events,
    searchable: true,
    searchPlaceholder: 'Etkinlik ara...',
    pageSize: 10,
    onRowClick: (row) => navigateTo(paths.org(row.id)),
    columns: [
      { key: 'name', label: 'Etkinlik Adı' },
      {
        key: 'assignedManagerId',
        label: 'Sorumlu',
        render: (value) => {
          if (!value) return '<span style="color:var(--slate-400);">Atanmadı</span>';
          const user = DB.users.getById(value);
          return user ? `<span class="badge badge-purple">${escapeHtml(user.name)}</span>` : '-';
        },
      },
      { key: 'city', label: 'Şehir', render: (value) => escapeHtml(value) || '-' },
      {
        key: 'startDate',
        label: 'Tarih',
        render: (_value, row) =>
          row.endDate ? `${formatDate(row.startDate)} — ${formatDate(row.endDate)}` : formatDate(row.startDate),
      },
      { key: 'venue', label: 'Mekan', render: (value) => escapeHtml(value) || '-' },
      {
        key: 'earlyRegPrice',
        label: 'Kayıt Ücreti',
        render: (_value, row) => {
          const early = Number(row.earlyRegPrice) || 0;
          const late = Number(row.lateRegPrice) || 0;
          if (!early && !late) return '<span class="badge badge-warning">Belirlenmedi</span>';
          return `<div style="font-size:0.8rem;"><div>Erken: ${formatAmount(early)}</div><div style="color:var(--slate-500);">Geç: ${formatAmount(late)}</div></div>`;
        },
      },
      {
        key: 'status',
        label: 'Durum',
        render: (value) => {
          const status = STATUS_MAP[value] ?? { badge: 'badge-gray', label: value ?? '-' };
          return `<span class="badge ${status.badge}">${escapeHtml(status.label)}</span>`;
        },
      },
    ],
    actions: [
      { icon: 'eye', className: 'view', title: 'Aç', onClick: (row) => navigateTo(paths.org(row.id)) },
      // Düzenleme organizasyonun Ayarlar sekmesinde yapılır; burada yalnızca
      // oraya kısayol var, böylece aynı alanlar iki yerde düzenlenmiyor.
      {
        icon: 'sliders',
        className: 'edit',
        title: 'Ayarlar',
        onClick: (row) => navigateTo(paths.org(row.id, 'settings')),
      },
      ...(admin ? [
        {
          icon: 'trash-2',
          className: 'delete',
          title: 'Sil',
          onClick: (row) => confirmDelete(row, reload),
        },
      ] : []),
    ],
  });

  refreshIcons(container);
}

function confirmDelete(row, onDone) {
  const counts = {
    misafir: DB.participants.getByEventId(row.id).length,
    'uçuş kaydı': DB.flights.getByEventId(row.id).length,
    'bütçe kalemi': DB.budgets.getByEventId(row.id).length,
    sponsor: DB.sponsors.getByEventId(row.id).length,
    proforma: DB.proformas.getByEventId(row.id).length,
  };

  const details = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count} ${label}`)
    .join(', ');

  const message = details
    ? `"${row.name}" silinecek. Birlikte ${details} de silinecektir. Devam edilsin mi?`
    : `"${row.name}" silinecek. Devam edilsin mi?`;

  if (!window.confirm(message)) return;

  DB.events.delete(row.id);
  DB.logs.add(`Organizasyon silindi: ${row.name}`, 'danger');
  showToast('Etkinlik ve bağlı tüm kayıtlar silindi.');
  onDone();
}

/**
 * Yeni organizasyon oluşturma.
 * Yalnızca kimlik bilgileri sorulur; fiyatlandırma, limitler ve sorumlu
 * ataması organizasyonun Ayarlar sekmesinde yapılır — aynı alanların iki
 * yerde düzenlenmesini önlemek için.
 */
function openEventModal(onDone) {
  openModal({
    title: 'Yeni Organizasyon',
    width: '560px',
    saveText: 'Oluştur',
    content: html`
      <form id="eventForm">
        <div class="form-group">
          <label class="form-label">Organizasyon Adı *</label>
          <input class="form-input" type="text" name="name" placeholder="Örn: 15. Ulusal Kardiyoloji Kongresi" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Şehir</label>
            <input class="form-input" type="text" name="city">
          </div>
          <div class="form-group">
            <label class="form-label">Mekan</label>
            <input class="form-input" type="text" name="venue">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Başlangıç Tarihi</label>
            <input class="form-input" type="date" name="startDate">
          </div>
          <div class="form-group">
            <label class="form-label">Bitiş Tarihi</label>
            <input class="form-input" type="date" name="endDate">
          </div>
        </div>
        <div style="font-size:0.8rem;color:var(--info);display:flex;gap:8px;padding:12px;background:var(--info-light);border-radius:var(--radius-md);margin-top:8px;">
          <i data-lucide="info" style="width:16px;flex-shrink:0;"></i>
          <span>Kayıt fiyatları, bütçe limitleri ve sorumlu ataması oluşturduktan sonra organizasyonun Ayarlar sekmesinden yapılır.</span>
        </div>
      </form>
    `,
    onSave: () => {
      const form = document.getElementById('eventForm');
      const values = Object.fromEntries(new FormData(form).entries());

      if (!values.name.trim()) {
        showToast('Organizasyon adı zorunludur.', 'error');
        return;
      }
      if (values.startDate && values.endDate && values.endDate < values.startDate) {
        showToast('Bitiş tarihi başlangıçtan önce olamaz.', 'error');
        return;
      }

      const created = DB.events.create({ ...values, status: 'planned', capacity: 0 });
      DB.logs.add(`Yeni organizasyon oluşturuldu: ${values.name}`, 'success');
      showToast('Organizasyon oluşturuldu. Ayarlar sekmesinden fiyatlandırmayı tamamlayın.');
      closeModal();
      onDone();
      // Kullanıcıyı doğrudan eksik kalan ayarlara yönlendir.
      navigateTo(paths.org(created.id, 'settings'));
    },
  });
}
