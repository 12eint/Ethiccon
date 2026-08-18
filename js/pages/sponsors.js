/**
 * Sponsorlar sayfası — organizasyon seçici + sponsor modülü.
 */
import { renderEventPicker } from '../components/eventPicker.js';
import { renderSponsorsModule } from './modules/sponsors.js';

export function renderSponsors(container) {
  renderEventPicker(container, {
    title: 'Sponsor & Sergi Yönetimi',
    subtitle: 'Sponsorlukları, stand tahsislerini ve sözleşme tutarlarını yönetin',
    storageKey: 'sponsors',
    render: (host, eventId, reload) => renderSponsorsModule(host, eventId, reload),
  });
}
