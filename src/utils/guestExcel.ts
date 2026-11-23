import * as XLSX from 'xlsx';
import type { GuestRecord } from '../types/guest';

export async function parseGuestWorkbook(file: File): Promise<GuestRecord[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('A munkafüzet első lapja nem található.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '', raw: false });
  const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('hu');
  const headers = (rows.shift() || []).map(normalize);
  const findCol = (...names: string[]) => headers.findIndex(header => names.some(name => header === normalize(name)));
  const idCol = findCol('Id', 'Vendég ID', 'Vendég azonosító');
  const regCol = findCol('Regisztráció időpontja');
  if (idCol < 0 || regCol < 0) throw new Error('Hiányzó kötelező oszlop: Id vagy Regisztráció időpontja.');
  const col = (row: unknown[], ...names: string[]) => {
    const i = findCol(...names);
    return i < 0 ? '' : String(row[i] ?? '').trim();
  };
  const date = (value: string): string | null => {
    if (!value) return null;
    const serial = Number(value);
    if (/^\d+(\.\d+)?$/.test(value) && serial > 20000 && serial < 100000) {
      return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
    }
    const match = value.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?$/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  };

  return rows.map(row => {
    const values = row as unknown[];
    return {
      guestId: String(values[idCol] ?? '').trim(),
      lastName: col(values, 'Vezetéknév'),
      firstName: col(values, 'Keresztnév'),
      nickname: col(values, 'Becenév'),
      registeredAt: date(String(values[regCol] ?? '').trim()),
      firstVisitAt: date(col(values, 'Első óralátogatás időpontja')),
      lastVisitAt: date(col(values, 'Utolsó óralátogatás időpontja')),
      courses: col(values, 'Kurzusok').split(',').map(course => course.trim()).filter(Boolean),
      activeMembership: col(values, 'Aktív tanfolyamtagság'),
      source: 'guest-list' as const,
    };
  }).filter(guest => guest.guestId);
}
