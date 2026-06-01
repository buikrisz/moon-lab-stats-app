"use client";

import { Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Page, WeekRow } from '@/types';
import { aggregateWeeksForCalendarView, months, weekTotals } from '@/utils/calculations';
import { downloadCsv } from '@/utils/export';
import { getMondayOfWeek, getMonthRange, normalizeWeekDates, rangesOverlap } from '@/utils/date';
import { WeeklyTable } from '@/components/tables/WeeklyTable';
import { Button } from '@/components/common/Button';

type ViewMode = 'all' | 'year' | 'month';

export function WeeklySummaryPage({
  weeks,
  setWeeks,
  selectedMonth,
  selectedYear,
  setSelectedYear,
  setSelectedMonth,
  setSelectedWeekId,
  setPendingSelectedWeekId,
  setPage,
}: {
  weeks: WeekRow[];
  setWeeks: (updater: WeekRow[] | ((weeks: WeekRow[]) => WeekRow[])) => void;
  selectedMonth: string;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: string) => void;
  setSelectedWeekId: (id: string) => void;
  setPendingSelectedWeekId: (id: string) => void;
  setPage: (page: Page) => void;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ViewMode>('all');
  const router = useRouter();
  const years = useMemo(() => Array.from(new Set(weeks.flatMap(w => [Number(w.startDate?.slice(0,4) || w.year), Number(w.endDate?.slice(0,4) || w.year)]))).sort((a,b)=>a-b), [weeks]);

  const filtered = useMemo(() => {
    const monthRange = getMonthRange(selectedYear, selectedMonth);

    return aggregateWeeksForCalendarView(weeks)
      .map(normalizeWeekDates)
      .filter(w => {
        if (mode === 'all') return true;
        if (mode === 'year') return w.year === selectedYear || Number(w.startDate.slice(0, 4)) === selectedYear || Number(w.endDate.slice(0, 4)) === selectedYear;
        return rangesOverlap(w.startDate, w.endDate, monthRange.start, monthRange.end);
      })
      .filter(w => w.week.toLowerCase().includes(query.toLowerCase()) || w.month.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [weeks, mode, selectedMonth, query, selectedYear]);

  const openWeek = (id: string) => {
    let targetId = id;
    let targetYear: number | undefined;

    if (id.startsWith('calendar-week-')) {
      const start = id.replace('calendar-week-', '');
      const target = weeks
        .map(normalizeWeekDates)
        .filter(week => getMondayOfWeek(week.startDate) === start)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

      if (target) {
        targetId = target.id;
        targetYear = Number(target.startDate.slice(0, 4));
      }
    } else {
      const target = weeks.find(week => week.id === id);
      if (target) targetYear = Number(target.startDate.slice(0, 4));
    }

    if (targetYear) setSelectedYear(targetYear);
    setSelectedWeekId(targetId);
    setPendingSelectedWeekId(targetId);
    router.push(`/heti-rogzites?weekId=${encodeURIComponent(targetId)}`);
  };

  const deleteWeek = (id: string) => {
    setWeeks(prev => prev.filter(w => w.id !== id));
  };

  const resolveDeleteTargets = (week: WeekRow) => {
    if (!week.id.startsWith('calendar-week-')) return [week.id];

    const calendarStart = week.id.replace('calendar-week-', '');
    return weeks
      .map(normalizeWeekDates)
      .filter(sourceWeek => getMondayOfWeek(sourceWeek.startDate) === calendarStart)
      .map(sourceWeek => sourceWeek.id);
  };


  const exportRows = () => downloadCsv('heti-lebontas.csv', [
    ['Hét','Órák','Teltházas','Résztvevők','Átlag','Bevétel','Kiadás','Profit'],
    ...filtered.map(w => {
      const t = weekTotals(w);
      return [w.week,t.heldHours,t.fullHours,t.participants,t.avg.toFixed(2),t.revenue,t.expense,t.profit];
    })
  ]);

  return (
    <section className="panel">
      <div className="panelHead">
        <div>
          <h2>Heti lebontás</h2>
          <p className="panelSub">
            Teljes, éves vagy havi naptár szerinti nézet. Havi nézetben az átlógó hetek is megjelennek.
          </p>
        </div>

        <div className="actions">
          <div className="segmented">
            <button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>Teljes</button>
            <button className={mode === 'year' ? 'active' : ''} onClick={() => setMode('year')}>Év</button>
            <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>Hónap</button>
          </div>
          {mode !== 'all' && (
            <label className="selectWrap compactSelect">
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          )}

          {mode === 'month' && (
            <label className="selectWrap compactSelect">
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {months.map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
          )}


          <div className="search"><Search size={16}/><input placeholder="Keresés..." value={query} onChange={e => setQuery(e.target.value)} /></div>
          <Button onClick={exportRows}><Download size={16}/> Export</Button>
        </div>
      </div>

      <WeeklyTable weeks={filtered} onOpenWeek={openWeek} onDeleteWeek={deleteWeek} resolveDeleteTargets={resolveDeleteTargets} />
    </section>
  );
}
