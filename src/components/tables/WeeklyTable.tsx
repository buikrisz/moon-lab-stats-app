"use client";

import { Eye, ShieldAlert, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WeekRow } from '../../types';
import { huf, num } from '../../utils/format';
import { weekTotals } from '../../utils/calculations';
import { Button } from '../common/Button';

type Props = {
  weeks: WeekRow[];
  onOpenWeek: (weekId: string) => void;
  onDeleteWeek?: (weekId: string) => void;
  resolveDeleteTargets?: (week: WeekRow) => string[];
};

export function WeeklyTable({ weeks, onOpenWeek, onDeleteWeek, resolveDeleteTargets }: Props) {
  const [adminDeleteMode, setAdminDeleteMode] = useState(false);

  const summary = useMemo(() => {
    const count = weeks.length || 1;
    return weeks.reduce((acc, week) => {
      const r = weekTotals(week);
      acc.heldHours += r.heldHours;
      acc.fullHours += r.fullHours;
      acc.participants += r.participants;
      acc.avg += r.avg;
      acc.revenue += r.revenue;
      acc.expense += r.expense;
      acc.profit += r.profit;
      acc.extraRevenue += r.extraRevenue;
      return acc;
    }, { heldHours: 0, fullHours: 0, participants: 0, avg: 0, revenue: 0, expense: 0, profit: 0, extraRevenue: 0, count });
  }, [weeks]);

  const requestDelete = (week: WeekRow) => {
    if (!adminDeleteMode || !onDeleteWeek) return;

    const targets = resolveDeleteTargets ? resolveDeleteTargets(week) : [week.id];
    if (targets.length === 0) return;

    const label = targets.length === 1 ? 'ezt a hetet' : `ezt a naptári hetet (${targets.length} DB sor)`;
    if (confirm(`Admin törlés aktív. Biztosan törlöd ${label}?`)) {
      targets.forEach(id => onDeleteWeek(id));
    }
  };

  return (
    <div>
      {onDeleteWeek && (
        <div className="tableAdminBar">
          <Button variant={adminDeleteMode ? 'danger' : 'ghost'} onClick={() => setAdminDeleteMode(prev => !prev)}>
            <ShieldAlert size={16}/> {adminDeleteMode ? 'Admin törlés kikapcsolása' : 'Admin törlés bekapcsolása'}
          </Button>
          {adminDeleteMode && <span>Most láthatók a törlés gombok. Törlés előtt még egyszer rákérdez az app.</span>}
        </div>
      )}

      <table className="compact">
        <thead>
          <tr>
            <th>Hét</th><th>Státusz</th><th>Megtartott órák</th><th>Teltházas órák</th><th>Résztvevők</th>
            <th>Átlag résztvevő / óra</th><th>Bevétel</th><th>Kiadás</th><th>Profit</th><th>Extra bevételek</th><th>Műveletek</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map(w => {
            const r = weekTotals(w);
            return (
              <tr key={w.id} className={w.status === 'open' ? 'openWeekRow' : ''}>
                <td>{w.week}</td>
                <td><span className={`pill ${w.status === 'open' ? 'success' : ''}`}>{w.status === 'open' ? 'Nyitva' : 'Lezárt'}</span></td>
                <td>{r.heldHours}</td><td>{r.fullHours}</td><td>{r.participants}</td><td>{num(r.avg, 2)}</td>
                <td>{huf(r.revenue)}</td><td>{huf(r.expense)}</td><td><b>{huf(r.profit)}</b></td>
                <td>{huf(r.extraRevenue)}</td>
                <td className="rowActions">
                  <Button variant="icon" onClick={() => onOpenWeek(w.id)}><Eye size={15} /></Button>
                  {adminDeleteMode && onDeleteWeek && <Button variant="icon" onClick={() => requestDelete(w)}><Trash2 size={15} /></Button>}
                </td>
              </tr>
            );
          })}

          {weeks.length > 0 && (
            <tr className="totalRow">
              <td><b>Átlag / összesen</b></td>
              <td>-</td>
              <td>{num(summary.heldHours / summary.count, 2)}</td>
              <td>{num(summary.fullHours / summary.count, 2)}</td>
              <td>{num(summary.participants / summary.count, 2)}</td>
              <td>{num(summary.avg / summary.count, 2)}</td>
              <td>{huf(summary.revenue)}</td>
              <td>{huf(summary.expense)}</td>
              <td><b>{huf(summary.profit)}</b></td>
              <td>{huf(summary.extraRevenue)}</td>
              <td></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
