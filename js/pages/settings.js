/**
 * Sistem ayarları: acente bilgileri, yetkiler ve yedekleme.
 */
import { DB, exportAll, importAll } from '../core/store.js';
import { html, raw, showToast, refreshIcons } from '../core/ui.js';
import { PERMISSIONS, BASE_STAFF_PERMISSIONS, isAdmin } from '../core/auth.js';

const MAX_LOGO_BYTES = 1024 * 1024;

export function renderSettings(container) {
  if (!isAdmin()) {
    container.innerHTML = '<div class="card" style="padding:48px;text-align:center;color:var(--danger);">Bu sayfayı görüntüleme yetkiniz yok.</div>';
    return;
  }

  const settings = DB.settings.get();
  const staff = DB.users.getAll().find((user) => user.role === 'staff');
  const staffPermissions = staff?.permissions ?? [];

  container.innerHTML = html`
    <div class="page-header" style="margin-bottom:24px;">
      <div>
        <h1>Sistem Ayarları</h1>
        <p style="color:var(--slate-500);font-size:0.875rem;margin-top:4px;">
          Acente bilgileri, kullanıcı yetkileri ve veri yedekleme
        </p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px;align-items:start;">
      <div class="card" style="padding:24px;">
        <h3 class="settings-card-title"><i data-lucide="building"></i> Acente Bilgileri</h3>
        <div class="form-group">
          <label class="form-label">Acente Ünvanı</label>
          <input type="text" id="agencyName" class="form-input" value="${settings.agencyName}" placeholder="Örn: X Turizm Seyahat Acentesi">
        </div>
        <div class="form-group">
          <label class="form-label">Fatura Adresi</label>
          <textarea id="agencyAddress" class="form-textarea" rows="2">${settings.agencyAddress}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">IBAN Bilgileri (proformada görünür)</label>
          <textarea id="agencyIban" class="form-textarea" rows="3">${settings.agencyIban}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Acente Logosu</label>
          <div style="display:flex;gap:12px;align-items:center;">
            <div id="logoPreview" style="width:80px;height:80px;border:1px dashed var(--slate-300);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--slate-50);">
              ${settings.agencyLogo
                ? raw(`<img src="${settings.agencyLogo}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;">`)
                : raw('<i data-lucide="image" style="color:var(--slate-300);"></i>')}
            </div>
            <div style="flex:1;">
              <input type="file" id="logoUpload" accept="image/png,image/jpeg" hidden>
              <button class="btn btn-secondary btn-sm" id="btnPickLogo"><i data-lucide="upload"></i> Logo Seç</button>
              <p style="font-size:0.75rem;color:var(--slate-400);margin-top:8px;">Yatay, şeffaf arka planlı PNG/JPG. En fazla 1 MB.</p>
            </div>
          </div>
          <input type="hidden" id="agencyLogo" value="${settings.agencyLogo}">
        </div>
        <div style="text-align:right;margin-top:16px;">
          <button class="btn btn-primary" id="btnSaveSettings"><i data-lucide="save"></i> Ayarları Kaydet</button>
        </div>
      </div>

      <div class="card" style="padding:24px;">
        <h3 class="settings-card-title" style="color:var(--primary-700);"><i data-lucide="shield"></i> Rol ve Yetki Yönetimi</h3>
        ${staff ? raw(html`
          <p style="font-size:0.85rem;color:var(--slate-600);margin-bottom:16px;">
            "${staff.name}" hesabının erişebileceği sayfa ve işlemleri belirleyin.
            Katılımcı görüntüleme ve ekleme her zaman açıktır.
          </p>
          <div style="display:flex;flex-direction:column;gap:12px;background:var(--slate-50);padding:16px;border-radius:var(--radius-md);border:1px solid var(--slate-200);">
            ${PERMISSIONS.map((permission) => raw(html`
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.9rem;">
                <input type="checkbox" class="perm-checkbox" value="${permission.id}"
                  ${staffPermissions.includes(permission.id) ? raw('checked') : ''}
                  style="width:16px;height:16px;accent-color:var(--primary-600);">
                ${permission.label}
              </label>
            `))}
          </div>
          <div style="text-align:right;margin-top:16px;">
            <button class="btn btn-primary" id="btnSaveRoles"><i data-lucide="save"></i> Yetkileri Güncelle</button>
          </div>
        `) : raw('<p style="color:var(--slate-500);">Personel rolünde kullanıcı bulunamadı.</p>')}

        <div style="margin-top:24px;padding-top:16px;border-top:1px dashed var(--slate-200);font-size:0.8rem;color:var(--warning);display:flex;gap:8px;">
          <i data-lucide="alert-triangle" style="width:16px;flex-shrink:0;"></i>
          <span>Bu yetkiler yalnızca arayüzü şekillendirir. Veri tarayıcıda tutulduğu için teknik bilgisi olan bir kullanıcı bunları aşabilir; gerçek koruma için sunucu tarafı gereklidir.</span>
        </div>
      </div>

      <div class="card" style="padding:24px;border:1px solid var(--info-light);">
        <h3 class="settings-card-title" style="color:var(--info);"><i data-lucide="database"></i> Veri Yedekleme</h3>
        <p style="font-size:0.85rem;color:var(--slate-600);margin-bottom:24px;">
          Tüm veriler yalnızca bu tarayıcıda saklanır. Tarayıcı verisi temizlenirse geri alınamaz;
          düzenli olarak yedek indirin.
        </p>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <button class="btn btn-primary" id="btnExportDb" style="justify-content:center;background:var(--success);box-shadow:none;">
            <i data-lucide="download"></i> Tüm Sistemi İndir (.json)
          </button>
          <div style="padding-top:20px;border-top:1px dashed var(--slate-200);">
            <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:8px;">Yedekten Geri Yükle</h4>
            <p style="font-size:0.8rem;color:var(--danger);margin-bottom:12px;">
              <strong>Dikkat:</strong> Mevcut tüm veriler silinir ve dosyadaki verilerle değiştirilir.
            </p>
            <input type="file" id="importUpload" accept=".json" hidden>
            <button class="btn btn-secondary" id="btnPickImport" style="width:100%;justify-content:center;color:var(--danger);border-color:var(--danger-light);">
              <i data-lucide="upload-cloud"></i> Yedekten Yükle
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  wireSettings(container, staff);
  refreshIcons(container);
}

function wireSettings(container, staff) {
  const logoUpload = container.querySelector('#logoUpload');
  const logoField = container.querySelector('#agencyLogo');

  container.querySelector('#btnPickLogo').addEventListener('click', () => logoUpload.click());

  logoUpload.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      showToast("Logo boyutu 1 MB'den küçük olmalıdır.", 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target.result;
      logoField.value = dataUrl;
      const preview = container.querySelector('#logoPreview');
      preview.innerHTML = `<img src="${dataUrl}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;">`;
    };
    reader.readAsDataURL(file);
  });

  container.querySelector('#btnSaveSettings').addEventListener('click', () => {
    DB.settings.save({
      agencyName: container.querySelector('#agencyName').value.trim(),
      agencyAddress: container.querySelector('#agencyAddress').value.trim(),
      agencyIban: container.querySelector('#agencyIban').value.trim(),
      agencyLogo: logoField.value,
    });
    showToast('Ayarlar kaydedildi.');
  });

  container.querySelector('#btnSaveRoles')?.addEventListener('click', () => {
    if (!staff) return;
    const selected = [...container.querySelectorAll('.perm-checkbox:checked')].map((cb) => cb.value);
    DB.users.update(staff.id, { permissions: [...BASE_STAFF_PERMISSIONS, ...selected] });
    DB.logs.add(`${staff.name} yetkileri güncellendi.`, 'warning');
    showToast('Yetkiler güncellendi.');
  });

  container.querySelector('#btnExportDb').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ethiccon_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Yedek indirildi.');
  });

  const importUpload = container.querySelector('#importUpload');
  container.querySelector('#btnPickImport').addEventListener('click', () => importUpload.click());

  importUpload.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Mevcut TÜM veriler silinecek ve seçtiğiniz dosyadaki verilerle değiştirilecek. Emin misiniz?')) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target.result);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Beklenen biçimde değil');
        }
        importAll(parsed);
        window.alert('Veriler yüklendi. Sistem yeniden başlatılıyor.');
        window.location.reload();
      } catch (error) {
        console.error('[settings] Yedek yüklenemedi:', error);
        showToast('Geçersiz veya bozuk yedek dosyası.', 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  });
}
