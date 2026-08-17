/**
 * Etkinlik (organizasyon) listesi ve CRUD.
 */
import { DB } from '../core/store.js';
import { createTable } from '../components/table.js';
import { openModal, closeModal } from '../components/modal.js';
import { navigateTo, paths } from '../core/router.js';
import { formatDate, formatAmount } from '../core/format.js';
import { html, raw, showToast, refreshIcons, emptyState } from '../core/ui.js';
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

  container.querySelector('#addEventBtn')?.addEventListener('click', () => openEventModal(null, reload));

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
          return user ? `<span class="badge badge-purple">${user.name}</span>` : '-';
        },
      },
      { key: 'city', label: 'Şehir', render: (value) => value || '-' },
      {
        key: 'startDate',
        label: 'Tarih',
        render: (_value, row) =>
          row.endDate ? `${formatDate(row.startDate)} — ${formatDate(row.endDate)}` : formatDate(row.startDate),
      },
      { key: 'venue', label: 'Mekan', render: (value) => value || '-' },
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
          return `<span class="badge ${status.badge}">${status.label}</span>`;
        },
      },
    ],
    actions: [
      { icon: 'eye', className: 'view', title: 'Aç', onClick: (row) => navigateTo(paths.org(row.id)) },
      ...(admin ? [
        {
          icon: 'pencil',
          className: 'edit',
          title: 'Düzenle',
          onClick: (row) => openEventModal(DB.events.getById(row.id), reload),
        },
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

function openEventModal(event, onDone) {
  const isEdit = Boolean(event);
  const data = event ?? {};
  const users = DB.users.getAll();

  openModal({
    title: isEdit ? 'Etkinlik Düzenle' : 'Yeni Etkinlik',
    width: '640px',
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    content: html`
      <form id="eventForm">
        <div class="form-group">
          <label class="form-label">Etkinlik Adı *</label>
          <input class="form-input" type="text" name="name" value="${data.name ?? ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Şehir</label>
            <input class="form-input" type="text" name="city" value="${data.city ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Mekan</label>
            <input class="form-input" type="text" name="venue" value="${data.venue ?? ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Başlangıç Tarihi</label>
            <input class="form-input" type="date" name="startDate" value="${data.startDate ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Bitiş Tarihi</label>
            <input class="form-input" type="date" name="endDate" value="${data.endDate ?? ''}">
          </div>
        </div>

        <div style="border-top:1px solid var(--slate-100);margin:20px 0 16px;padding-top:16px;">
          <h4 style="font-size:0.95rem;font-weight:700;margin:0 0 4px;">Kayıt Fiyatlandırması</h4>
          <p style="font-size:0.8rem;color:var(--slate-500);margin:0 0 12px;">
            Misafir kayıtlarının geliri bu fiyatlardan hesaplanır. Boş bırakılırsa kayıt geliri sıfır görünür.
          </p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Erken Kayıt Ücreti (₺)</label>
              <input class="form-input" type="number" name="earlyRegPrice" value="${data.earlyRegPrice ?? ''}" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label class="form-label">Geç Kayıt Ücreti (₺)</label>
              <input class="form-input" type="number" name="lateRegPrice" value="${data.lateRegPrice ?? ''}" min="0" step="0.01">
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kontenjan</label>
            <input class="form-input" type="number" name="capacity" value="${data.capacity ?? ''}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Durum</label>
            <select class="form-select" name="status">
              ${Object.entries(STATUS_MAP).map(([value, meta]) => raw(html`
                <option value="${value}" ${data.status === value ? raw('selected') : ''}>${meta.label}</option>
              `))}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Sorumlu Ata</label>
          <select class="form-select" name="assignedManagerId">
            <option value="">(Atanmadı — herkes görebilir)</option>
            ${users.map((user) => raw(html`
              <option value="${user.id}" ${data.assignedManagerId === user.id ? raw('selected') : ''}>${user.name}</option>
            `))}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <textarea class="form-textarea" name="description" rows="3">${data.description ?? ''}</textarea>
        </div>
      </form>
    `,
    onSave: () => {
      const form = document.getElementById('eventForm');
      const values = Object.fromEntries(new FormData(form).entries());

      if (!values.name.trim()) {
        showToast('Etkinlik adı zorunludur.', 'error');
        return;
      }
      if (values.startDate && values.endDate && values.endDate < values.startDate) {
        showToast('Bitiş tarihi başlangıçtan önce olamaz.', 'error');
        return;
      }

      values.capacity = Number(values.capacity) || 0;
      values.earlyRegPrice = Number(values.earlyRegPrice) || 0;
      values.lateRegPrice = Number(values.lateRegPrice) || 0;

      if (isEdit) {
        DB.events.update(event.id, values);
        showToast('Etkinlik güncellendi.');
      } else {
        DB.events.create(values);
        DB.logs.add(`Yeni organizasyon oluşturuldu: ${values.name}`, 'success');
        showToast('Etkinlik oluşturuldu.');
      }

      closeModal();
      onDone();
    },
  });
}
