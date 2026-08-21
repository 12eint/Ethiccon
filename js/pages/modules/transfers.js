/**
 * Lojistik: araç ataması ve yolcu manifestosu.
 */
import { DB, distinctValues } from '../../core/store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatShortDate } from '../../core/format.js';
import { html, raw, showToast, refreshIcons, emptyState, initSearchableSelects, bindClick, suggestInput } from '../../core/ui.js';

const DIRECTIONS = {
  arrival: 'Havaalanı ➔ Otel (Karşılama)',
  departure: 'Otel ➔ Havaalanı (Uğurlama)',
};

export function renderTransfersModule(container, eventId, onChange) {
  const refresh = () => (onChange ? onChange() : renderTransfersModule(container, eventId));

  const transfers = DB.transfers.getByEventId(eventId);
  const participants = DB.participants.getByEventId(eventId);
  const byId = new Map(participants.map((pax) => [pax.id, pax]));

  container.innerHTML = html`
    <div class="page-header">
      <h2>Lojistik ve Transfer</h2>
      <button class="btn btn-primary btn-sm" data-action="add" ${participants.length === 0 ? raw('disabled') : ''}>
        <i data-lucide="plus"></i> Yeni Transfer
      </button>
    </div>

    ${participants.length === 0
      ? raw(emptyState({
          icon: 'users',
          title: 'Önce misafir kaydı gerekli',
          text: 'Transfer atayabilmek için Kayıt sekmesinden misafir ekleyin.',
        }))
      : transfers.length === 0
        ? raw(emptyState({
            icon: 'car',
            title: 'Planlanmış transfer bulunmuyor',
            text: 'Yukarıdaki butondan araç ve yolcu ataması yapın.',
          }))
        : raw(html`
          <div style="position:relative;margin-bottom:16px;">
            <i data-lucide="search" style="width:15px;height:15px;opacity:0.4;position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;"></i>
            <input type="text" id="transferSearch" class="form-input" placeholder="Araç, şoför veya güzergah ara..." style="padding-left:34px;height:36px;font-size:0.85rem;">
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr><th>Tarih / Saat</th><th>Güzergah</th><th>Araç & Şoför</th><th>Yolcu</th><th style="text-align:right;">İşlem</th></tr>
              </thead>
              <tbody id="transferRows">
                ${transfers.map((transfer) => raw(html`
                  <tr data-search="${`${transfer.vehicle ?? ''} ${transfer.driver ?? ''} ${DIRECTIONS[transfer.direction] ?? ''}`.toLowerCase()}">
                    <td>
                      <div style="font-weight:600;">${formatShortDate(transfer.date)}</div>
                      <div style="font-size:0.8rem;color:var(--slate-500);">${transfer.time || '-'}</div>
                    </td>
                    <td>
                      <div style="font-weight:600;">${DIRECTIONS[transfer.direction] ?? '-'}</div>
                      <div style="font-size:0.8rem;color:var(--slate-500);">${transfer.notes || '-'}</div>
                    </td>
                    <td>
                      <div style="font-weight:600;">${transfer.vehicle}</div>
                      <div style="font-size:0.8rem;color:var(--slate-500);">${transfer.driver || '-'} / ${transfer.driverPhone || '-'}</div>
                    </td>
                    <td><span class="badge badge-purple">${transfer.passengers?.length ?? 0} Yolcu</span></td>
                    <td style="text-align:right;">
                      <div class="action-btns" style="justify-content:flex-end;">
                        <button class="action-btn view" data-manifest="${transfer.id}" title="Manifesto"><i data-lucide="users"></i></button>
                        <button class="action-btn delete" data-delete="${transfer.id}" title="Sil"><i data-lucide="trash-2"></i></button>
                      </div>
                    </td>
                  </tr>
                `))}
              </tbody>
            </table>
          </div>
        `)}
  `;

  container.querySelector('#transferSearch')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    container.querySelectorAll('#transferRows tr[data-search]').forEach((row) => {
      row.style.display = !query || row.dataset.search.includes(query) ? '' : 'none';
    });
  });

  bindClick(container, (event) => {
    if (event.target.closest('[data-action="add"]')) {
      return openTransferModal({ eventId, participants, onDone: refresh });
    }

    const manifestId = event.target.closest('[data-manifest]')?.dataset.manifest;
    if (manifestId) return showManifest(DB.transfers.getById(manifestId), byId);

    const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
    if (!deleteId) return;
    if (!window.confirm('Transfer kaydını silmek istediğinize emin misiniz?')) return;
    DB.transfers.delete(deleteId);
    DB.logs.add('Bir transfer kaydı silindi.', 'warning');
    showToast('Transfer silindi.');
    refresh();
  });

  refreshIcons(container);
}

