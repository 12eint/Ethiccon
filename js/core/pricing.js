/**
 * Fiyat ve kâr hesabı.
 *
 * Acentenin iş modeli: kayıt, konaklama ve uçak kalemlerinin her birinde
 * alış ve satış fiyatı ayrı tutulur; aradaki marj gelirdir. Bu hesap
 * önceden budget.js, accommodation.js ve proforma.js'te birbirinden hafifçe
 * farklı biçimlerde üç kez yazılmıştı, dolayısıyla ekranlar farklı rakam
 * gösterebiliyordu. Tek kaynak burasıdır.
 */
import { DB } from './store.js';

export const ROOM_TYPES = ['SNG', 'DBL', 'TRPL'];

export const ROOM_TYPE_LABELS = {
  SNG: 'Tek Kişilik (SNG)',
  DBL: 'Çift Kişilik (DBL)',
  TRPL: 'Üç Kişilik (TRPL)',
};

const EMPTY_ALLOTMENT = { count: 0, buyPrice: 0, sellPrice: 0 };

/** Etkinliğin konaklama yapılandırmasını eksiksiz biçimde döner. */
export function getAccommodationConfig(eventId) {
  const stored = DB.accommodations.getByEventId(eventId);
  const allotment = {};
  ROOM_TYPES.forEach((type) => {
    allotment[type] = { ...EMPTY_ALLOTMENT, ...(stored?.allotment?.[type] ?? {}) };
  });
  return { allotment, companyPrices: stored?.companyPrices ?? {} };
}

/**
 * Bir misafirin kayıt ücreti.
 * Özel fiyat varsa o, yoksa etkinliğin erken/geç kayıt fiyatı.
 */
export function registrationPrice(participant, event) {
  if (participant.regPeriod === 'custom') return Number(participant.regCustomPrice) || 0;
  if (participant.regPeriod === 'late') return Number(event?.lateRegPrice) || 0;
  return Number(event?.earlyRegPrice) || 0;
}

/**
 * Bir misafirin konaklama satış fiyatı.
 * Öncelik: kişiye özel fiyat → firmaya anlaşmalı fiyat → genel liste fiyatı.
 */
export function accommodationPrice(participant, config) {
  const individual = participant.accSellPrice;
  if (individual !== undefined && individual !== null && individual !== '') {
    return Number(individual) || 0;
  }
  const companyPrice = config.companyPrices?.[participant.company]?.[participant.roomType];
  if (companyPrice !== undefined && companyPrice !== null && companyPrice !== '') {
    return Number(companyPrice) || 0;
  }
  return Number(config.allotment[participant.roomType]?.sellPrice) || 0;
}

/** Fiyatın hangi kaynaktan geldiği — arayüzde ipucu göstermek için. */
export function accommodationPriceSource(participant, config) {
  const individual = participant.accSellPrice;
  if (individual !== undefined && individual !== null && individual !== '') return 'individual';
  if (config.companyPrices?.[participant.company]?.[participant.roomType] != null) return 'company';
  return 'list';
}

/**
 * Oda tipi bazında konaklama kâr/zararı.
 * Maliyet, satılan oda değil **satın alınan kontenjan** üzerinden hesaplanır;
 * çünkü allotment peşin bağlanır ve satılmayan oda zarardır.
 */
export function accommodationBreakdown(eventId) {
  const config = getAccommodationConfig(eventId);
  const guests = DB.participants.getByEventId(eventId).filter((p) => p.accommodation);

  return ROOM_TYPES.map((type) => {
    const allotment = config.allotment[type];
    const ofType = guests.filter((g) => g.roomType === type);
    const revenue = ofType.reduce((sum, guest) => sum + accommodationPrice(guest, config), 0);
    const cost = (Number(allotment.count) || 0) * (Number(allotment.buyPrice) || 0);
    return { type, allotment, sold: ofType.length, revenue, cost, profit: revenue - cost };
  });
}

/** Uçak biletlerinin toplam marjı. */
export function flightProfit(eventId) {
  return DB.flights.getByEventId(eventId).reduce(
    (sum, flight) => sum + ((Number(flight.sellPrice) || 0) - (Number(flight.buyPrice) || 0)),
    0,
  );
}

/** Kayıt ücretlerinin toplamı. */
export function registrationRevenue(eventId) {
  const event = DB.events.getById(eventId);
  return DB.participants
    .getByEventId(eventId)
    .reduce((sum, pax) => sum + registrationPrice(pax, event), 0);
}

/**
 * Etkinliğin tüm finansal özeti.
 * @returns {{registration: number, accommodation: number, flight: number,
 *   modules: number, extraIncome: number, expense: number, pendingExpense: number,
 *   totalRevenue: number, netProfit: number, categoryExpenses: Record<string, number>}}
 */
export function eventFinancials(eventId) {
  const registration = registrationRevenue(eventId);
  const accommodation = accommodationBreakdown(eventId).reduce((sum, row) => sum + row.profit, 0);
  const flight = flightProfit(eventId);
  const modules = registration + accommodation + flight;

  let extraIncome = 0;
  let expense = 0;
  let pendingExpense = 0;
  const categoryExpenses = {};

  DB.budgets.getByEventId(eventId).forEach((row) => {
    const amount = Number(row.amount) || 0;
    const status = row.status ?? 'approved';

    if (row.type === 'income') {
      if (status === 'approved') extraIncome += amount;
      return;
    }
    if (status === 'approved') {
      expense += amount;
      categoryExpenses[row.category] = (categoryExpenses[row.category] ?? 0) + amount;
    } else if (status === 'pending') {
      pendingExpense += amount;
    }
  });

  const totalRevenue = modules + extraIncome;
  return {
    registration,
    accommodation,
    flight,
    modules,
    extraIncome,
    expense,
    pendingExpense,
    totalRevenue,
    netProfit: totalRevenue - expense,
    categoryExpenses,
  };
}
