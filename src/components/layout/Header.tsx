"use client";

import { Calendar } from 'lucide-react';
import type { Page } from '../../types';
import { months } from '../../utils/calculations';

const titles: Record<Page, string> = {
  dashboard: 'Dashboard',
  'weekly-entry': 'Heti rögzítés',
  'weekly-summary': 'Heti lebontás',
  'monthly-summary': 'Éves kimutatások',
  calendar: 'Naptár',
  passes: 'Bérletek / árak',
  expenses: 'Költségek',
  settings: 'Beállítások',
};

type Props = {
  page: Page;
  setPage: (page: Page) => void;
  month: string;
  setMonth: (month: string) => void;
  year: number;
  setYear: (year: number) => void;
  years: number[];
  isSaving?: boolean;
};

export function Header({ page, month, setMonth, year, setYear, years, isSaving }: Props) {
  const showYear = page === 'dashboard' || page === 'monthly-summary';
  const showMonth = page === 'dashboard';

  return (
    <header className="topbar">
      <div>
        <h1>{page === 'dashboard' ? 'Üdvözöl a Moon Lab Pilates! 👋' : titles[page]}</h1>
        <p>{isSaving ? 'Mentés folyamatban...' : page === 'dashboard' ? 'Itt áttekintheted a stúdió teljesítményét.' : 'MongoDB-be mentett pénzügyi felület.'}</p>
      </div>

      {(showYear || showMonth) && (
        <div className="actions">
          {showYear && (
            <label className="selectWrap">
              <Calendar size={17} />
              <select value={year} onChange={e => setYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          )}

          {showMonth && (
            <label className="selectWrap">
              <Calendar size={17} />
              <select value={month} onChange={e => setMonth(e.target.value)}>
                {months.map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </header>
  );
}