function openTransferModal({ eventId, participants, onDone }) {
  // Uçuşu olan misafirlerde uçuş bilgisini de gösteriyoruz; transfer
  // saatini uçuşa göre planlamak operasyonun en sık ihtiyacı.
  const flightsByPax = new Map(
    DB.flights.getByEventId(eventId).map((flight) => [flight.participantId, flight]),
  );

  openModal({
    title: 'Yeni Transfer Ata',
    width: '640px',
    content: html`
      <form id="transferForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tarih *</label>
            <input type="date" class="form-input" name="date" required>
          </div>
          <div class="form-group">
            <label class="form-label">Saat *</label>
            <input type="time" class="form-input" name="time" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Güzergah</label>
            <select class="form-select" name="direction">
              ${Object.entries(DIRECTIONS).map(([value, label]) => raw(html`
                <option value="${value}">${label}</option>
              `))}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Araç / Plaka *</label>
            ${raw(suggestInput({ name: 'vehicle', placeholder: 'Örn: 34 VIP 123 veya Minibüs',
              required: true, options: distinctValues(DB.transfers.getAll(), 'vehicle') }))}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Şoför Adı</label>
            ${raw(suggestInput({ name: 'driver', options: distinctValues(DB.transfers.getAll(), 'driver') }))}
          </div>
          <div class="form-group">
            <label class="form-label">Şoför Telefonu</label>
            <input type="text" class="form-input mask-phone" name="driverPhone" placeholder="05XX XXX XX XX">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Yolcular</label>
          <select class="form-select searchable-select" name="passengers" id="transferPassengers" multiple>
            ${participants.map((pax) => {
              const flight = flightsByPax.get(pax.id);
              const code = flight?.outbound?.domFlightCode || flight?.inbound?.domFlightCode;
              const suffix = code ? ` — ${code}` : '';
              return raw(html`<option value="${pax.id}">${pax.firstName} ${pax.lastName}${suffix}</option>`);
            })}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notlar</label>
          <textarea class="form-textarea" name="notes" rows="2" placeholder="Karşılama tabelası, uçuş rötar notu vb."></textarea>
        </div>
      </form>
    `,
    onSave: () => {
      const form = document.getElementById('transferForm');
      const values = Object.fromEntries(new FormData(form).entries());

      if (!values.date || !values.time || !values.vehicle.trim()) {
        showToast('Tarih, saat ve araç bilgisi zorunludur.', 'error');
        return;
      }

      const passengers = [...form.querySelector('#transferPassengers').selectedOptions].map((o) => o.value);

      DB.transfers.create({ ...values, eventId, passengers });
      DB.logs.add(`${values.vehicle} aracı için transfer oluşturuldu.`, 'success');
      closeModal();
      showToast('Transfer kaydedildi.');
      onDone();
    },
  });

  initSearchableSelects(document.getElementById('transferForm'));
}

function showManifest(transfer, participantsById) {
  if (!transfer) return;

  const passengers = (transfer.passengers ?? [])
    .map((id) => participantsById.get(id))
    .filter(Boolean);

  openModal({
    title: 'Transfer Manifestosu',
    width: '640px',
    content: html`
      <div style="background:var(--slate-50);padding:16px;border-radius:var(--radius-md);margin-bottom:24px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.9rem;">
          <div><strong>Araç:</strong> ${transfer.vehicle}</div>
          <div><strong>Güzergah:</strong> ${DIRECTIONS[transfer.direction] ?? '-'}</div>
          <div><strong>Tarih / Saat:</strong> ${formatShortDate(transfer.date)} ${transfer.time ?? ''}</div>
          <div><strong>Şoför:</strong> ${transfer.driver || '-'} (${transfer.driverPhone || '-'})</div>
        </div>
      </div>
      <h4 style="font-size:1rem;font-weight:600;margin-bottom:12px;">Yolcular (${passengers.length})</h4>
      ${passengers.length === 0
        ? raw('<p style="color:var(--slate-400);text-align:center;padding:16px;">Bu transfere yolcu atanmamış.</p>')
        : raw(html`
          <table class="data-table">
            <thead><tr><th>Misafir</th><th>Firma</th><th>Telefon</th></tr></thead>
            <tbody>
              ${passengers.map((pax) => raw(html`
                <tr>
                  <td style="font-weight:600;">${pax.firstName} ${pax.lastName}</td>
                  <td>${pax.company || '-'}</td>
                  <td>${pax.phone || '-'}</td>
                </tr>
              `))}
            </tbody>
          </table>
        `)}
    `,
  });
}
