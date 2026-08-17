/**
 * Biçimlendirme yardımcıları.
 * Daha önce formatDate/formatCurrency üç ayrı sayfada kopyalanmıştı.
 */

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** "15 Eyl 2026" — geçersiz/boş tarihte "-" döner. */
export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "15.09.2026" — tablo hücreleri için kısa biçim. */
export function formatShortDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('tr-TR');
}

/** "14:30" */
export function formatTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/** "₺1.234,56" */
export function formatCurrency(amount) {
  return '₺' + Number(amount || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "₺1.235" — KPI kartları gibi kuruşun gereksiz olduğu yerler için. */
export function formatAmount(amount) {
  return '₺' + Number(amount || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

const TR_ASCII = { ç: 'c', ş: 's', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', Ç: 'C', Ş: 'S', Ğ: 'G', İ: 'I', Ö: 'O', Ü: 'U' };

/**
 * jsPDF'in gömülü fontları Türkçe karakter taşımıyor; PDF'e giden metni
 * ASCII'ye indirger. Kalıcı çözüm PDF'e Unicode font gömmektir.
 */
export function toAscii(value) {
  if (value == null || value === '') return '-';
  return String(value).replace(/[çşğıöüÇŞĞİÖÜ]/g, (ch) => TR_ASCII[ch] ?? ch);
}
