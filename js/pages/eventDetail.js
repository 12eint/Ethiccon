import { DB } from '../db.js';
import { createTable } from '../components/table.js';
import { openModal, closeModal } from '../components/modal.js';
import { navigateTo } from '../app.js';
import { renderTransfersModule } from './modules/transfers.js';
import { renderTasksModule } from './modules/tasks.js';
import { renderCommunicationModule } from './modules/communication.js';

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

// ── Badge Maps ──
const PARTICIPANT_TYPES = {
  speaker:  { badge: 'badge-purple', label: 'Konuşmacı' },
  vip:      { badge: 'badge-gold',   label: 'VIP' },
  standard: { badge: 'badge-info',   label: 'Standart' }
};

const PACKAGE_BADGES = {
  'ana-sponsor': { badge: 'badge-gold',   label: 'Ana Sponsor' },
  'gold':        { badge: 'badge-gold',   label: 'Altın' },
  'silver':      { badge: 'badge-silver', label: 'Gümüş' },
  'bronze':      { badge: 'badge-bronze', label: 'Bronz' }
};

const SPONSOR_STATUS = {
  confirmed: { badge: 'badge-success', label: 'Onaylı' },
  pending:   { badge: 'badge-warning', label: 'Beklemede' },
  cancelled: { badge: 'badge-danger',  label: 'İptal' }
};

const BUDGET_CATEGORIES = [
  'Sponsorluk Geliri', 'Kayıt Geliri',
  'Otel Gideri', 'Uçak Gideri', 'Transfer Gideri',
  'Baskı Gideri', 'Organizasyon Gideri', 'Diğer'
];

// ── Tab: Participants ──
function renderParticipantsTab(tabContent, eventId, reRender) {
  const participants = DB.participants.getByEventId(eventId);

  tabContent.innerHTML = `
    <div class="page-header">
      <h2>Katılımcılar</h2>
      <button class="btn btn-primary btn-sm" id="addParticipantBtn">
        <i data-lucide="user-plus"></i> Yeni Katılımcı
      </button>
    </div>
    <div id="participantsTableContainer"></div>
  `;

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
      { key: 'firstName', label: 'Ad Soyad', render: (v, r) => `${r.firstName} ${r.lastName}` },
      { key: 'organization', label: 'Kurum/Hastane', render: v => v || '-' },
      { key: 'title', label: 'Unvan', render: v => v || '-' },
      { key: 'type', label: 'Tip', render: v => {
        const t = PARTICIPANT_TYPES[v] || { badge: 'badge-info', label: v };
        return `<span class="badge ${t.badge}">${t.label}</span>`;
      }},
      { key: 'email', label: 'E-posta', render: v => v || '-' },
      { key: 'accommodation', label: 'Konaklama', render: v =>
        v ? '<i data-lucide="check" style="color:var(--color-success);width:18px;"></i>' : '<i data-lucide="x" style="color:var(--color-danger);width:18px;"></i>'
      },
      { key: 'transfer', label: 'Transfer', render: v =>
        v ? '<i data-lucide="check" style="color:var(--color-success);width:18px;"></i>' : '<i data-lucide="x" style="color:var(--color-danger);width:18px;"></i>'
      }
    ],
    data: participants,
    searchable: true,
    searchPlaceholder: 'Katılımcı ara...',
    pageSize: 10,
    actions: [
      { icon: 'pencil', className: 'edit', title: 'Düzenle', onClick: (row) => {
        const p = DB.participants.getById(row.id);
        openParticipantModal(p, eventId, reRender);
      }},
      { icon: 'trash-2', className: 'delete', title: 'Sil', onClick: (row) => {
        if (window.confirm(`"${row.firstName} ${row.lastName}" katılımcısını silmek istediğinize emin misiniz?`)) {
          DB.participants.delete(row.id);
          showToast('Katılımcı silindi.');
          reRender();
        }
      }}
    ]
  });
}

