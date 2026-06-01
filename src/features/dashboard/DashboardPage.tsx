"use client";

import { CircleDollarSign, Clock3, CreditCard, LineChart, Star, Users } from 'lucide-react';
import type { AppData, Page } from '../../types';
import { aggregateWeeksForCalendarView, months, monthTotalsForYear, weekTotals } from '../../utils/calculations';
import { getMonthRange, normalizeWeekDates, rangesOverlap } from '../../utils/date';
import { huf, num } from '../../utils/format';
import { StatCard } from '../../components/common/StatCard';
import { RevenueChart } from '../../components/charts/RevenueChart';
import { ExpensePieChart } from '../../components/charts/ExpensePieChart';
import { AnnualActivityChart } from '../../components/charts/AnnualActivityChart';
import { WeeklyFinancialChart } from '../../components/charts/WeeklyFinancialChart';
import { Button } from '../../components/common/Button';

type Props = {
  data: AppData;
  month: string;
  year: number;
  setPage: (page: Page) => void;
};

export function DashboardPage({ data, month, year, setPage }: Props) {
  const selectedMonth = monthTotalsForYear(data.weeks, data.expenses, month, year);
  const monthIndex = months.indexOf(month);
  const isBeforeStudioOpen = year < 2025 || (year === 2025 && monthIndex < months.indexOf('Július'));
  const hasSelectedMonthData = selectedMonth.hasActivity;
  const noMonthDataMessage = isBeforeStudioOpen
    ? 'A stúdió ekkor még nem volt nyitva. Az adatok 2025 júliustól indulnak.'
    : 'Ehhez a hónaphoz még nem elérhető adat.';

  const chartData = months.map(mon => {
    const t = monthTotalsForYear(data.weeks, data.expenses, mon, year);
    const revenue = t.revenue;
    return {
      month: mon.slice(0,3),
      Bevétel: revenue,
      Kiadás: t.expense,
      Profit: t.profit,
      Átlag: Number(t.avg.toFixed(2)),
      Órák: t.heldHours,
      Résztvevők: t.participants,
      hasActivity: t.hasActivity,
    };
  }).filter(d => d.hasActivity);

  const monthRange = getMonthRange(year, month);
  const weeklyFinancialData = aggregateWeeksForCalendarView(data.weeks)
    .map(normalizeWeekDates)
    .filter(week => week.status === 'closed' && rangesOverlap(week.startDate, week.endDate, monthRange.start, monthRange.end))
    .map(week => {
      const totals = weekTotals(week);
      return {
        week: week.week.replaceAll(' ', '\u00a0'),
        Bevétel: totals.revenue,
        Kiadás: totals.expense,
        Profit: totals.profit,
      };
    });

  const annual = chartData.reduce((acc, row) => {
    acc.revenue += row.Bevétel;
    acc.expense += row.Kiadás;
    acc.profit += row.Profit;
    acc.hours += row.Órák;
    acc.participants += row.Résztvevők;
    return acc;
  }, { revenue: 0, expense: 0, profit: 0, hours: 0, participants: 0 });

  const selectedRevenue = selectedMonth.revenue;
  const expensePie = [
    { name: 'Oktatói költség', value: selectedMonth.trainerCost },
    { name: 'POS 2%', value: selectedMonth.pos },
    { name: 'Bérleti díj', value: selectedMonth.rent },
    { name: 'Tisztítószer', value: selectedMonth.cleaning },
    { name: 'Motibro', value: selectedMonth.motibro },
    { name: 'Hirdetés', value: selectedMonth.ads },
    { name: 'Rezsi', value: selectedMonth.utilities },
    { name: 'További változó', value: selectedMonth.otherManual },
  ].filter(e => e.value > 0);

  return (
    <>
      <section className="dashboardSectionHeader">
        <h2>Éves áttekintés - {year}</h2>
        <Button onClick={() => setPage('monthly-summary')}>Éves kimutatás megnyitása</Button>
      </section>

      <section className="statsGrid">
        <StatCard title="Éves bevétel" value={huf(annual.revenue)} icon={CircleDollarSign} hint="eddigi hónapok" />
        <StatCard title="Éves kiadás" value={huf(annual.expense)} icon={CreditCard} hint="összes költség" />
        <StatCard title="Éves profit" value={huf(annual.profit)} icon={LineChart} hint="bevétel - kiadás" />
        <StatCard title="Megtartott órák" value={num(annual.hours, 1)} icon={Clock3} hint="éves összesen" />
        <StatCard title="Résztvevők" value={annual.participants} icon={Users} hint="éves összesen" />
        <StatCard title="Átlag / óra" value={num(annual.hours ? annual.participants / annual.hours : 0, 2)} icon={Star} hint="éves átlag" />
      </section>

      <section className="chartGrid annualTwoCharts">
        <div className="panel wide chartPanelCenter">
          <div className="panelHead"><h3>Éves bevétel, kiadás, profit</h3></div>
          <RevenueChart data={chartData} />
        </div>

        <div className="panel chartPanelCenter">
          <h3>Éves aktivitás</h3>
          <AnnualActivityChart data={chartData} />
        </div>
      </section>

      <section className="dashboardSectionHeader">
        <h2>Kiválasztott hónap - {month} {year}</h2>
      </section>

      {!hasSelectedMonthData ? (
        <section className="panel emptyMonthPanel">
          <h3>Nincs havi adat</h3>
          <p>{noMonthDataMessage}</p>
        </section>
      ) : (
        <>
          <section className="statsGrid">
            <StatCard title="Havi bevétel" value={huf(selectedRevenue)} icon={CircleDollarSign} hint="össz. bevétel" />
            <StatCard title="Havi kiadás" value={huf(selectedMonth.expense)} icon={CreditCard} hint="összes költség" />
            <StatCard title="Havi profit" value={huf(selectedMonth.profit)} icon={LineChart} hint="bevétel - kiadás" />
            <StatCard title="Megtartott órák" value={num(selectedMonth.heldHours, 1)} icon={Clock3} hint="havi összesen" />
            <StatCard title="Résztvevők" value={selectedMonth.participants} icon={Users} hint="havi összesen" />
            <StatCard title="Átlag / óra" value={num(selectedMonth.avg, 2)} icon={Star} hint="havi átlag" />
          </section>

          <section className="chartGrid twoCharts">
            <div className="panel chartPanelCenter">
              <h3>Havi bevétel, kiadás, profit heti bontásban</h3>
              <WeeklyFinancialChart data={weeklyFinancialData} />
            </div>
            <div className="panel chartPanelCenter">
              <h3>{month} költség összetétele</h3>
              <ExpensePieChart data={expensePie} />
            </div>
          </section>
        </>
      )}
    </>
  );
}
