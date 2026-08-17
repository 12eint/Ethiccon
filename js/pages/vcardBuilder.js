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
        const workbook = XLSX.read(data, { type: 'binary' });
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

        // Enable mapping section
        mappingSection.style.opacity = '1';
        mappingSection.style.pointerEvents = 'auto';

      } catch (err) {
        console.error(err);
        alert('Dosya okunurken bir hata oluştu. SheetJS yüklü mü?');
      }
    };
    reader.readAsBinaryString(file);
  });

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

      let vcardContent = '';

      excelData.forEach(row => {
          const fn = row[mapFirstName] || '';
          const ln = row[mapLastName] || '';
          const phone = row[mapPhone] || '';
          const email = mapEmail ? (row[mapEmail] || '') : '';
          const company = mapCompany ? (row[mapCompany] || '') : '';
          const title = mapTitle ? (row[mapTitle] || '') : '';

          if (!fn && !ln) return; // Skip empty rows

          vcardContent += 'BEGIN:VCARD\\n';
          vcardContent += 'VERSION:3.0\\n';
          vcardContent += `N:${ln};${fn};;;\\n`;
          vcardContent += `FN:${fn} ${ln}\\n`;
          if (company) vcardContent += `ORG:${company}\\n`;
          if (title) vcardContent += `TITLE:${title}\\n`;
          if (phone) vcardContent += `TEL;TYPE=CELL:${phone}\\n`;
          if (email) vcardContent += `EMAIL;TYPE=PREF,INTERNET:${email}\\n`;
          vcardContent += 'END:VCARD\\n';
      });

      if (!vcardContent) {
          alert('Geçerli kayıt bulunamadı.');
          return;
      }

      // Download file
      const blob = new Blob([vcardContent], { type: 'text/vcard' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rehber.vcf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  });
}