function openParticipantModal(participant, eventId, onDone) {
  const isEdit = !!participant;
  const data = participant || {};
  const content = `
    <form id="participantForm">
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
          <input class="form-input" type="tel" name="phone" value="${data.phone || ''}">
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
      values.eventId = eventId;

      if (!values.firstName?.trim() || !values.lastName?.trim()) {
        showToast('Ad ve Soyad alanları zorunludur.', 'error');
        return;
      }

      if (isEdit) {
        DB.participants.update(participant.id, values);
        showToast('Katılımcı güncellendi.');
      } else {
        DB.participants.create(values);
        showToast('Katılımcı eklendi.');
      }
      closeModal();
      onDone();
    }
  });
}

// ── Tab: Sponsors ──
function renderSponsorsTab(tabContent, eventId, reRender) {
  const sponsors = DB.sponsors.getByEventId(eventId);

  tabContent.innerHTML = `
    <div class="page-header">
      <h2>Sponsorlar</h2>
      <button class="btn btn-primary btn-sm" id="addSponsorBtn">
        <i data-lucide="plus"></i> Yeni Sponsor
      </button>
    </div>
    <div id="sponsorsTableContainer"></div>
  `;

  document.getElementById('addSponsorBtn').addEventListener('click', () => {
    openSponsorModal(null, eventId, reRender);
  });

  if (sponsors.length === 0) {
    document.getElementById('sponsorsTableContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="building-2"></i></div>
        <h3 class="empty-state-title">Henüz sponsor eklenmedi</h3>
        <p class="empty-state-text">Yeni sponsor eklemek için yukarıdaki butonu kullanın.</p>
      </div>
    `;
    return;
  }

  createTable(document.getElementById('sponsorsTableContainer'), {
    columns: [
      { key: 'companyName', label: 'Firma Adı' },
      { key: 'contactPerson', label: 'Yetkili Kişi', render: v => v || '-' },
      { key: 'contactEmail', label: 'E-posta', render: v => v || '-' },
      { key: 'packageType', label: 'Paket', render: v => {
        const p = PACKAGE_BADGES[v] || { badge: 'badge-gray', label: v };
        return `<span class="badge ${p.badge}">${p.label}</span>`;
      }},
      { key: 'standArea', label: 'Stand Alanı', render: v => v ? `${v} m²` : '-' },
      { key: 'status', label: 'Durum', render: v => {
        const s = SPONSOR_STATUS[v] || { badge: 'badge-gray', label: v };
        return `<span class="badge ${s.badge}">${s.label}</span>`;
      }}
    ],
    data: sponsors,
    searchable: true,
    searchPlaceholder: 'Sponsor ara...',
    pageSize: 10,
    actions: [
      { icon: 'pencil', className: 'edit', title: 'Düzenle', onClick: (row) => {
        const s = DB.sponsors.getById(row.id);
        openSponsorModal(s, eventId, reRender);
      }},
      { icon: 'trash-2', className: 'delete', title: 'Sil', onClick: (row) => {
        if (window.confirm(`"${row.companyName}" sponsorunu silmek istediğinize emin misiniz?`)) {
          DB.sponsors.delete(row.id);
          showToast('Sponsor silindi.');
          reRender();
        }
      }}
    ]
  });
}

function openSponsorModal(sponsor, eventId, onDone) {
  const isEdit = !!sponsor;
  const data = sponsor || {};
  const content = `
    <form id="sponsorForm">
      <div class="form-group">
        <label class="form-label">Firma Adı</label>
        <input class="form-input" type="text" name="companyName" value="${data.companyName || ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Yetkili Kişi</label>
          <input class="form-input" type="text" name="contactPerson" value="${data.contactPerson || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">E-posta</label>
          <input class="form-input" type="email" name="contactEmail" value="${data.contactEmail || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Telefon</label>
        <input class="form-input" type="tel" name="contactPhone" value="${data.contactPhone || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Sponsorluk Paketi</label>
          <select class="form-select" name="packageType">
            <option value="bronze" ${data.packageType === 'bronze' ? 'selected' : ''}>Bronz</option>
            <option value="silver" ${data.packageType === 'silver' ? 'selected' : ''}>Gümüş</option>
            <option value="gold" ${data.packageType === 'gold' ? 'selected' : ''}>Altın</option>
            <option value="ana-sponsor" ${data.packageType === 'ana-sponsor' ? 'selected' : ''}>Ana Sponsor</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Stand Alanı (m²)</label>
          <input class="form-input" type="number" name="standArea" value="${data.standArea || ''}" min="0" step="0.5">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Durum</label>
        <select class="form-select" name="status">
          <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>Beklemede</option>
          <option value="confirmed" ${data.status === 'confirmed' ? 'selected' : ''}>Onaylı</option>
          <option value="cancelled" ${data.status === 'cancelled' ? 'selected' : ''}>İptal</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Ek Talepler</label>
        <textarea class="form-textarea" name="additionalRequests" rows="3">${data.additionalRequests || ''}</textarea>
      </div>
    </form>
  `;

  openModal({
    title: isEdit ? 'Sponsor Düzenle' : 'Yeni Sponsor',
    content,
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    onSave: () => {
      const form = document.getElementById('sponsorForm');
      const formData = new FormData(form);
      const values = Object.fromEntries(formData.entries());
      values.eventId = eventId;
      values.standArea = values.standArea ? Number(values.standArea) : 0;

      if (!values.companyName?.trim()) {
        showToast('Firma adı zorunludur.', 'error');
        return;
      }

      if (isEdit) {
        DB.sponsors.update(sponsor.id, values);
        showToast('Sponsor güncellendi.');
      } else {
        DB.sponsors.create(values);
        showToast('Sponsor eklendi.');
      }
      closeModal();
      onDone();
    }
  });
}

