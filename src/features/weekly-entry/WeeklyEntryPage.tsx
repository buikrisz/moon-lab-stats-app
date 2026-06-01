"use client";

import { CircleDollarSign, Clock3, Lock, Plus, RotateCcw, Sparkles, Star, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DayRow, ExtraRevenue, PassType, Settings, WeekRow } from '../../types';
import { weekTotals } from '../../utils/calculations';
import { huf, num } from '../../utils/format';
import { Button } from '../../components/common/Button';
import { DayEditorModal } from './DayEditorModal';
import { NewWeekModal } from './NewWeekModal';

type Props = {
  weeks: WeekRow[];
  setWeeks: (updater: WeekRow[] | ((weeks: WeekRow[]) => WeekRow[])) => void;
  passes: PassType[];
  settings: Settings;
  selectedWeekId?: string;
  setSelectedWeekId: (id: string | undefined) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
};

export function WeeklyEntryPage({ weeks, setWeeks, passes, settings, selectedWeekId, setSelectedWeekId, selectedYear, setSelectedYear }: Props) {
  const router = useRouter();
  const selectedWeek = selectedWeekId ? weeks.find(w => w.id === selectedWeekId) : undefined;
  const effectiveYear = selectedWeek ? Number(selectedWeek.startDate?.slice(0, 4) || selectedWeek.year) : selectedYear;
  const years = Array.from(new Set(weeks.flatMap(w => [Number(w.startDate?.slice(0, 4) || w.year), Number(w.endDate?.slice(0, 4) || w.year)]))).sort((a, b) => b - a);
  const selectableWeeks = weeks
    .filter(w => Number(w.startDate?.slice(0, 4) || w.year) === effectiveYear || Number(w.endDate?.slice(0, 4) || w.year) === effectiveYear)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const fallbackWeek = selectableWeeks.find(w => w.status === 'open') || selectableWeeks[0] || weeks[0];
  const firstWeekForYear = (year: number) => weeks
    .filter(w => Number(w.startDate?.slice(0, 4) || w.year) === year || Number(w.endDate?.slice(0, 4) || w.year) === year)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const week = selectedWeek && selectableWeeks.some(item => item.id === selectedWeek.id) ? selectedWeek : fallbackWeek;
  const [editDay, setEditDay] = useState<DayRow | null>(null);
  const [isNewWeekOpen, setIsNewWeekOpen] = useState(false);
  const [isExtraRevenueOpen, setIsExtraRevenueOpen] = useState(false);
  const [extraRevenueType, setExtraRevenueType] = useState<ExtraRevenue['type']>('expired-pass');
  const [extraRevenueName, setExtraRevenueName] = useState('');
  const [extraRevenueAmount, setExtraRevenueAmount] = useState(0);
  const totals = useMemo(() => week ? weekTotals(week) : null, [week]);

  if (!week || !totals) return <div className="panel">Nincs rögzíthető hét.</div>;

  const isSummaryImport = week.source === 'summary-import';

  const updateDay = (day: DayRow) => {
    setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, days: w.days.map(d => d.id === day.id ? day : d) } : w));
  };

  const closeWeek = () => setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, status: 'closed' } : w));
  const reopenWeek = () => setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, status: 'open', monthClosed: false } : w));

  const createNewWeek = (newWeek: WeekRow) => {
    setWeeks(prev => [
      newWeek,
      ...prev.map(w => w.status === 'open' ? { ...w, status: 'closed' as const } : w),
    ]);
    setSelectedYear(Number(newWeek.startDate.slice(0, 4)));
    setSelectedWeekId(newWeek.id);
    setIsNewWeekOpen(false);
  };

  const updateWeekName = (name: string) => {
    setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, week: name } : w));
  };

  const addWeekExtraRevenue = () => {
    if (!extraRevenueAmount || extraRevenueAmount <= 0) return;
    const extraRevenue: ExtraRevenue = {
      id: crypto.randomUUID(),
      name: extraRevenueName.trim(),
      amount: extraRevenueAmount,
      type: extraRevenueType,
    };

    setWeeks(prev => prev.map(w => w.id === week.id
      ? { ...w, extraRevenues: [...(w.extraRevenues || []), extraRevenue] }
      : w
    ));

    setExtraRevenueType('expired-pass');
    setExtraRevenueName('');
    setExtraRevenueAmount(0);
    setIsExtraRevenueOpen(false);
  };

  const removeWeekExtraRevenue = (id: string) => {
    setWeeks(prev => prev.map(w => w.id === week.id
      ? { ...w, extraRevenues: (w.extraRevenues || []).filter(item => item.id !== id) }
      : w
    ));
  };

  const weekExtraRevenueTotal = (week.extraRevenues || []).reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="panel entryPanel">
      <div className="panelHead">
        <h2>Heti rögzítés <span>(napi bevitel)</span></h2>
        <div className="weekControls">
          <select value={effectiveYear} onChange={e => {
            const nextYear = Number(e.target.value);
            const firstWeek = firstWeekForYear(nextYear);
            router.replace('/heti-rogzites');
            setSelectedYear(nextYear);
            setSelectedWeekId(firstWeek?.id);
          }}>
            {years.map(y => <option value={y} key={y}>{y}</option>)}
          </select>
          <select value={week.id} onChange={e => {
            const nextWeek = weeks.find(item => item.id === e.target.value);
            router.replace('/heti-rogzites');
            if (nextWeek) setSelectedYear(Number(nextWeek.startDate.slice(0, 4)));
            setSelectedWeekId(e.target.value);
          }}>
            {selectableWeeks.map(w => <option value={w.id} key={w.id}>{w.week}</option>)}
          </select>
          <span className={`pill ${week.status === 'open' ? 'success' : ''}`}>{week.status === 'open' ? 'Nyitva' : 'Lezárt'}</span>
          <Button variant="primary" onClick={() => setIsNewWeekOpen(true)}><Plus size={16}/> Új hét</Button>
        </div>
      </div>

      <div className="weekNameEditor">
        <label>Hét neve</label>
        <input value={week.week} onChange={e => updateWeekName(e.target.value)} />
        <small>{week.startDate} – {week.endDate}</small>
      </div>

      {isSummaryImport && (
        <div className="infoBox">
          Ez egy importált historikus heti összesítő. Ehhez nincs napi / résztvevő bontás, ezért a heti rögzítésben nem szerkeszthető. A jövőben létrehozott új hetek természetesen szerkeszthetők lesznek.
        </div>
      )}

      <div className="dayCards">
        {week.days.map(day => (
          <button className={`dayCard ${isSummaryImport ? 'disabledDayCard' : ''}`} key={day.id} onClick={() => !isSummaryImport && setEditDay(day)}>
            <strong>{day.day}</strong>
            <span>{huf(day.revenue)}</span>
            <small>{day.participants} résztvevő • {day.heldHours} óra</small>
          </button>
        ))}
      </div>

      <table>
        <thead><tr><th>Nap</th><th>Bevétel</th><th>Megtartott órák</th><th>Teltházas órák</th><th>Résztvevők</th><th>Oktatói költség</th></tr></thead>
        <tbody>{week.days.map(r => (
          <tr key={r.id} onClick={() => !isSummaryImport && setEditDay(r)} className={isSummaryImport ? '' : 'clickableRow'}>
            <td><b>{r.day}</b></td><td>{huf(r.revenue)}</td><td>{num(r.heldHours)}</td><td>{num(r.fullHours)}</td><td>{num(r.participants)}</td><td>{huf(r.trainerCost)}</td>
          </tr>
        ))}</tbody>
      </table>

      <div className="miniStats">
        <div><CircleDollarSign size={18}/> Összes bevétel <b>{huf(totals.revenue)}</b></div>
        <div><Clock3 size={18}/> Összes óra <b>{totals.heldHours}</b></div>
        <div><Star size={18}/> Teltházas órák <b>{totals.fullHours}</b></div>
        <div><Users size={18}/> Résztvevők <b>{totals.participants}</b></div>
        <div><Sparkles size={18}/> Oktatói költség <b>{huf(totals.trainerCost)}</b></div>
      </div>

      <div className="weekActionRow">
        {!isSummaryImport && (
          week.status === 'open'
            ? <button className="closeWeek" onClick={closeWeek}>Hét lezárása <Lock size={16}/></button>
            : <button className="closeWeek secondary" onClick={reopenWeek}>Hét visszahozása editre <RotateCcw size={16}/></button>
        )}
        <Button onClick={() => setIsExtraRevenueOpen(prev => !prev)}><Plus size={16}/> Extra bevétel</Button>
      </div>

      {isExtraRevenueOpen && (
        <div className="weekExtraRevenueBox">
          <select value={extraRevenueType} onChange={e => {
            setExtraRevenueType(e.target.value as ExtraRevenue['type']);
            setExtraRevenueName('');
          }}>
            <option value="expired-pass">Lejárt bérlet</option>
            <option value="other">Egyéb</option>
          </select>
          <input value={extraRevenueName} onChange={e => setExtraRevenueName(e.target.value)} placeholder="Név" />
          <input type="number" value={extraRevenueAmount} onChange={e => setExtraRevenueAmount(Number(e.target.value))} placeholder="Összeg" />
          <Button variant="primary" onClick={addWeekExtraRevenue}><Plus size={16}/> Hozzáadás</Button>
        </div>
      )}

      {(week.extraRevenues || []).length > 0 && (
        <div className="weekExtraRevenueList">
          <div className="panelHead compactHead">
            <h3>Heti extra bevételek</h3>
            <strong>{huf(weekExtraRevenueTotal)}</strong>
          </div>
          {(week.extraRevenues || []).map(item => (
            <div className="entryRow" key={item.id}>
              <div>
                <strong>{item.name || (item.type === 'expired-pass' ? 'Lejárt bérlet' : 'Egyéb bevétel')}</strong>
                <span>{item.type === 'expired-pass' ? 'Lejárt bérlet' : 'Egyéb bevétel'}</span>
              </div>
              <span />
              <div className="qtyControls">
                <b>{huf(item.amount)}</b>
                <Button variant="icon" onClick={() => removeWeekExtraRevenue(item.id)}><Trash2 size={14}/></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editDay && (
        <DayEditorModal
          day={editDay}
          passes={passes}
          trainerHourlyCost={settings.trainerHourlyCost}
          fullHourTrainerCost={settings.fullHourTrainerCost || 10000}
          onClose={() => setEditDay(null)}
          onSave={(day) => { updateDay(day); setEditDay(null); }}
        />
      )}

      {isNewWeekOpen && <NewWeekModal onClose={() => setIsNewWeekOpen(false)} onCreate={createNewWeek} />}
    </section>
  );
}
