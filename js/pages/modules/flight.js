/**
 * Uçuş bileti yönetimi.
 * Bilet başına alış/satış tutulur; aradaki marj bütçeye gelir olarak yansır.
 */
import { DB, distinctValues } from '../../core/store.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatAmount } from '../../core/format.js';
import { html, raw, showToast, refreshIcons, emptyState, bindClick, suggestInput } from '../../core/ui.js';
import { isAdmin } from '../../core/auth.js';
import { flightProfit } from '../../core/pricing.js';

const dash = (value) => value || '-';
const timeRange = (from, to) => (from || to ? `${dash(from)} – ${dash(to)}` : '-');

export function renderFlightModule(container, eventId, onChange) {
  const refresh = () => (onChange ? onChange() : renderFlightModule(container, eventId));

  const admin = isAdmin();
  const flights = DB.flights.getByEventId(eventId);
  const participants = DB.participants.getByEventId(eventId);
  const totalProfit = flightProfit(eventId);

  container.innerHTML = html`
    <div class="page-header">
      <h2>Uçuş Bilet Yönetimi</h2>
      <button class="btn btn-primary btn-sm" data-action="add" ${participants.length === 0 ? raw('disabled') : ''}>
        <i data-lucide="plus"></i> Bilet Tanımla
      </button>
    </div>

    ${participants.length === 0
      ? raw(emptyState({
          icon: 'users',
          title: 'Önce misafir kaydı gerekli',
          text: 'Uçak bileti tanımlayabilmek için Kayıt sekmesinden misafir ekleyin.',
        }))
      : flights.length === 0
        ? raw(emptyState({
            icon: 'plane',
            title: 'Uçuş kaydı bulunmuyor',
            text: 'Yukarıdaki butondan misafirlere bilet tanımlayın.',
          }))
        : raw(html`
          <div class="table-container">
            <div style="overflow-x:auto;">
              <table class="data-table" style="font-size:0.78rem;white-space:nowrap;">
                <thead>
                  <tr>
                    <th colspan="${admin ? 4 : 3}" style="background:var(--slate-100);text-align:center;border-right:1px solid var(--slate-300);">Misafir & Finans</th>
                    <th colspan="4" style="background:var(--primary-50);text-align:center;border-right:1px solid var(--slate-300);">Gidiş</th>
                    <th colspan="3" style="background:var(--warning-light);text-align:center;">Dönüş</th>
                    <th rowspan="2" style="text-align:right;">İşlem</th>
                  </tr>
                  <tr>
                    <th>Misafir</th><th>Tedarikçi</th>
                    <th ${admin ? '' : raw('style="border-right:1px solid var(--slate-300);"')}>Havayolu</th>
                    ${admin ? raw('<th style="border-right:1px solid var(--slate-300);">Alış / Satış</th>') : ''}
                    <th>Kalkış</th><th>Varış</th><th>Tarih</th>
                    <th style="border-right:1px solid var(--slate-300);">Uçuş / Saat</th>
                    <th>Tarih</th><th>Uçuş</th><th>Saat</th>
                  </tr>
                </thead>
                <tbody>
                  ${flights.map((flight) => {
                    const pax = DB.participants.getById(flight.participantId);
                    const out = flight.outbound ?? {};
                    const back = flight.inbound ?? {};
                    const margin = (Number(flight.sellPrice) || 0) - (Number(flight.buyPrice) || 0);
                    return raw(html`
                      <tr>
                        <td><strong>${pax ? `${pax.firstName} ${pax.lastName}` : 'Silinmiş misafir'}</strong></td>
                        <td>${dash(flight.supplier)}</td>
                        <td ${admin ? '' : raw('style="border-right:1px solid var(--slate-200);"')}>${dash(flight.airline)}</td>
                        ${admin ? raw(html`
                          <td style="border-right:1px solid var(--slate-200);">
                            <div style="color:var(--danger);">A: ${formatAmount(flight.buyPrice)}</div>
                            <div style="color:var(--success);">S: ${formatAmount(flight.sellPrice)}</div>
                            <div style="font-weight:700;color:${margin >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatAmount(margin)}</div>
                          </td>
                        `) : ''}
                        <td>${dash(out.depCity)}</td>
                        <td>${dash(out.arrCity)}</td>
                        <td>${dash(out.arrDate)}</td>
                        <td style="border-right:1px solid var(--slate-200);">
                          <div>${dash(out.domFlightCode)}</div>
                          <div style="color:var(--slate-500);">${timeRange(out.depTime, out.arrTime)}</div>
                        </td>
                        <td>${dash(back.domDepDate || back.depDate)}</td>
                        <td>${dash(back.domFlightCode)}</td>
                        <td style="color:var(--slate-500);">${timeRange(back.domDepTime, back.domArrTime)}</td>
                        <td style="text-align:right;">
                          <div class="action-btns" style="justify-content:flex-end;">
                            <button class="action-btn edit" data-edit="${flight.id}" title="Düzenle"><i data-lucide="pencil"></i></button>
                            <button class="action-btn delete" data-delete="${flight.id}" title="Sil"><i data-lucide="trash-2"></i></button>
                          </div>
                        </td>
                      </tr>
                    `);
                  })}
                </tbody>
                ${admin ? raw(html`
                  <tfoot>
                    <tr style="background:var(--slate-50);">
                      <td colspan="11" style="text-align:right;font-weight:700;">Toplam Uçak Bileti Marjı</td>
                      <td style="text-align:right;font-weight:800;color:${totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${formatAmount(totalProfit)}
                      </td>
                    </tr>
                  </tfoot>
                `) : ''}
              </table>
            </div>
          </div>
        `)}
  `;

  bindClick(container, (event) => {
    if (event.target.closest('[data-action="add"]')) {
      return openFlightModal({ eventId, participants, flight: null, onDone: refresh });
    }

    const editId = event.target.closest('[data-edit]')?.dataset.edit;
    if (editId) {
      return openFlightModal({
        eventId,
        participants,
        flight: DB.flights.getById(editId),
        onDone: refresh,
      });
    }

    const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
    if (!deleteId) return;
    if (!window.confirm('Bu uçuş kaydını silmek istediğinize emin misiniz?')) return;
    DB.flights.delete(deleteId);
    showToast('Uçuş kaydı silindi.');
    refresh();
  });

  refreshIcons(container);
}

