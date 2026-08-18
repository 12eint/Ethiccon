import { showToast, refreshIcons } from '../core/ui.js';

export function renderVcardBuilder(container) {
  let excelData = [];
  let headers = [];

  container.innerHTML = `
    <div class="page-fade-in">
      <div class="page-header">
        <h1>Rehber Oluşturucu (vCard)</h1>
        <p style="color: var(--slate-500); margin-top: 8px;">Excel tablonuzu yükleyin, sütunları eşleştirin ve toplu vCard dosyanızı oluşturun.</p>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">1. Excel Yükle</h3>
          </div>
          <div style="padding: 24px; text-align: center; border: 2px dashed var(--slate-200); border-radius: var(--radius-lg); margin-top: 16px; background: var(--slate-50);">
            <i data-lucide="file-spreadsheet" style="width: 48px; height: 48px; color: var(--success); margin-bottom: 16px;"></i>
            <h4 style="margin-bottom: 8px;">.xlsx veya .csv dosyası seçin</h4>
            <input type="file" id="excelFileInput" accept=".xlsx, .xls, .csv" style="display: none;">
            <button class="btn btn-primary" onclick="document.getElementById('excelFileInput').click()">Dosya Seç</button>
            <p id="fileNameDisplay" style="margin-top: 12px; font-size: 0.8rem; color: var(--slate-500);"></p>
          </div>
        </div>

        <div class="card" id="mappingSection" style="opacity: 0.5; pointer-events: none;">
          <div class="card-header">
            <h3 class="card-title">2. Sütun Eşleştirme</h3>
          </div>
          <div class="form-group" style="margin-top: 16px;">
            <label class="form-label">Ad (Zorunlu)</label>
            <select class="form-select mapping-select" id="mapFirstName">
              <option value="">Seçiniz...</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Soyad (Zorunlu)</label>
            <select class="form-select mapping-select" id="mapLastName">
              <option value="">Seçiniz...</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Telefon (Zorunlu)</label>
            <select class="form-select mapping-select" id="mapPhone">
              <option value="">Seçiniz...</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">E-posta</label>
            <select class="form-select mapping-select" id="mapEmail">
              <option value="">Seçiniz...</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Kurum / Firma</label>
            <select class="form-select mapping-select" id="mapCompany">
              <option value="">Seçiniz...</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Unvan</label>
            <select class="form-select mapping-select" id="mapTitle">
              <option value="">Seçiniz...</option>
            </select>
          </div>
          
          <button class="btn btn-success" id="generateVcardBtn" style="width: 100%; margin-top: 16px;">
            <i data-lucide="download"></i> vCard Oluştur ve İndir
          </button>
        </div>
      </div>
    </div>
  `;

  const fileInput = container.querySelector('#excelFileInput');
  const fileNameDisplay = container.querySelector('#fileNameDisplay');
  const mappingSection = container.querySelector('#mappingSection');
  const selects = container.querySelectorAll('.mapping-select');
  const generateBtn = container.querySelector('#generateVcardBtn');

  // Handle file selection
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = 'Yüklenen Dosya: ' + file.name;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      const data = evt.target.result;
      
      try {
        // Parse with SheetJS
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON (array of arrays to get headers easily)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
            alert('Dosyada yeterli veri bulunamadı.');
            return;
        }

        headers = jsonData[0];
        // Convert the rest to array of objects
        excelData = XLSX.utils.sheet_to_json(worksheet);

        // Populate selects
        const optionsHTML = '<option value="">Seçiniz...</option>' + headers.map(h => `<option value="${h}">${h}</option>`).join('');
        selects.forEach(select => {
            select.innerHTML = optionsHTML;
        });

        // Sütun adlarını otomatik tahmin et — çoğu dosyada elle seçim gerekmez.
        autoGuessMapping(headers);

        // Enable mapping section
        mappingSection.style.opacity = '1';
        mappingSection.style.pointerEvents = 'auto';
        showToast(`${excelData.length} satır okundu. Sütun eşleştirmesini kontrol edin.`);

      } catch (err) {
        console.error(err);
        alert('Dosya okunurken bir hata oluştu. Dosyanın .xlsx veya .csv olduğundan emin olun.');
      }
    };
    reader.readAsArrayBuffer(file);
  });

  /** Başlıklardan hangi sütunun hangi alana denk geldiğini tahmin eder. */
  function autoGuessMapping(columns) {
    const patterns = {
      mapFirstName: /^(ad|isim|first ?name|name)$/i,
      mapLastName: /^(soyad|soyisim|last ?name|surname)$/i,
      mapPhone: /(telefon|gsm|phone|cep|mobile)/i,
      mapEmail: /(e-?posta|e-?mail|mail)/i,
      mapCompany: /(firma|kurum|şirket|sirket|company|organization)/i,
      mapTitle: /(unvan|ünvan|title|görev|gorev)/i,
    };

    Object.entries(patterns).forEach(([selectId, pattern]) => {
      const match = columns.find((column) => pattern.test(String(column).trim()));
      if (match) container.querySelector(`#${selectId}`).value = match;
    });
  }

  // Handle Generate
  generateBtn.addEventListener('click', () => {
      const mapFirstName = container.querySelector('#mapFirstName').value;
      const mapLastName = container.querySelector('#mapLastName').value;
      const mapPhone = container.querySelector('#mapPhone').value;
      const mapEmail = container.querySelector('#mapEmail').value;
      const mapCompany = container.querySelector('#mapCompany').value;
      const mapTitle = container.querySelector('#mapTitle').value;

      if (!mapFirstName || !mapLastName || !mapPhone) {
          alert('Lütfen Ad, Soyad ve Telefon alanlarını eşleştirin.');
          return;
      }

      // vCard 3.0 satır sonu olarak CRLF ister (RFC 6350).
      // Önceki sürüm '\\n' yazdığı için dosyaya gerçek satır sonu yerine
      // düz metin "\n" giriyordu ve üretilen .vcf hiçbir yere aktarılamıyordu.
      const CRLF = '\r\n';
      // Ad, kurum gibi alanlarda geçen ; , \ karakterleri kaçışlanmalı.
      const esc = (value) => String(value).replace(/([\\;,])/g, '\\$1');

      const cards = [];

      excelData.forEach(row => {
          const fn = String(row[mapFirstName] ?? '').trim();
          const ln = String(row[mapLastName] ?? '').trim();
          const phone = String(row[mapPhone] ?? '').trim();
          const email = mapEmail ? String(row[mapEmail] ?? '').trim() : '';
          const company = mapCompany ? String(row[mapCompany] ?? '').trim() : '';
          const title = mapTitle ? String(row[mapTitle] ?? '').trim() : '';

          if (!fn && !ln) return; // Boş satırları atla

          const lines = [
              'BEGIN:VCARD',
              'VERSION:3.0',
              `N:${esc(ln)};${esc(fn)};;;`,
              `FN:${esc(`${fn} ${ln}`.trim())}`,
          ];
          if (company) lines.push(`ORG:${esc(company)}`);
          if (title) lines.push(`TITLE:${esc(title)}`);
          if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
          if (email) lines.push(`EMAIL;TYPE=PREF,INTERNET:${email}`);
          lines.push('END:VCARD');

          cards.push(lines.join(CRLF));
      });

      if (cards.length === 0) {
          alert('Geçerli kayıt bulunamadı.');
          return;
      }

      const vcardContent = cards.join(CRLF) + CRLF;

      // Türkçe karakterlerin doğru okunması için BOM'lu UTF-8.
      const blob = new Blob(['﻿', vcardContent], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rehber.vcf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`${cards.length} kişilik rehber dosyası indirildi.`);
  });
}
