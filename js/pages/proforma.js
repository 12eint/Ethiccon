/**
 * Proforma sayfası — organizasyon seçici + proforma modülü.
 */
import { renderEventPicker } from '../components/eventPicker.js';
import { renderProformaModule } from './modules/proforma.js';

export function renderProforma(container) {
  renderEventPicker(container, {
    title: 'Proforma Fatura',
    subtitle: 'Firma bazlı maliyetlendirme, tahsilat takibi ve PDF çıktısı',
    storageKey: 'proforma',
    render: (host, eventId, reload) => renderProformaModule(host, eventId, reload),
  });
}
