/**
 * Firma veritabanı — kayıt, konaklama ve proformada kullanılan firmalar.
 */
import { DB } from '../core/store.js';
import { createTable } from '../components/table.js';
import { openModal, closeModal } from '../components/modal.js';
import { html, showToast, refreshIcons, emptyState, escapeHtml } from '../core/ui.js';

export function renderCompaniesPage(container) {
  const companies = DB.companies.getAll();
  const reload = () => renderCompaniesPage(container);

  container.innerHTML = html`
    <div class="page-header">
      <div>
        <h1>Firma Listesi</h1>
        <p style="color:var(--slate-500);font-size:0.875rem;margin-top:4px;">
          Kayıt, konaklama ve fatura işlemlerinde kullanılacak firmalar
        </p>
      </div>
      <div style="display:flex;gap:12px;">
        <button class="btn btn-secondary" id="btnExport"><i data-lucide="download"></i> Excel İndir</button>
        <button class="btn btn-primary" id="btnAdd"><i data-lucide="plus"></i> Yeni Firma</button>
      </div>
    </div>
    <div class="card"><div id="companiesTable"></div></div>
  `;

  container.querySelector('#btnAdd').addEventListener('click', () => openCompanyModal(null, reload));
  container.querySelector('#btnExport').addEventListener('click', () => exportCompanies(companies));

  const host = container.querySelector('#companiesTable');

  if (companies.length === 0) {
    host.innerHTML = emptyState({
      icon: 'building-2',
      title: 'Kayıtlı firma bulunmuyor',
      text: 'Yeni firma eklemek için yukarıdaki butonu kullanın.',
    });
    refreshIcons(container);
    return;
  }

  createTable(host, {
    data: companies,
    searchable: true,
    searchPlaceholder: 'Firma ara...',
    pageSize: 15,
    columns: [
      { key: 'name', label: 'Kısa Adı', render: (value) => `<strong>${escapeHtml(value)}</strong>` },
      { key: 'commercialTitle', label: 'Ticari Ünvan', render: (value) => escapeHtml(value) || '-' },
      {
        key: 'taxNumber',
        label: 'Vergi Dairesi / No',
        render: (_value, row) =>
          `<div style="font-size:0.78rem;"><div>VD: ${escapeHtml(row.taxOffice) || '-'}</div><div style="color:var(--slate-500);">VN: ${escapeHtml(row.taxNumber) || '-'}</div></div>`,
      },
      {
        key: 'contactName',
        label: 'İletişim',
        render: (_value, row) =>
          `<div style="font-size:0.78rem;"><div>${escapeHtml(row.contactName) || '-'}</div><div style="color:var(--slate-500);">${escapeHtml(row.contactPhone) || '-'}</div></div>`,
      },
    ],
    actions: [
      {
        icon: 'pencil',
        className: 'edit',
        title: 'Düzenle',
        onClick: (row) => openCompanyModal(DB.companies.getById(row.id), reload),
      },
      {
        icon: 'trash-2',
        className: 'delete',
        title: 'Sil',
        onClick: (row) => {
          // Firma adı katılımcı kayıtlarında metin olarak tutulduğu için uyarıyoruz.
          const linked = DB.participants.getAll().filter((pax) => pax.company === row.name).length;
          const message = linked > 0
            ? `"${row.name}" siliniyor. ${linked} misafir kaydında bu firma adı yazılı kalacak. Devam edilsin mi?`
            : `"${row.name}" silinsin mi?`;
          if (!window.confirm(message)) return;
          DB.companies.delete(row.id);
          showToast('Firma silindi.');
          reload();
        },
      },
    ],
  });

  refreshIcons(container);
}

function exportCompanies(companies) {
  if (companies.length === 0) {
    showToast('Dışa aktarılacak firma bulunamadı.', 'error');
    return;
  }

  const rows = companies.map((company) => ({
    'Kısa Ad': company.name ?? '',
    'Ticari Ünvan': company.commercialTitle ?? '',
    'Vergi Dairesi': company.taxOffice ?? '',
    'Vergi No': company.taxNumber ?? '',
    'Adres': company.address ?? '',
    'Yetkili': company.contactName ?? '',
    'Telefon': company.contactPhone ?? '',
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Firmalar');
  XLSX.writeFile(workbook, 'firmalar.xlsx');
  showToast(`${companies.length} firma dışa aktarıldı.`);
}

function openCompanyModal(company, onDone) {
  const isEdit = Boolean(company);
  const data = company ?? {};

  openModal({
    title: isEdit ? 'Firmayı Düzenle' : 'Yeni Firma',
    width: '640px',
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    content: html`
      <form id="companyForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kısa Adı *</label>
            <input type="text" class="form-input" name="name" value="${data.name ?? ''}" placeholder="Örn: Novartis" required>
          </div>
          <div class="form-group">
            <label class="form-label">Ticari Ünvan</label>
            <input type="text" class="form-input" name="commercialTitle" value="${data.commercialTitle ?? ''}" placeholder="Resmi fatura ünvanı">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Vergi Dairesi</label>
            <input type="text" class="form-input" name="taxOffice" value="${data.taxOffice ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Vergi Numarası</label>
            <input type="text" class="form-input" name="taxNumber" value="${data.taxNumber ?? ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Yetkili Kişi</label>
            <input type="text" class="form-input" name="contactName" value="${data.contactName ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">İletişim Telefonu</label>
            <input type="text" class="form-input mask-phone" name="contactPhone" value="${data.contactPhone ?? ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Adres</label>
          <textarea class="form-textarea" name="address" rows="3">${data.address ?? ''}</textarea>
        </div>
      </form>
    `,
    onSave: () => {
      const form = document.getElementById('companyForm');
      const values = Object.fromEntries(new FormData(form).entries());

      if (!values.name.trim()) {
        showToast('Firma kısa adı zorunludur.', 'error');
        return;
      }

      // Aynı isimde ikinci firma, kayıt eşleşmelerini bozar.
      const duplicate = DB.companies.getAll().find(
        (c) => c.name.trim().toLowerCase() === values.name.trim().toLowerCase() && c.id !== data.id,
      );
      if (duplicate) {
        showToast('Bu adla kayıtlı bir firma zaten var.', 'error');
        return;
      }

      if (isEdit) DB.companies.update(company.id, values);
      else DB.companies.create(values);

      closeModal();
      showToast(isEdit ? 'Firma güncellendi.' : 'Firma eklendi.');
      onDone();
    },
  });
}
