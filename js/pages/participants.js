import { DB } from '../db.js';
import { createTable } from '../components/table.js';
import { openModal, closeModal } from '../components/modal.js';

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCurrency(amount) {
  return '₺' + Number(amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

const TYPE_BADGES = {
  speaker:  { badge: 'badge-purple', label: 'Konuşmacı' },
  vip:      { badge: 'badge-gold',   label: 'VIP' },
  standard: { badge: 'badge-info',   label: 'Standart' }
};

function openParticipantModal(participant, eventId, onDone) {
  const isEdit = !!participant;
  const data = participant || {};
  const events = DB.events.getAll();

  const eventSelect = !eventId ? `
    <div class="form-group">
      <label class="form-label">Etkinlik</label>
      <select class="form-select" name="eventId" required>
        <option value="">Etkinlik seçin...</option>
        ${events.map(e => `<option value="${e.id}" ${data.eventId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
      </select>
    </div>
  ` : '';

  const content = `
    <form id="participantForm">
      ${eventSelect}
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Ad</label>
          <input class="form-input" type="text" name="firstName" value="${data.firstName || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Soyad</label>
          <input class="form-input" type="text" name="lastName" value="${data.lastName || ''}" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Kurum/Hastane</label>
        <input class="form-input" type="text" name="organization" value="${data.organization || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Unvan</label>
        <input class="form-input" type="text" name="title" value="${data.title || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">E-posta</label>
          <input class="form-input" type="email" name="email" value="${data.email || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Telefon</label>
          <input class="form-input mask-phone" type="tel" name="phone" value="${data.phone || ''}" placeholder="05XX XXX XX XX">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Kayıt Tipi</label>
        <select class="form-select" name="type">
          <option value="standard" ${data.type === 'standard' ? 'selected' : ''}>Standart</option>
          <option value="speaker" ${data.type === 'speaker' ? 'selected' : ''}>Konuşmacı</option>
          <option value="vip" ${data.type === 'vip' ? 'selected' : ''}>VIP</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-checkbox-group">
          <label class="form-checkbox">
            <input type="checkbox" name="accommodation" ${data.accommodation ? 'checked' : ''}>
            <span>Konaklama</span>
          </label>
        </div>
        <div class="form-checkbox-group">
          <label class="form-checkbox">
            <input type="checkbox" name="transfer" ${data.transfer ? 'checked' : ''}>
            <span>Transfer</span>
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notlar</label>
        <textarea class="form-textarea" name="notes" rows="3">${data.notes || ''}</textarea>
      </div>
    </form>
  `;

  openModal({
    title: isEdit ? 'Katılımcı Düzenle' : 'Yeni Katılımcı',
    content,
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    onSave: () => {
      const form = document.getElementById('participantForm');
      const formData = new FormData(form);
      const values = Object.fromEntries(formData.entries());

      values.accommodation = form.querySelector('[name="accommodation"]').checked;
      values.transfer = form.querySelector('[name="transfer"]').checked;

      if (!values.firstName || !values.firstName.trim()) {
        showToast('Ad alanı zorunludur.', 'error');
        return;
      }
      if (!values.lastName || !values.lastName.trim()) {
        showToast('Soyad alanı zorunludur.', 'error');
        return;
      }

      const resolvedEventId = eventId || values.eventId;
      if (!resolvedEventId) {
        showToast('Lütfen bir etkinlik seçin.', 'error');
        return;
      }
      values.eventId = resolvedEventId;

      if (isEdit) {
        DB.participants.update(participant.id, values);
        showToast('Katılımcı başarıyla güncellendi.');
      } else {
        DB.participants.create(values);
        showToast('Katılımcı başarıyla eklendi.');
      }
      closeModal();
      onDone();
    }
  });
}

export function renderParticipants(container, eventId) {
  const participants = eventId
    ? DB.participants.getByEventId(eventId)
    : DB.participants.getAll();

  container.innerHTML = `
    <div class="page-fade-in">
      <div class="page-header">
        <h1>Katılımcı Listesi</h1>
        <button class="btn btn-primary" id="addParticipantBtn">
          <i data-lucide="user-plus"></i> Yeni Katılımcı
        </button>
      </div>
      <div class="card">
        <div id="participantsTableContainer"></div>
      </div>
    </div>
  `;

  const reRender = () => renderParticipants(container, eventId);

  document.getElementById('addParticipantBtn').addEventListener('click', () => {
    openParticipantModal(null, eventId, reRender);
  });

  if (participants.length === 0) {
    document.getElementById('participantsTableContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="users"></i></div>
        <h3 class="empty-state-title">Henüz katılımcı eklenmedi</h3>
        <p class="empty-state-text">Yeni katılımcı eklemek için yukarıdaki butonu kullanın.</p>
      </div>
    `;
    return;
  }

  createTable(document.getElementById('participantsTableContainer'), {
    columns: [
      { key: 'firstName', label: 'Ad Soyad', render: (val, row) => `${row.firstName} ${row.lastName}` },
      { key: 'organization', label: 'Kurum/Hastane', render: (val) => val || '-' },
      { key: 'title', label: 'Unvan', render: (val) => val || '-' },
      { key: 'type', label: 'Tip', render: (val) => {
        const t = TYPE_BADGES[val] || { badge: 'badge-info', label: val };
        return `<span class="badge ${t.badge}">${t.label}</span>`;
      }},
      { key: 'email', label: 'E-posta', render: (val) => val || '-' },
      { key: 'phone', label: 'Telefon', render: (val) => val || '-' },
      { key: 'accommodation', label: 'Konaklama', render: (val) =>
        val ? '<i data-lucide="check" style="color:var(--color-success);width:18px;"></i>' : '<i data-lucide="x" style="color:var(--color-danger);width:18px;"></i>'
      },
      { key: 'transfer', label: 'Transfer', render: (val) =>
        val ? '<i data-lucide="check" style="color:var(--color-success);width:18px;"></i>' : '<i data-lucide="x" style="color:var(--color-danger);width:18px;"></i>'
      }
    ],
    data: participants,
    searchable: true,
    searchPlaceholder: 'Katılımcı ara...',
    pageSize: 10,
    filters: [
      {
        key: 'type',
        label: 'Tip',
        options: [
          { value: '', label: 'Tüm Tipler' },
          { value: 'speaker', label: 'Konuşmacı' },
          { value: 'vip', label: 'VIP' },
          { value: 'standard', label: 'Standart' }
        ]
      },
      {
        key: 'accommodation',
        label: 'Konaklama',
        options: [
          { value: '', label: 'Tümü' },
          { value: 'true', label: 'Konaklama Var' },
          { value: 'false', label: 'Konaklama Yok' }
        ]
      }
    ],
    actions: [
      {
        icon: 'pencil',
        className: 'edit',
        title: 'Düzenle',
        onClick: (row) => {
          const p = DB.participants.getById(row.id);
          openParticipantModal(p, eventId, reRender);
        }
      },
      {
        icon: 'trash-2',
        className: 'delete',
        title: 'Sil',
        onClick: (row) => {
          if (window.confirm(`"${row.firstName} ${row.lastName}" katılımcısını silmek istediğinize emin misiniz?`)) {
            DB.participants.delete(row.id);
            showToast('Katılımcı başarıyla silindi.');
            reRender();
          }
        }
      }
    ]
  });
}
