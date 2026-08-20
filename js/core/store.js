/**
 * Veri katmanı.
 *
 * Tüm okuma/yazma buradan geçer; localStorage yalnızca bu dosyada geçer.
 * Backend'e taşınırken değişmesi gereken tek yer read()/write() ikilisidir.
 *
 * Önceki db.js'te her koleksiyon aynı beş metodu elle tekrarlıyordu;
 * burada createCollection fabrikası üretiyor.
 */

const PREFIX = 'ethiccon_';

function read(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFIX + key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn(`[store] "${key}" okunamadı, boş liste dönülüyor.`);
    return [];
  }
}

function write(key, rows) {
  localStorage.setItem(PREFIX + key, JSON.stringify(rows));
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Standart CRUD koleksiyonu üretir.
 * @param {string} key - PREFIX'siz localStorage anahtarı
 * @param {{ onDelete?: (row: object) => void }} [hooks]
 */
function createCollection(key, hooks = {}) {
  return {
    key,
    getAll: () => read(key),
    getById: (id) => read(key).find((row) => row.id === id) ?? null,
    getByEventId: (eventId) => read(key).filter((row) => row.eventId === eventId),

    create(data) {
      const rows = read(key);
      const row = { ...data, id: newId(), createdAt: new Date().toISOString() };
      rows.push(row);
      write(key, rows);
      return row;
    },

    update(id, patch) {
      const rows = read(key);
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) return null;
      rows[index] = { ...rows[index], ...patch, updatedAt: new Date().toISOString() };
      write(key, rows);
      return rows[index];
    },

    delete(id) {
      const rows = read(key);
      const row = rows.find((r) => r.id === id);
      if (!row) return false;
      write(key, rows.filter((r) => r.id !== id));
      hooks.onDelete?.(row);
      return true;
    },

    /** Toplu silme; kaç kayıt silindiğini döner. */
    deleteWhere(predicate) {
      const rows = read(key);
      const kept = rows.filter((row) => !predicate(row));
      write(key, kept);
      return rows.length - kept.length;
    },
  };
}

// ── Koleksiyonlar ────────────────────────────────────────────────────────

const participants = createCollection('participants', {
  // Misafir silinince ona bağlı uçuş kaydı da gitmeli.
  onDelete: (row) => flights.deleteWhere((f) => f.participantId === row.id),
});

const flights = createCollection('flights');
const accommodationsBase = createCollection('accommodations');
const transfers = createCollection('transfers');
const tasks = createCollection('tasks');
const companies = createCollection('companies');
const proformasBase = createCollection('proformas');
const proformaItemsBase = createCollection('proformaItems');
const sponsorsBase = createCollection('sponsors');

/**
 * Tek bütçe koleksiyonu.
 * Eskiden budgetItems (basit) ve budgets (onay akışlı) diye iki ayrı tablo
 * vardı; ekranlar farklı tabloyu okuduğu için rakamlar hiç tutmuyordu.
 * Artık yalnızca bu var, migrateBudgets() eskiyi buraya taşıyor.
 */
const budgets = createCollection('budgets');

const proformaItems = {
  ...proformaItemsBase,
  getByProformaId: (proformaId) => proformaItemsBase.getAll().filter((i) => i.proformaId === proformaId),
  deleteByProformaId: (proformaId) => proformaItemsBase.deleteWhere((i) => i.proformaId === proformaId),
};

const proformas = {
  ...proformasBase,
  delete(id) {
    proformaItems.deleteByProformaId(id);
    return proformasBase.delete(id);
  },
};

const sponsors = {
  ...sponsorsBase,
  /**
   * Sponsor eklenirken bütçeye otomatik gelir işleniyor; silinirken de
   * geri alınmalı. Eskiden kalıyordu ve muhasebe tutmuyordu.
   */
  delete(id) {
    budgets.deleteWhere((b) => b.sourceType === 'sponsor' && b.sourceId === id);
    return sponsorsBase.delete(id);
  },
};

const accommodations = {
  ...accommodationsBase,
  /** Etkinlik başına tek kayıt tutulur. */
  getByEventId: (eventId) => accommodationsBase.getAll().find((a) => a.eventId === eventId) ?? null,
  createOrUpdate(eventId, data) {
    const existing = accommodationsBase.getAll().find((a) => a.eventId === eventId);
    if (existing) return accommodationsBase.update(existing.id, data);
    return accommodationsBase.create({ ...data, eventId });
  },
};

const eventsBase = createCollection('events');

