/**
 * Bütçe sayfası — organizasyon seçici + finansal kokpit.
 * Kokpitin kendisi modules/budget.js'te; #org/:id/budget sekmesi de
 * aynı modülü kullanır, böylece iki ekran aynı hesabı gösterir.
 */
import { renderEventPicker } from '../components/eventPicker.js';
import { renderBudgetModule } from './modules/budget.js';
import { isAdmin } from '../core/auth.js';

export function renderBudget(container) {
  renderEventPicker(container, {
    title: isAdmin() ? 'Finansal Kokpit' : 'Saha Cüzdanı',
    subtitle: isAdmin()
      ? 'Bütçe, gelir-gider ve kâr durumu'
      : 'Saha operasyon harcamaları ve limit takibi',
    storageKey: 'budget',
    render: (host, eventId, reload) => renderBudgetModule(host, eventId, reload),
  });
}
