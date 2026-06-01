"use client";

import { Download } from 'lucide-react';
import type { Expense, WeekRow } from '../../types';
import { getVisibleMonthsForYear } from '../../utils/calculations';
import { huf, num } from '../../utils/format';
import { downloadCsv } from '../../utils/export';
import { Button } from '../../components/common/Button';

type Props = {
  weeks: WeekRow[];
  expenses: Expense[];
  selectedYear: number;
};

export function MonthlySummaryPage({ weeks, expenses, selectedYear }: Props) {
  const rows = getVisibleMonthsForYear(weeks, expenses, selectedYear);

  const totals = rows.reduce((acc, row) => {
    const r = row.totals;
    acc.heldHours += r.heldHours;
    acc.fullHours += r.fullHours;
    acc.participants += r.participants;
    acc.revenue += r.revenue;
    acc.pos += r.pos;
    acc.trainerCost += r.trainerCost;
    acc.szamlazz += r.szamlazz;
    acc.motibro += r.motibro;
    acc.ads += r.ads;
    acc.cleaning += r.cleaning;
    acc.rent += r.rent;
    acc.utilities += r.utilities;
    acc.otherManual += r.otherManual;
    acc.expense += r.expense;
    acc.profit += r.profit;
        return acc;
  }, {
    heldHours: 0, fullHours: 0, participants: 0, revenue: 0, pos: 0, trainerCost: 0, szamlazz: 0,
    motibro: 0, ads: 0, cleaning: 0, rent: 0, utilities: 0, otherManual: 0, expense: 0, profit: 0,
  });

  const avg = totals.heldHours ? totals.participants / totals.heldHours : 0;

  const exportRows = () => downloadCsv(`eves-kimutatas-${selectedYear}.csv`, [
    ['Év','Hónap','Órák','Teltházas','Résztvevők','Átlag','Bevétel','POS','Oktatói','Számlázz.hu','Motibro','Hirdetés','Tisztítószer','Bérleti díj','Rezsi','További változó','Össz. kiadás','Profit'],
    ...rows.map(({ month, totals: r }) => [selectedYear,month,r.heldHours,r.fullHours,r.participants,r.avg.toFixed(2),r.revenue,r.pos,r.trainerCost,r.szamlazz,r.motibro,r.ads,r.cleaning,r.rent,r.utilities,r.otherManual,r.expense,r.profit]),
    [selectedYear,'Összesen',totals.heldHours,totals.fullHours,totals.participants,avg.toFixed(2),totals.revenue,totals.pos,totals.trainerCost,totals.szamlazz,totals.motibro,totals.ads,totals.cleaning,totals.rent,totals.utilities,totals.otherManual,totals.expense,totals.profit],
  ]);

  return (
    <section className="panel monthly">
      <div className="panelHead"><h2>Éves kimutatások - {selectedYear}</h2><Button onClick={exportRows}><Download size={16}/> Export CSV</Button></div>
      <table className="compact">
        <thead>
          <tr>
            <th>Hónap</th><th>Megtartott órák</th><th>Teltházas</th><th>Résztvevők</th><th>Átlag</th><th>Bevétel</th>
            <th>POS 2%</th><th>Oktatói</th><th>Számlázz.hu</th><th>Motibro</th><th>Hirdetés</th><th>Tisztítószer</th>
            <th>Bérleti díj</th><th>Rezsi</th><th>További változó</th><th>Össz. kiadás</th><th>Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ month, totals: r }) => (
            <tr key={month}>
              <td><b>{month}</b></td><td>{r.heldHours}</td><td>{r.fullHours}</td><td>{r.participants}</td><td>{num(r.avg, 2)}</td>
              <td>{huf(r.revenue)}</td>
              <td>{huf(r.pos)}</td><td>{huf(r.trainerCost)}</td><td>{huf(r.szamlazz)}</td><td>{huf(r.motibro)}</td>
              <td>{huf(r.ads)}</td><td>{huf(r.cleaning)}</td><td>{huf(r.rent)}</td><td>{huf(r.utilities)}</td><td>{huf(r.otherManual)}</td>
              <td>{huf(r.expense)}</td><td><b>{huf(r.profit)}</b></td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="totalRow">
              <td><b>Összesen</b></td><td>{totals.heldHours}</td><td>{totals.fullHours}</td><td>{totals.participants}</td><td>{num(avg, 2)}</td>
              <td>{huf(totals.revenue)}</td>
              <td>{huf(totals.pos)}</td><td>{huf(totals.trainerCost)}</td><td>{huf(totals.szamlazz)}</td><td>{huf(totals.motibro)}</td>
              <td>{huf(totals.ads)}</td><td>{huf(totals.cleaning)}</td><td>{huf(totals.rent)}</td><td>{huf(totals.utilities)}</td><td>{huf(totals.otherManual)}</td>
              <td>{huf(totals.expense)}</td><td><b>{huf(totals.profit)}</b></td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.length === 0 && <p className="emptyText">Ebben az évben még nincs megjeleníthető adat.</p>}
    </section>
  );
}
