/**
 * Uygulama girişi.
 * Yalnızca önyükleme ve uygulama geneli davranışlar burada; sayfa
 * yönlendirmesi core/router.js'te, veri core/store.js'te.
 */
import { initStore, DB } from './core/store.js';
import { requireAuth } from './core/auth.js';
import { startRouter, navigateTo, paths } from './core/router.js';
import { escapeHtml, refreshIcons } from './core/ui.js';

// ── Girdi maskeleri (olay delegasyonu) ───────────────────────────────────

const MASKS = {
  'mask-tc': (value) => value.replace(/\D/g, '').slice(0, 11),
  'mask-phone': (value) => {
    let digits = value.replace(/\D/g, '');
    if (digits && digits[0] !== '0') digits = '0' + digits;
    digits = digits.slice(0, 11);
    return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)]
      .filter(Boolean)
      .join(' ');
  },
};

document.addEventListener('input', (event) => {
  for (const [className, apply] of Object.entries(MASKS)) {
    if (event.target.classList?.contains(className)) {
      event.target.value = apply(event.target.value);
      return;
    }
  }
});

// ── Global arama (Ctrl/Cmd + K) ──────────────────────────────────────────

const overlay = document.getElementById('globalSearchOverlay');
const input = document.getElementById('globalSearchInput');
const resultsBox = document.getElementById('globalSearchResults');
const emptyBox = document.getElementById('globalSearchEmpty');

let results = [];

function isSearchOpen() {
  return overlay?.style.display === 'flex';
}

function toggleSearch(force) {
  if (!overlay) return;
  const shouldOpen = force ?? !isSearchOpen();

  if (shouldOpen) {
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      input?.focus();
    });
  } else {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 200);
    if (input) input.value = '';
    renderResults('');
  }
}

function search(query) {
  const found = [];

  DB.participants.getAll().forEach((pax) => {
    const haystack = `${pax.firstName ?? ''} ${pax.lastName ?? ''} ${pax.company ?? ''} ${pax.email ?? ''} ${pax.phone ?? ''}`.toLowerCase();
    if (!haystack.includes(query)) return;
    const event = DB.events.getById(pax.eventId);
    found.push({
      icon: 'user',
      title: `${pax.firstName ?? ''} ${pax.lastName ?? ''}`.trim(),
      subtitle: [pax.company || 'Bireysel', event?.name].filter(Boolean).join(' — '),
      hash: paths.org(pax.eventId, 'registration'),
    });
  });

  DB.events.getAll().forEach((event) => {
    const haystack = `${event.name ?? ''} ${event.city ?? ''}`.toLowerCase();
    if (!haystack.includes(query)) return;
    found.push({
      icon: 'calendar',
      title: event.name,
      subtitle: [event.startDate, event.city].filter(Boolean).join(' / '),
      hash: paths.org(event.id),
    });
  });

  return found.slice(0, 10);
}

function renderResults(query) {
  if (!resultsBox || !emptyBox) return;

  if (!query) {
    emptyBox.style.display = 'flex';
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
    results = [];
    return;
  }

  emptyBox.style.display = 'none';
  resultsBox.style.display = 'block';
  results = search(query);

  if (results.length === 0) {
    resultsBox.innerHTML = `<div style="padding:16px;text-align:center;color:var(--slate-500);">"${escapeHtml(query)}" için sonuç bulunamadı.</div>`;
    return;
  }

  resultsBox.innerHTML = results.map((item, index) => `
    <div class="search-result-item" data-index="${index}" style="padding:12px;border-radius:var(--radius-md);cursor:pointer;display:flex;align-items:center;gap:12px;transition:background 0.2s;">
      <div style="background:var(--slate-100);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--slate-600);">
        <i data-lucide="${item.icon}" style="width:18px;height:18px;"></i>
      </div>
      <div>
        <div style="font-weight:600;color:var(--slate-800);font-size:0.95rem;">${escapeHtml(item.title)}</div>
        <div style="font-size:0.75rem;color:var(--slate-500);">${escapeHtml(item.subtitle)}</div>
      </div>
    </div>
  `).join('');

  refreshIcons(resultsBox);
}

// Sonuç tıklamaları delegasyonla; her render'da yeniden bağlanmaya gerek yok.
resultsBox?.addEventListener('click', (event) => {
  const item = event.target.closest('.search-result-item');
  if (!item) return;
  const target = results[Number(item.dataset.index)];
  if (!target) return;
  toggleSearch(false);
  navigateTo(target.hash);
});

input?.addEventListener('input', (event) => renderResults(event.target.value.trim().toLowerCase()));
overlay?.addEventListener('click', (event) => {
  if (event.target === overlay) toggleSearch(false);
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    toggleSearch();
  } else if (event.key === 'Escape' && isSearchOpen()) {
    toggleSearch(false);
  }
});

// ── Önyükleme ────────────────────────────────────────────────────────────

initStore();
if (requireAuth()) {
  startRouter();
}