/**
 * Bilet ekleme/düzenleme formu.
 * Önceki sürümde düzenleme butonu yalnızca "yapım aşamasında" uyarısı veriyordu.
 */
function openFlightModal({ eventId, participants, flight, onDone }) {
  const isEdit = Boolean(flight);
  const data = flight ?? {};
  const out = data.outbound ?? {};
  const back = data.inbound ?? {};

  openModal({
    title: isEdit ? 'Uçuş Biletini Düzenle' : 'Misafire Uçak Bileti Tanımla',
    width: '820px',
    saveText: isEdit ? 'Güncelle' : 'Kaydet',
    content: html`
      <form id="flightForm">
        <div class="form-group">
          <label class="form-label">Misafir *</label>
          <select class="form-select searchable-select" name="participantId" required>
            <option value="">Seçiniz...</option>
            ${participants.map((pax) => raw(html`
              <option value="${pax.id}" ${data.participantId === pax.id ? raw('selected') : ''}>
                ${pax.firstName} ${pax.lastName} (${pax.company || 'Bireysel'})
              </option>
            `))}
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tedarikçi</label>
            ${raw(suggestInput({ name: 'supplier', value: data.supplier,
              options: distinctValues(DB.flights.getAll(), 'supplier') }))}
          </div>
          <div class="form-group">
            <label class="form-label">Havayolu</label>
            ${raw(suggestInput({ name: 'airline', value: data.airline,
              options: distinctValues(DB.flights.getAll(), 'airline') }))}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Alış Fiyatı (₺)</label>
            <input type="number" class="form-input" name="buyPrice" value="${data.buyPrice ?? 0}" min="0" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">Satış Fiyatı (₺)</label>
            <input type="number" class="form-input" name="sellPrice" value="${data.sellPrice ?? 0}" min="0" step="0.01">
          </div>
        </div>

        <h4 style="margin:20px 0 8px;border-bottom:1px solid var(--slate-200);padding-bottom:8px;">Gidiş</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kalkış Şehri</label>
            <input type="text" class="form-input" name="out_depCity" value="${out.depCity ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Varış Şehri</label>
            <input type="text" class="form-input" name="out_arrCity" value="${out.arrCity ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Tarih</label>
            <input type="date" class="form-input" name="out_arrDate" value="${out.arrDate ?? ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Uçuş Kodu</label>
            <input type="text" class="form-input" name="out_domFlightCode" value="${out.domFlightCode ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Kalkış Saati</label>
            <input type="time" class="form-input" name="out_depTime" value="${out.depTime ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Varış Saati</label>
            <input type="time" class="form-input" name="out_arrTime" value="${out.arrTime ?? ''}">
          </div>
        </div>

        <h4 style="margin:20px 0 8px;border-bottom:1px solid var(--slate-200);padding-bottom:8px;">Dönüş</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tarih</label>
            <input type="date" class="form-input" name="in_domDepDate" value="${back.domDepDate ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Uçuş Kodu</label>
            <input type="text" class="form-input" name="in_domFlightCode" value="${back.domFlightCode ?? ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kalkış Saati</label>
            <input type="time" class="form-input" name="in_domDepTime" value="${back.domDepTime ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Varış Saati</label>
            <input type="time" class="form-input" name="in_domArrTime" value="${back.domArrTime ?? ''}">
          </div>
        </div>
      </form>
    `,
    onSave: () => {
      const form = document.getElementById('flightForm');
      const values = Object.fromEntries(new FormData(form).entries());

      if (!values.participantId) {
        showToast('Lütfen bir misafir seçin.', 'error');
        return;
      }

      // out_* / in_* ön ekli alanları iç içe nesnelere ayırıyoruz.
      const group = (prefix) => Object.fromEntries(
        Object.entries(values)
          .filter(([key]) => key.startsWith(`${prefix}_`))
          .map(([key, value]) => [key.slice(prefix.length + 1), value]),
      );

      const payload = {
        eventId,
        participantId: values.participantId,
        supplier: values.supplier,
        airline: values.airline,
        buyPrice: Number(values.buyPrice) || 0,
        sellPrice: Number(values.sellPrice) || 0,
        outbound: group('out'),
        inbound: group('in'),
      };

      if (isEdit) {
        DB.flights.update(flight.id, payload);
        showToast('Uçuş kaydı güncellendi.');
      } else {
        DB.flights.create(payload);
        const pax = DB.participants.getById(values.participantId);
        DB.logs.add(`Uçak bileti tanımlandı: ${pax?.firstName ?? ''} ${pax?.lastName ?? ''}`.trim(), 'success');
        showToast('Uçuş kaydı eklendi.');
      }

      closeModal();
      onDone();
    },
  });
}
