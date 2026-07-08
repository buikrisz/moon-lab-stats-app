"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Page } from '../types';
import { useAppData } from '../hooks/useAppData';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { WeeklyEntryPage } from '../features/weekly-entry/WeeklyEntryPage';
import { WeeklySummaryPage } from '../features/weekly-summary/WeeklySummaryPage';
import { MonthlySummaryPage } from '../features/monthly-summary/MonthlySummaryPage';
import { PassesPage } from '../features/passes/PassesPage';
import { ExpensesPage } from '../features/expenses/ExpensesPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AuthGate } from '../components/auth/AuthGate';
import { getAvailableYears, getLatestActivityPeriod } from '../utils/calculations';

const pageToPath: Record<Page, string> = {
  dashboard: '/dashboard',
  'weekly-entry': '/heti-rogzites',
  'weekly-summary': '/heti-lebontas',
  'monthly-summary': '/eves-kimutatasok',
  passes: '/berletek-arak',
  expenses: '/koltsegek',
  settings: '/beallitasok',
};

const pathToPage: Record<string, Page> = Object.entries(pageToPath).reduce((acc, [page, path]) => {
  acc[path] = page as Page;
  return acc;
}, {} as Record<string, Page>);

function AuthenticatedAppShell() {
  const { data, isLoading, isSaving, error, setWeeks, setPasses, setExpenses, setSettings, replaceDataFromServer } = useAppData();
  const pathname = usePathname();
  const router = useRouter();

  const page = pathToPage[pathname] || 'dashboard';
  const setPage = (nextPage: Page) => router.push(pageToPath[nextPage]);

  const [month, setMonth] = useState('Február');
  const [year, setYear] = useState(2026);
  const [defaultPeriodInitialized, setDefaultPeriodInitialized] = useState(false);
  const openWeek = data?.weeks.find(w => w.status === 'open');
  const [selectedWeekId, setSelectedWeekId] = useState<string | undefined>(undefined);
  const [pendingSelectedWeekId, setPendingSelectedWeekId] = useState<string | undefined>(undefined);
  const [urlWeekId, setUrlWeekId] = useState<string | undefined>(undefined);

  const years = useMemo(() => data ? getAvailableYears(data.weeks) : [year], [data, year]);

  useEffect(() => {
    if (!data || defaultPeriodInitialized) return;
    const latest = getLatestActivityPeriod(data.weeks, data.expenses);
    setYear(latest.year);
    setMonth(latest.month);
    setDefaultPeriodInitialized(true);
  }, [data, defaultPeriodInitialized]);

  useEffect(() => {
    if (page !== 'weekly-entry' || !pendingSelectedWeekId) return;
    setSelectedWeekId(pendingSelectedWeekId);
    setPendingSelectedWeekId(undefined);
  }, [page, pendingSelectedWeekId]);

  useEffect(() => {
    if (!data || page !== 'weekly-entry') return;
    const weekIdFromUrl = new URLSearchParams(window.location.search).get('weekId') || undefined;
    setUrlWeekId(weekIdFromUrl);
    if (!weekIdFromUrl) return;

    const target = data.weeks.find(week => week.id === weekIdFromUrl);
    if (!target) return;
    setSelectedWeekId(target.id);
    setYear(Number(target.startDate.slice(0, 4)));
    setUrlWeekId(undefined);
  }, [data, page, pathname]);

  if (isLoading) return <div className="loadingScreen">Adatok betöltése MongoDB-ből...</div>;
  if (error || !data) return <div className="loadingScreen error">{error || 'Nincs adat.'}</div>;

  const activeWeekId = selectedWeekId || urlWeekId || openWeek?.id || data.weeks[0]?.id;
  const displayedYears = years.includes(year) ? years : [year, ...years].sort((a, b) => b - a);

  const routeComponents: Record<Page, () => ReactNode> = {
    dashboard: () => <DashboardPage data={data} month={month} year={year} setPage={setPage} />,
    'weekly-entry': () => (
      <WeeklyEntryPage
        weeks={data.weeks}
        setWeeks={setWeeks}
        passes={data.passes}
        settings={data.settings}
        selectedWeekId={activeWeekId}
        setSelectedWeekId={setSelectedWeekId}
        selectedYear={year}
        setSelectedYear={setYear}
      />
    ),
    'weekly-summary': () => (
      <WeeklySummaryPage
        weeks={data.weeks}
        setWeeks={setWeeks}
        selectedMonth={month}
        selectedYear={year}
        setSelectedYear={setYear}
        setSelectedMonth={setMonth}
        setSelectedWeekId={setSelectedWeekId}
        setPendingSelectedWeekId={setPendingSelectedWeekId}
        setPage={setPage}
      />
    ),
    'monthly-summary': () => <MonthlySummaryPage weeks={data.weeks} expenses={data.expenses} selectedYear={year} />,
    passes: () => <PassesPage passes={data.passes} setPasses={setPasses} />,
    expenses: () => (
      <ExpensesPage
        expenses={data.expenses}
        setExpenses={setExpenses}
        variableCategories={data.settings.variableExpenseCategories || ['Számlázz.hu', 'Hirdetés', 'Rezsi']}
        selectedYear={year}
        selectedMonth={month}
        setSelectedYear={setYear}
        setSelectedMonth={setMonth}
      />
    ),
    settings: () => <SettingsPage settings={data.settings} setSettings={setSettings} onDataRestored={replaceDataFromServer} />,
  };

  const activeRoute = (routeComponents[page] || routeComponents.dashboard)();

  return (
    <div className="app">
      <Sidebar
        page={page}
        setPage={setPage}
        currentWeek={openWeek}
        onCurrentWeekClick={() => {
          if (openWeek) setSelectedWeekId(openWeek.id);
          setPage('weekly-entry');
        }}
      />
      <main>
        <Header page={page} setPage={setPage} month={month} setMonth={setMonth} year={year} setYear={setYear} years={displayedYears} isSaving={isSaving} />

        {activeRoute}
      </main>
    </div>
  );
}


export default function AppShell() {
  return (
    <AuthGate>
      <AuthenticatedAppShell />
    </AuthGate>
  );
}
