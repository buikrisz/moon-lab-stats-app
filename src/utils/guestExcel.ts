import * as XLSX from 'xlsx';
import type { GuestRecord } from '../types/guest';

export type ParsedGuestRecord = Partial<GuestRecord> & Pick<GuestRecord, 'guestId' | 'source'>;

export async function parseGuestWorkbook(file: File): Promise<ParsedGuestRecord[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('A munkafüzet első lapja nem található.');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '', raw: false });
  const normalize = (value: unknown) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
  const headers = (rows.shift() || []).map(normalize);
  const findCol = (...names: string[]) => {
    const wanted = new Set(names.map(normalize));
    return headers.findIndex(header => wanted.has(header));
  };
  const idCol = findCol('id', 'vendegid', 'vendegazonosito', 'guestid', 'motibro_id');
  if (idCol < 0) throw new Error('Hiányzó kötelező oszlop: vendég ID.');

  const registeredCol = findCol('regisztracioidopontja', 'registrationdate', 'registeredat', 'registereddate');
  const firstVisitCol = findCol('elsooralatogatasidopontja', 'firstvisit', 'firstvisitdate', 'firstvisitat');
  const lastVisitCol = findCol('utolsooralatogatasidopontja', 'lastvisit', 'lastvisitdate', 'lastvisitat');
  const sourceCol = findCol('honnankitolhallottalrolunk', 'registrationsource', 'referralsource', 'howdidyouhearaboutus');
  const coursesCol = findCol('kurzusok', 'courses');
  const courseColumns = headers.map((header, index) => /^coursename\d+$/.test(header) ? index : -1).filter(index => index >= 0);
  const membershipCol = findCol('aktivtanfolyamtagsag', 'activemembership');
  const lastNameCol = findCol('vezeteknev', 'lastname', 'surname');
  const firstNameCol = findCol('keresztnev', 'firstname', 'givenname');
  const nicknameCol = findCol('becenev', 'nickname');

  const get = (values: unknown[], index: number) => index < 0 ? '' : String(values[index] ?? '').trim();
  const date = (value: string): string | null => {
    if (!value) return null;
    const serial = Number(value);
    if (/^\d+(\.\d+)?$/.test(value) && serial > 20000 && serial < 100000) {
      return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
    }
    const match = value.match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  };

  return rows.map(row => {
    const values = row as unknown[];
    const guestId = get(values, idCol);
    const record: ParsedGuestRecord = { guestId, source: 'guest-list' };
    if (lastNameCol >= 0) record.lastName = get(values, lastNameCol);
    if (firstNameCol >= 0) record.firstName = get(values, firstNameCol);
    if (nicknameCol >= 0) record.nickname = get(values, nicknameCol);
    if (registeredCol >= 0) record.registeredAt = date(get(values, registeredCol));
    if (firstVisitCol >= 0) record.firstVisitAt = date(get(values, firstVisitCol));
    if (lastVisitCol >= 0) record.lastVisitAt = date(get(values, lastVisitCol));
    if (courseColumns.length) record.courses = courseColumns.map(index => get(values, index)).filter(Boolean);
    else if (coursesCol >= 0) record.courses = get(values, coursesCol).split(',').map(course => course.trim()).filter(Boolean);
    if (membershipCol >= 0) record.activeMembership = get(values, membershipCol);
    const registrationSource = get(values, sourceCol);
    if (registrationSource) record.registrationSource = registrationSource;
    return record;
  }).filter(guest => guest.guestId);
}
