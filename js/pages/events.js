import { DB } from '../db.js';
import { createTable } from '../components/table.js';
import { openModal, closeModal } from '../components/modal.js';
import { navigateTo } from '../app.js';

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}"></i> ${message}`;
  container.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [toast] });
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3000);
}

const STATUS_MAP = {
  planned:   { badge: 'badge-info',    label: 'Planlanan' },
  active:    { badge: 'badge-success', label: 'Aktif' },
  completed: { badge: 'badge-gray',   label: 'Tamamlanan' }
};

function openEventModal(event, onDone) {
  const isEdit = !!event;
  const data = event || {};
  const users = DB.users.getAll();
  const managerOptions = users.map(u => `<option value="${u.id}" ${data.assignedManagerId === u.id ? 'selected' : ''}>${u.name}</option>`).join('');

  const content = `
    <form id="eventForm">
      <div class="form-group">
        <label class="form-label">Etkinlik (İş) Adı</label>
        <input class="form-input" type="text" name="name" value="${data.name || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Şehir</label>
        <input class="form-input" type="text" name="city" value="${data.city || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Mekan</label>
        <input class="form-input" type="text" name="venue" value="${data.venue || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Başlangıç Tarihi</label>
          <input class="form-input" type="date" name="startDate" value="${data.startDate || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Bitiş Tarihi</label>
          <input class="form-input" type="date" name="endDate" value="${data.endDate || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Kontenjan</label>
        <input class="form-input" type="number" name="capacity" value="${data.capacity || ''}" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">Sorumlu Ata</label>
        <select class="form-select" name="assignedManagerId">
          <option value="">(Atanmadı - Herkes görebilir)</option>
          ${managerOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Durum</label>
        <select class="form-select" name="status">
          <option value="planned" ${data.status === 'planned' ? 'selected' : ''}>Planlanan</option>
          <option value="active" ${data.status === 'active' ? 'selected' : ''}>Aktif</option>
          <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>Tamamlanan</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Açıklama</label>
        <textarea class="form-textarea" name="description" rows="3">${data.description || ''}</textarea>
      </div>
    </form>
  `;

  openModal({
    title: isEdit ? 'Etkinlik Düzenle' : 'Yeni Etkinlik',
    content,
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    onSave: () => {
      const form = document.getElementById('eventForm');
      const formData = new FormData(form);
      const values = Object.fromEntries(formData.entries());

      if (!values.name || !values.name.trim()) {
        showToast('Etkinlik adı zorunludur.', 'error');
        return;
      }

      values.capacity = values.capacity ? Number(values.capacity) : 0;

      if (isEdit) {
        DB.events.update(event.id, values);
        showToast('Etkinlik başarıyla güncellendi.');
      } else {
        DB.events.create(values);
        showToast('Etkinlik başarıyla oluşturuldu.');
      }
      closeModal();
      onDone();
    }
  });
}

export function renderEvents(container) {
  const currentUser = DB.users.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  let events = DB.events.getAll();
  
  if (!isAdmin) {
      events = events.filter(e => !e.assignedManagerId || e.assignedManagerId === currentUser.id);
  }

  container.innerHTML = `
    <div class="page-fade-in">
      <div class="page-header">
        <h1>Etkinlik Listesi</h1>
        <button class="btn btn-primary" id="addEventBtn">
          <i data-lucide="plus"></i> Yeni Etkinlik
        </button>
      </div>
      <div class="card">
        <div id="eventsTableContainer"></div>
      </div>
    </div>
  `;

  const reRender = () => renderEvents(container);

  document.getElementById('addEventBtn').addEventListener('click', () => {
    openEventModal(null, reRender);
  });

  if (events.length === 0) {
    document.getElementById('eventsTableContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="calendar-plus"></i></div>
        <h3 class="empty-state-title">Henüz etkinlik eklenmedi</h3>
        <p class="empty-state-text">Yeni etkinlik eklemek için yukarıdaki butonu kullanın.</p>
      </div>
    `;
    return;
  }

  createTable(document.getElementById('eventsTableContainer'), {
    columns: [
      { key: 'name', label: 'Etkinlik Adı' },
      { key: 'assignedManagerId', label: 'Sorumlu', render: (val) => {
          if (!val) return '-';
          const u = DB.users.getAll().find(x => x.id === val);
          return u ? `<span class="badge badge-purple">${u.name}</span>` : '-';
      }},
      { key: 'city', label: 'Şehir' },
      { key: 'startDate', label: 'Tarih', render: (val, row) => {
        const start = formatDate(row.startDate);
        const end = formatDate(row.endDate);
        return row.endDate ? `${start} - ${end}` : start;
      }},
      { key: 'venue', label: 'Mekan' },
      { key: 'capacity', label: 'Kontenjan', render: (val) => val || '-' },
      { key: 'status', label: 'Durum', render: (val) => {
        const s = STATUS_MAP[val] || { badge: 'badge-gray', label: val };
        return `<span class="badge ${s.badge}">${s.label}</span>`;
      }}
    ],
    data: events,
    searchable: true,
    searchPlaceholder: 'Etkinlik ara...',
    pageSize: 10,
    onRowClick: (row) => {
      navigateTo('#event/' + row.id);
    },
    actions: [
      {
        icon: 'eye',
        className: 'view',
        title: 'Görüntüle',
        onClick: (row) => {
          navigateTo('#event/' + row.id);
        }
      },
      ...(isAdmin ? [
        {
          icon: 'pencil',
          className: 'edit',
          title: 'Düzenle',
          onClick: (row) => {
            const event = DB.events.getById(row.id);
            openEventModal(event, reRender);
          }
        },
        {
          icon: 'trash-2',
          className: 'delete',
          title: 'Sil',
          onClick: (row) => {
            const pCount = DB.participants.getByEventId(row.id).length;
            const fCount = DB.flights.getByEventId(row.id).length;
            const bCount = DB.budgetItems.getByEventId(row.id).length;
            const msg = `"${row.name}" silinecek. Bu işlemle birlikte ${pCount} kayıt, ${fCount} uçak bileti ve ${bCount} bütçe kalemi de silinecektir. Devam etmek istiyor musunuz?`;
            if (window.confirm(msg)) {
              DB.events.delete(row.id);
              showToast('Etkinlik başarıyla silindi.');
              reRender();
            }
          }
        }
      ] : [])
    ]
  });
}
