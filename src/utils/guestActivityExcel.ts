import * as XLSX from 'xlsx';
import type { GuestPurchase, GuestVisit } from '../types/guest';

export type ParsedGuestActivity = {
  visits: GuestVisit[];
  purchases: GuestPurchase[];
  sources: Record<string, string>;
  reportPeriod: { fileName: string; startDate: string; endDate: string } | null;
};
const clean = (value: unknown) => String(value ?? '').trim();
const amount = (value: unknown) => {
  const parsed = Number(clean(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const dateTime = (value: unknown) => {
  const raw = clean(value);
  if (!raw) return '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};
const truthy = (value: unknown) => /^(igen|yes|true|1)$/i.test(clean(value));
const rowKey = (guestId: string, startsAt: string, className: string, courseName: string, instructor: string) => [guestId, startsAt, className, courseName, instructor].join('|');
const productCategory = (name: string, sessions: number): GuestPurchase['category'] => {
  if (/magánóra/i.test(name)) return 'other';
  if (sessions > 1 && /bérlet|alkalom/i.test(name)) return 'pass';
  if (/jegy|alkalmas|próba|nyílt nap|magánóra/i.test(name) || sessions <= 1) return 'ticket';
  return 'other';
};

export async function parseGuestActivityWorkbook(file: File): Promise<ParsedGuestActivity> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const rowsFor = (sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  };
  const attendanceRows = rowsFor('Óralátogatások');
  const bookingRows = rowsFor('Bejelentkezések');
  if (!attendanceRows.length || !bookingRows.length) throw new Error('A munkafüzetben az „Óralátogatások” és „Bejelentkezések” lapnak is szerepelnie kell.');

  const sources: Record<string, string> = {};
  const events = new Map<string, GuestVisit>();
  const bookingsByEvent = new Map<string, Record<string, unknown>>();
  const get = (row: Record<string, unknown>, ...names: string[]) => {
    const key = Object.keys(row).find(header => names.some(name => header.trim().toLocaleLowerCase('hu') === name.toLocaleLowerCase('hu')));
    return key ? clean(row[key]) : '';
  };
  const makeVisit = (row: Record<string, unknown>, attended: boolean): GuestVisit | null => {
    const guestId = get(row, 'Vendég ID');
    const startsAt = dateTime(get(row, 'Óra időpontja'));
    if (!guestId || !startsAt) return null;
    const className = get(row, 'Óra elnevezése');
    const courseName = get(row, 'Kurzus neve');
    const instructor = get(row, 'Oktató');
    const eventId = rowKey(guestId, startsAt, className, courseName, instructor);
    const referral = get(row, 'Honnan/kitől hallottál rólunk?');
    if (!(guestId in sources) || referral) sources[guestId] = referral;
    return {
      eventId, guestId, startsAt, className, courseName, instructor,
      passName: get(row, 'Bérletfelhasználás'), attended,
      revenue: amount(get(row, 'Órára jutó bevétel (HUF)', 'Órára jutó bevétel')),
      hasDebt: /van/i.test(get(row, 'Van-e tartozása a vendégnek')),
      source: 'attendance-export',
    };
  };

  for (const row of bookingRows) {
    const visit = makeVisit(row, truthy(get(row, 'Részvétel órán')));
    if (!visit) continue;
    bookingsByEvent.set(visit.eventId, row);
    events.set(visit.eventId, visit);
  }
  for (const row of attendanceRows) {
    const visit = makeVisit(row, true);
    if (!visit) continue;
    const booking = bookingsByEvent.get(visit.eventId);
    if (booking) {
      visit.hasDebt = /van/i.test(get(booking, 'Van-e tartozása a vendégnek'));
    }
    events.set(visit.eventId, visit);
  }

  const purchases = new Map<string, GuestPurchase>();
  for (const row of bookingRows) {
    const guestId = get(row, 'Vendég ID');
    const purchasedAt = dateTime(get(row, 'Bérlet értékesítésének időpontja'));
    const name = get(row, 'Bérletfelhasználás');
    if (!guestId || !purchasedAt || !name) continue;
    const listPrice = amount(get(row, 'Bérlet listaára (HUF)', 'Bérlet listaára'));
    const discount = amount(get(row, 'Kedvezmény (HUF)', 'Kedvezmény'));
    const paidPrice = amount(get(row, 'Bérlet kedvezményekkel csökkentett ára (HUF)', 'Bérlet kedvezményekkel csökkentett ára'));
    const sessionCount = amount(get(row, 'Bérlet alkalmainak száma'));
    const purchaseId = [guestId, purchasedAt, name, listPrice, discount, paidPrice, sessionCount].join('|');
    const invoice = get(row, 'Számla');
    purchases.set(purchaseId, {
      purchaseId, guestId, purchasedAt, name, category: productCategory(name, sessionCount),
      listPrice, discount, paidPrice, sessionCount,
      salesperson: get(row, 'Bérlet értékesítője'), invoice,
      source: 'attendance-export',
    });
  }
  const period = file.name.match(/(\d{4}-\d{2}-\d{2})[-_](\d{4}-\d{2}-\d{2})/);
  return {
    visits: [...events.values()], purchases: [...purchases.values()], sources,
    reportPeriod: period ? { fileName: file.name, startDate: period[1], endDate: period[2] } : null,
  };
}
