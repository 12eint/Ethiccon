/**
 * Oturum ve yetki yardımcıları.
 *
 * DİKKAT: Bu kontroller yalnızca arayüzü şekillendirir, güvenlik sağlamaz.
 * Veri tarayıcıda durduğu için kullanıcı sessionStorage/localStorage'ı elle
 * düzenleyip her yetkiyi alabilir. Gerçek yetkilendirme backend'e geçilince
 * sunucu tarafında yeniden yazılmalıdır.
 */
import { DB } from './store.js';

export const PERMISSIONS = [
  // Bütçe modülüne erişim artık herkeste var; bu yetki yalnızca finansal
  // toplamları (gelir, kâr/zarar) görmeyi açar.
  { id: 'view_budget', label: 'Finansal Toplamları Görüntüleme (gelir, kâr/zarar)' },
  { id: 'view_proforma', label: 'Proforma Faturaları Görüntüleme' },
  { id: 'view_settings', label: 'Ayarlar Sayfasına Erişim' },
  { id: 'delete_pax', label: 'Misafir (Katılımcı) Kaydı Silebilme' },
  { id: 'export_excel', label: 'Katılımcı Listesini Excel Olarak İndirebilme' },
];

/** Personel rolünün her zaman sahip olduğu, arayüzden kaldırılamayan yetkiler. */
export const BASE_STAFF_PERMISSIONS = ['view_participants', 'add_participants'];

export function getCurrentUser() {
  return DB.users.getCurrentUser();
}

export function isAdmin() {
  return getCurrentUser()?.role === 'admin';
}

/** @param {string} permission - PERMISSIONS içindeki bir id */
export function hasPermission(permission) {
  const user = getCurrentUser();
  if (!user) return false;
  const granted = user.permissions ?? (user.role === 'admin' ? ['all'] : []);
  return granted.includes('all') || granted.includes(permission);
}

/**
 * Finansal toplamları (toplam gelir, toplam gider, net kâr/zarar, modül
 * gelirleri) görme yetkisi.
 *
 * Bütçe modülünün kendisi herkese açık: saha personeli gelir ve gider
 * girebilir, kendi harcamalarını ve kategori limitlerini görebilir. Ayrı
 * tutulan şey acentenin kâr tablosudur.
 */
export function canSeeFinancials() {
  return hasPermission('view_budget');
}

/**
 * Kullanıcının görebileceği etkinlikler.
 * Yönetici hepsini görür; personel yalnızca kendisine atanmış olanları
 * ve sahipsiz olanları görür.
 */
export function visibleEvents() {
  const events = DB.events.getAll();
  const user = getCurrentUser();
  if (!user || user.role === 'admin') return events;
  return events.filter((e) => !e.assignedManagerId || e.assignedManagerId === user.id);
}

export function login(username, password) {
  const user = DB.users.getAll().find((u) => u.username === username && u.password === password);
  if (!user) return null;
  sessionStorage.setItem('auth_user', JSON.stringify({ id: user.id }));
  return user;
}

export function logout() {
  sessionStorage.removeItem('auth_user');
  window.location.href = 'login.html';
}

/** Oturum yoksa giriş sayfasına yollar. @returns {boolean} oturum var mı */
export function requireAuth() {
  if (getCurrentUser()) return true;
  sessionStorage.removeItem('auth_user');
  window.location.replace('login.html');
  return false;
}