const events = {
  ...eventsBase,
  /** Etkinlik silinince ona bağlı her şey gider. */
  delete(id) {
    const proformaIds = proformas.getByEventId(id).map((p) => p.id);
    proformaIds.forEach((pid) => proformaItems.deleteByProformaId(pid));

    [participants, flights, accommodationsBase, transfers,
     tasks, sponsorsBase, budgets, proformasBase]
      .forEach((collection) => collection.deleteWhere((row) => row.eventId === id));

    return eventsBase.delete(id);
  },
};

// ── Tekil kayıtlar ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS = { agencyName: '', agencyAddress: '', agencyIban: '', agencyLogo: '' };

const settings = {
  get() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(PREFIX + 'settings') || '{}') };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },
  save(value) {
    localStorage.setItem(PREFIX + 'settings', JSON.stringify(value));
  },
};

const LOG_LIMIT = 50;

const logs = {
  getAll: () => read('logs'),
  add(message, type = 'info') {
    const rows = read('logs');
    rows.unshift({
      id: newId(),
      message,
      type,
      user: users.getCurrentUser()?.name ?? 'Sistem',
      timestamp: new Date().toISOString(),
    });
    write('logs', rows.slice(0, LOG_LIMIT));
  },
  clear: () => write('logs', []),
};

const usersBase = createCollection('users');

const users = {
  ...usersBase,
  getAll: () => read('users'),
  /**
   * Oturumdaki kullanıcının güncel kaydını döner.
   * sessionStorage yalnızca kimliği taşır; yetkiler her zaman kayıttan okunur,
   * böylece Ayarlar'dan yetki değişince oturum açık kullanıcıya da yansır.
   */
  getCurrentUser() {
    const raw = sessionStorage.getItem('auth_user');
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      return usersBase.getById(session.id) ?? null;
    } catch {
      return null;
    }
  },
};

// ── Kurulum ve göç ───────────────────────────────────────────────────────

const DEFAULT_USERS = [
  { id: 'admin', username: 'admin', password: '123', name: 'Sistem Yöneticisi', role: 'admin', permissions: ['all'] },
  { id: 'staff', username: 'staff', password: '123', name: 'Operasyon Sorumlusu', role: 'staff', permissions: ['view_participants', 'add_participants'] },
];

function ensureUsers() {
  if (read('users').length === 0) write('users', DEFAULT_USERS);
}

/**
 * Eski budgetItems tablosunu budgets'a taşır.
 * Eski anahtar veri kaybı riskine karşı _backup son ekiyle saklanır.
 */
function migrateBudgets() {
  const legacy = read('budgetItems');
  if (legacy.length === 0) return;

  const merged = read('budgets');
  const existingIds = new Set(merged.map((b) => b.id));

  legacy.forEach((item) => {
    if (existingIds.has(item.id)) return;
    merged.push({
      id: item.id,
      eventId: item.eventId,
      type: item.type,
      category: item.category,
      // Eski kayıtların bir kısmında açıklama "title" alanındaydı.
      description: item.description || item.title || '',
      amount: Number(item.amount) || 0,
      status: 'approved',
      createdBy: item.createdBy || 'Aktarım',
      createdAt: item.createdAt || new Date().toISOString(),
    });
  });

  write('budgets', merged);
  localStorage.setItem(PREFIX + 'budgetItems_backup', JSON.stringify(legacy));
  localStorage.removeItem(PREFIX + 'budgetItems');
  console.info(`[store] ${legacy.length} bütçe kalemi budgets tablosuna taşındı.`);
}

export function initStore() {
  ensureUsers();
  // Göç başarısız olsa bile (ör. localStorage kotası dolu) uygulama açılmalı;
  // aksi halde kullanıcı verisine hiç erişemez hale gelir.
  try {
    migrateBudgets();
  } catch (error) {
    console.error('[store] Bütçe göçü tamamlanamadı, eski tablo yerinde bırakıldı:', error);
  }
}

/** Yedekleme/geri yükleme için tüm ethiccon_ anahtarları. */
export function exportAll() {
  const dump = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(PREFIX)) dump[key] = localStorage.getItem(key);
  }
  return dump;
}

export function importAll(dump) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
  Object.entries(dump).forEach(([key, value]) => localStorage.setItem(key, value));
}

export const DB = {
  events,
  participants,
  accommodations,
  flights,
  transfers,
  sponsors,
  budgets,
  proformas,
  proformaItems,
  tasks,
  companies,
  users,
  settings,
  logs,
};