// ── Tab: Budget ──
function renderBudgetTab(tabContent, eventId, reRender) {
  const items = DB.budgetItems.getByEventId(eventId);
  const totalIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + Number(i.amount || 0), 0);
  const net = totalIncome - totalExpense;
  const total = totalIncome + totalExpense;
  const incomePercent = total > 0 ? (totalIncome / total) * 100 : 50;

  tabContent.innerHTML = `
    <div class="budget-summary-grid">
      <div class="budget-summary-card income">
        <div class="budget-amount positive">
          <i data-lucide="trending-up"></i>
          ${formatCurrency(totalIncome)}
        </div>
        <div class="budget-label">Toplam Gelir</div>
      </div>
      <div class="budget-summary-card expense">
        <div class="budget-amount negative">
          <i data-lucide="trending-down"></i>
          ${formatCurrency(totalExpense)}
        </div>
        <div class="budget-label">Toplam Gider</div>
      </div>
      <div class="budget-summary-card">
        <div class="budget-amount ${net >= 0 ? 'positive' : 'negative'}">
          <i data-lucide="${net >= 0 ? 'check-circle' : 'alert-circle'}"></i>
          ${formatCurrency(Math.abs(net))}
        </div>
        <div class="budget-label">Net ${net >= 0 ? 'Kar' : 'Zarar'}</div>
      </div>
    </div>
    <div class="profit-bar">
      <div class="profit-bar-fill ${net >= 0 ? 'positive' : 'negative'}" style="width: ${incomePercent}%"></div>
    </div>

    <div class="page-header" style="margin-top: 1.5rem;">
      <h2>Bütçe Kalemleri</h2>
      <button class="btn btn-primary btn-sm" id="addBudgetBtn">
        <i data-lucide="plus"></i> Yeni Kalem
      </button>
    </div>
    <div id="budgetTableContainer"></div>
  `;

  document.getElementById('addBudgetBtn').addEventListener('click', () => {
    openBudgetModal(null, eventId, reRender);
  });

  if (items.length === 0) {
    document.getElementById('budgetTableContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="wallet"></i></div>
        <h3 class="empty-state-title">Henüz bütçe kalemi eklenmedi</h3>
        <p class="empty-state-text">Yeni kalem eklemek için yukarıdaki butonu kullanın.</p>
      </div>
    `;
    return;
  }

  createTable(document.getElementById('budgetTableContainer'), {
    columns: [
      { key: 'category', label: 'Kategori' },
      { key: 'description', label: 'Açıklama', render: v => v || '-' },
      { key: 'type', label: 'Tip', render: v =>
        v === 'income' ? '<span class="badge badge-success">Gelir</span>' : '<span class="badge badge-danger">Gider</span>'
      },
      { key: 'amount', label: 'Tutar', render: v => formatCurrency(v) }
    ],
    data: items,
    searchable: true,
    searchPlaceholder: 'Bütçe kalemi ara...',
    pageSize: 10,
    filters: [{
      key: 'type', label: 'Tip',
      options: [
        { value: '', label: 'Tümü' },
        { value: 'income', label: 'Gelir' },
        { value: 'expense', label: 'Gider' }
      ]
    }],
    actions: [
      { icon: 'pencil', className: 'edit', title: 'Düzenle', onClick: (row) => {
        openBudgetModal(row, eventId, reRender);
      }},
      { icon: 'trash-2', className: 'delete', title: 'Sil', onClick: (row) => {
        if (window.confirm('Bu bütçe kalemini silmek istediğinize emin misiniz?')) {
          DB.budgetItems.delete(row.id);
          showToast('Bütçe kalemi silindi.');
          reRender();
        }
      }}
    ]
  });
}

function openBudgetModal(item, eventId, onDone) {
  const isEdit = !!item;
  const data = item || {};
  const content = `
    <form id="budgetForm">
      <div class="form-group">
        <label class="form-label">Kategori</label>
        <select class="form-select" name="category" id="budgetCategory">
          ${BUDGET_CATEGORIES.map(c => `<option value="${c}" ${data.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Açıklama</label>
        <input class="form-input" type="text" name="description" value="${data.description || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Tip</label>
        <select class="form-select" name="type" id="budgetType">
          <option value="income" ${data.type === 'income' ? 'selected' : ''}>Gelir</option>
          <option value="expense" ${data.type === 'expense' ? 'selected' : ''}>Gider</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tutar (₺)</label>
        <input class="form-input" type="number" name="amount" value="${data.amount || ''}" min="0" step="0.01" required>
      </div>
    </form>
  `;

  openModal({
    title: isEdit ? 'Bütçe Kalemi Düzenle' : 'Yeni Bütçe Kalemi',
    content,
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    onSave: () => {
      const form = document.getElementById('budgetForm');
      const formData = new FormData(form);
      const values = Object.fromEntries(formData.entries());
      values.eventId = eventId;
      values.amount = Number(values.amount || 0);

      if (values.amount <= 0) {
        showToast('Tutar sıfırdan büyük olmalıdır.', 'error');
        return;
      }

      if (isEdit) {
        DB.budgetItems.update(item.id, values);
        showToast('Bütçe kalemi güncellendi.');
      } else {
        DB.budgetItems.create(values);
        showToast('Bütçe kalemi eklendi.');
      }
      closeModal();
      onDone();
    }
  });

  // Auto-set type from category
  const catSel = document.getElementById('budgetCategory');
  const typeSel = document.getElementById('budgetType');
  if (catSel && typeSel && !isEdit) {
    const autoType = catSel.value.includes('Geliri') ? 'income' : catSel.value.includes('Gideri') ? 'expense' : '';
    if (autoType) typeSel.value = autoType;
    catSel.addEventListener('change', () => {
      const at = catSel.value.includes('Geliri') ? 'income' : catSel.value.includes('Gideri') ? 'expense' : '';
      if (at) typeSel.value = at;
    });
  }
}

// ── Tab: Proforma ──
function renderProformaTab(tabContent, eventId, reRender) {
  const proformas = DB.proformas.getByEventId(eventId);

  tabContent.innerHTML = `
    <div class="page-header">
      <h2>Proforma Faturalar</h2>
      <button class="btn btn-primary btn-sm" id="addProformaBtn">
        <i data-lucide="plus"></i> Yeni Proforma
      </button>
    </div>
    <div id="proformaTableContainer"></div>
  `;

  document.getElementById('addProformaBtn').addEventListener('click', () => {
    openProformaModalDetail(null, eventId, reRender);
  });

  if (proformas.length === 0) {
    document.getElementById('proformaTableContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="file-text"></i></div>
        <h3 class="empty-state-title">Henüz proforma oluşturulmadı</h3>
        <p class="empty-state-text">Yeni proforma oluşturmak için yukarıdaki butonu kullanın.</p>
      </div>
    `;
    return;
  }

  createTable(document.getElementById('proformaTableContainer'), {
    columns: [
      { key: 'invoiceNo', label: 'Fatura No' },
      { key: 'sponsorId', label: 'Sponsor', render: v => {
        const s = DB.sponsors.getById(v);
        return s ? s.companyName : '-';
      }},
      { key: 'issueDate', label: 'Düzenleme Tarihi', render: v => formatDate(v) },
      { key: 'dueDate', label: 'Vade Tarihi', render: v => formatDate(v) },
      { key: 'id', label: 'Toplam', render: (v, row) => {
        const items = DB.proformaItems.getByProformaId(row.id);
        const sub = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0);
        return formatCurrency(sub * (1 + Number(row.vatRate || 0) / 100));
      }},
      { key: 'paymentReceived', label: 'Alınan Ödeme', render: (v) => {
        return `<span style="color:var(--success); font-weight:600;">${formatCurrency(v || 0)}</span>`;
      }},
      { key: 'balance', label: 'Kalan', render: (v, row) => {
        const items = DB.proformaItems.getByProformaId(row.id);
        const sub = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0);
        const total = sub * (1 + Number(row.vatRate || 0) / 100);
        const diff = total - (Number(row.paymentReceived) || 0);
        return `<span style="color:${diff > 0 ? 'var(--danger)' : 'var(--slate-500)'}; font-weight:600;">${formatCurrency(diff)}</span>`;
      }}
    ],
    data: proformas,
    searchable: true,
    searchPlaceholder: 'Proforma ara...',
    pageSize: 10,
    actions: [
      { icon: 'eye', className: 'view', title: 'Düzenle', onClick: (row) => {
        const p = DB.proformas.getById(row.id);
        openProformaModalDetail(p, eventId, reRender);
      }},
      { icon: 'trash-2', className: 'delete', title: 'Sil', onClick: (row) => {
        if (window.confirm('Bu proformayı silmek istediğinize emin misiniz?')) {
          DB.proformaItems.deleteByProformaId(row.id);
          DB.proformas.delete(row.id);
          showToast('Proforma silindi.');
          reRender();
        }
      }}
    ]
  });
}

function openProformaModalDetail(proforma, eventId, onDone) {
  const isEdit = !!proforma;
  const data = proforma || {};
  const sponsors = DB.sponsors.getByEventId(eventId);

  let existingItems = [];
  if (isEdit) existingItems = DB.proformaItems.getByProformaId(proforma.id);
  if (existingItems.length === 0) existingItems = [{ description: '', quantity: 1, unitPrice: 0 }];

  function generateInvoiceNo() {
    const year = new Date().getFullYear();
    const all = DB.proformas.getAll();
    return `PF-${year}-${String(all.length + 1).padStart(3, '0')}`;
  }

  const today = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const content = `
    <form id="proformaForm" class="proforma-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fatura No</label>
          <input class="form-input" type="text" name="invoiceNo" value="${data.invoiceNo || generateInvoiceNo()}">
        </div>
        <div class="form-group">
          <label class="form-label">KDV Oranı (%)</label>
          <input class="form-input" type="number" name="vatRate" id="pfVatRate" value="${data.vatRate != null ? data.vatRate : 20}" min="0" max="100">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Sponsor</label>
          <select class="form-select" name="sponsorId">
            <option value="">Sponsor seçin...</option>
            ${sponsors.map(s => `<option value="${s.id}" ${data.sponsorId === s.id ? 'selected' : ''}>${s.companyName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Düzenleme Tarihi</label>
          <input class="form-input" type="date" name="issueDate" value="${data.issueDate ? data.issueDate.split('T')[0] : today}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Vade Tarihi</label>
        <input class="form-input" type="date" name="dueDate" value="${data.dueDate ? data.dueDate.split('T')[0] : future}">
      </div>

      <div style="background: var(--success-light); border: 1px solid var(--success); border-radius: var(--radius-md); padding: 16px; margin-top: 24px;">
        <h4 style="margin: 0 0 12px 0; color: var(--success); font-size: 1rem;">Tahsilat (Ödeme) Bilgisi</h4>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="color: #065f46;">Şu Ana Kadar Alınan Ödeme (₺)</label>
          <input class="form-input" type="number" name="paymentReceived" value="${data.paymentReceived || 0}" step="0.01" style="border-color: #34d399; background: #fff;">
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin:1.5rem 0 0.75rem;">
        <h3 style="margin:0;font-size:1rem;">Fatura Kalemleri</h3>
        <button type="button" class="btn btn-sm btn-secondary" id="pfAddItemBtn">
          <i data-lucide="plus"></i> Kalem Ekle
        </button>
      </div>

      <table class="proforma-items-table">
        <thead>
          <tr>
            <th>Hizmet Açıklaması</th>
            <th style="width:100px;">Miktar</th>
            <th style="width:130px;">Birim Fiyat</th>
            <th style="width:130px;">Toplam</th>
            <th style="width:50px;"></th>
          </tr>
        </thead>
        <tbody id="pfItemsBody">
          ${existingItems.map(i => `
            <tr>
              <td><input class="form-input item-desc" type="text" value="${i.description || ''}"></td>
              <td><input class="form-input item-qty" type="number" value="${i.quantity || 1}" min="1"></td>
              <td><input class="form-input item-up" type="number" value="${i.unitPrice || 0}" min="0" step="0.01"></td>
              <td class="item-tot" style="text-align:right;font-weight:600;">${formatCurrency((i.quantity || 1) * (i.unitPrice || 0))}</td>
              <td><button type="button" class="btn btn-ghost btn-sm btn-icon rm-item" title="Sil"><i data-lucide="trash-2"></i></button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="proforma-totals">
        <div class="proforma-total-row"><span>Ara Toplam:</span><span id="pfSub">${formatCurrency(0)}</span></div>
        <div class="proforma-total-row"><span>KDV (<span id="pfVatLbl">${data.vatRate != null ? data.vatRate : 20}</span>%):</span><span id="pfVat">${formatCurrency(0)}</span></div>
        <div class="proforma-total-row grand-total"><span>Genel Toplam:</span><span id="pfTotal">${formatCurrency(0)}</span></div>
      </div>

      <div class="form-group" style="margin-top:1rem;">
        <label class="form-label">Notlar</label>
        <textarea class="form-textarea" name="notes" rows="2">${data.notes || ''}</textarea>
      </div>
    </form>
  `;

  openModal({
    title: isEdit ? 'Proforma Düzenle' : 'Yeni Proforma',
    content,
    width: '800px',
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    onSave: () => {
      const form = document.getElementById('proformaForm');
      const formData = new FormData(form);
      const values = Object.fromEntries(formData.entries());
      values.eventId = eventId;
      values.vatRate = Number(values.vatRate || 0);
      values.paymentReceived = Number(values.paymentReceived || 0);

      if (!values.invoiceNo?.trim()) { showToast('Fatura numarası zorunludur.', 'error'); return; }

      const rows = document.querySelectorAll('#pfItemsBody tr');
      const itemsData = [];
      rows.forEach(row => {
        const desc = row.querySelector('.item-desc')?.value || '';
        const qty = Number(row.querySelector('.item-qty')?.value || 0);
        const price = Number(row.querySelector('.item-up')?.value || 0);
        if (desc.trim() || qty > 0 || price > 0) itemsData.push({ description: desc, quantity: qty, unitPrice: price });
      });
      if (itemsData.length === 0) { showToast('En az bir kalem ekleyin.', 'error'); return; }

      let pid;
      if (isEdit) {
        DB.proformas.update(proforma.id, values);
        pid = proforma.id;
        DB.proformaItems.deleteByProformaId(pid);
      } else {
        pid = DB.proformas.create(values).id;
      }
      itemsData.forEach(i => DB.proformaItems.create({ ...i, proformaId: pid }));
      showToast(isEdit ? 'Proforma güncellendi.' : 'Proforma oluşturuldu.');
      closeModal();
      onDone();
    }
  });

  // Setup listeners
  const body = document.getElementById('pfItemsBody');
  const vatInput = document.getElementById('pfVatRate');

  function recalc() {
    let sub = 0;
    body.querySelectorAll('tr').forEach(row => {
      const q = Number(row.querySelector('.item-qty')?.value || 0);
      const p = Number(row.querySelector('.item-up')?.value || 0);
      sub += q * p;
      const tot = row.querySelector('.item-tot');
      if (tot) tot.textContent = formatCurrency(q * p);
    });
    const vr = Number(vatInput?.value || 0);
    const vatAmt = sub * vr / 100;
    document.getElementById('pfSub').textContent = formatCurrency(sub);
    document.getElementById('pfVat').textContent = formatCurrency(vatAmt);
    document.getElementById('pfTotal').textContent = formatCurrency(sub + vatAmt);
    const lbl = document.getElementById('pfVatLbl');
    if (lbl) lbl.textContent = vr;
  }

  body.addEventListener('input', recalc);
  if (vatInput) vatInput.addEventListener('input', recalc);

  body.addEventListener('click', e => {
    const btn = e.target.closest('.rm-item');
    if (btn) {
      if (body.querySelectorAll('tr').length > 1) { btn.closest('tr').remove(); recalc(); }
      else showToast('En az bir kalem gereklidir.', 'error');
    }
  });

  document.getElementById('pfAddItemBtn')?.addEventListener('click', () => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input class="form-input item-desc" type="text" value=""></td>
      <td><input class="form-input item-qty" type="number" value="1" min="1"></td>
      <td><input class="form-input item-up" type="number" value="0" min="0" step="0.01"></td>
      <td class="item-tot" style="text-align:right;font-weight:600;">${formatCurrency(0)}</td>
      <td><button type="button" class="btn btn-ghost btn-sm btn-icon rm-item" title="Sil"><i data-lucide="trash-2"></i></button></td>
    `;
    body.appendChild(row);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [row] });
  });

  recalc();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Main Render ──
export function renderEventDetail(container, eventId, activeTab) {
  activeTab = activeTab || 'participants';
  const event = DB.events.getById(eventId);

  if (!event) {
    container.innerHTML = `
      <div class="page-fade-in">
        <div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="alert-circle"></i></div>
          <h3 class="empty-state-title">Etkinlik bulunamadı</h3>
          <p class="empty-state-text">İstenen etkinlik mevcut değil veya silinmiş olabilir.</p>
          <button class="btn btn-primary" onclick="window.location.hash='#events'">Etkinliklere Dön</button>
        </div>
      </div>
    `;
    return;
  }

  const participants = DB.participants.getByEventId(eventId);
  const sponsors = DB.sponsors.getByEventId(eventId);
  const budgetItems = DB.budgetItems.getByEventId(eventId);
  const proformas = DB.proformas.getByEventId(eventId);

  const dateRange = event.endDate
    ? `${formatDate(event.startDate)} — ${formatDate(event.endDate)}`
    : formatDate(event.startDate);

    const tabs = [
    { key: 'participants', label: 'Katılımcılar', count: participants.length },
    { key: 'sponsors', label: 'Sponsorlar', count: sponsors.length },
    { key: 'budget', label: 'Bütçe', count: budgetItems.length },
    { key: 'proforma', label: 'Proformalar', count: proformas.length },
    { key: 'transfers', label: 'Lojistik', count: DB.transfers.getByEventId(eventId).length },
    { key: 'tasks', label: 'Görevler (Kanban)', count: DB.tasks.getByEventId(eventId).length },
    { key: 'communication', label: 'İletişim & Mail', count: 0 }
  ];

  container.innerHTML = `
    <div class="page-fade-in">
      <div class="event-header-card">
        <button class="btn btn-ghost" id="backBtn" style="margin-bottom: 1rem;">
          <i data-lucide="arrow-left"></i> Geri
        </button>
        <h1 style="font-size: 1.75rem; font-weight: 700; margin: 0 0 0.5rem;">${event.name}</h1>
        ${event.description ? `<p style="opacity:0.85;margin:0 0 1rem;">${event.description}</p>` : ''}
        <div class="event-meta">
          <div class="event-meta-item">
            <i data-lucide="calendar"></i>
            <span>${dateRange}</span>
          </div>
          <div class="event-meta-item">
            <i data-lucide="map-pin"></i>
            <span>${event.city || '-'}</span>
          </div>
          <div class="event-meta-item">
            <i data-lucide="building"></i>
            <span>${event.venue || '-'}</span>
          </div>
          <div class="event-meta-item">
            <i data-lucide="users"></i>
            <span>${participants.length}${event.capacity ? ' / ' + event.capacity : ''}</span>
          </div>
        </div>
      </div>

      <div class="tabs" id="eventTabs">
        ${tabs.map(t => `
          <button class="tab ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">
            ${t.label} <span class="badge badge-gray" style="margin-left:0.375rem;">${t.count}</span>
          </button>
        `).join('')}
      </div>

      <div class="card" id="tabContent" style="margin-top: 0;"></div>
    </div>
  `;

  // Back button
  document.getElementById('backBtn').addEventListener('click', () => {
    navigateTo('#events');
  });

  // Tab click handlers
  document.querySelectorAll('#eventTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      navigateTo(`#event/${eventId}/${tab.dataset.tab}`);
    });
  });

  // Render active tab
  const tabContent = document.getElementById('tabContent');
  const reRender = () => renderEventDetail(container, eventId, activeTab);

  switch (activeTab) {
    case 'participants':
      renderParticipantsTab(tabContent, eventId, reRender);
      break;
    case 'sponsors':
      renderSponsorsTab(tabContent, eventId, reRender);
      break;
    case 'budget':
      renderBudgetTab(tabContent, eventId, reRender);
      break;
    case 'proforma':
      renderProformaTab(tabContent, eventId, reRender);
      break;
    case 'transfers':
      renderTransfersModule(tabContent, eventId);
      break;
    case 'tasks':
      renderTasksModule(tabContent, eventId);
      break;
    case 'communication':
      renderCommunicationModule(tabContent, eventId);
      break;
    default:
      renderParticipantsTab(tabContent, eventId, reRender);
  }
}
