import type { DayRow, Expense, WeekRow } from '../types';
import { safeDiv } from './format';
import { addDays, formatWeekLabel, getMonthNameFromIso, getMondayOfWeek, getMonthRange, getWeekEnd, normalizeWeekDates, rangesOverlap } from './date';

export const months = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

export const dayNames = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'];

/**
 * Creates the seven empty day rows used when a new editable week is started.
 *
 * Each day starts with zeroed totals and empty detail arrays so the day editor
 * can safely append entries, special trainer costs, and extra revenue.
 */
export const createEmptyDays = (): DayRow[] =>
  dayNames.map(day => ({
    id: crypto.randomUUID(),
    day,
    revenue: 0,
    heldHours: 0,
    fullHours: 0,
    participants: 0,
    trainerCost: 0,
    entries: [],
    specialTrainerCosts: [],
    extraRevenues: [],
  }));

/**
 * Recalculates one day after its class/pass entries or cost overrides change.
 *
 * Revenue is built from participant entries plus day-level extra revenue.
 * Trainer cost uses the normal hourly rate for regular hours, the full-house
 * rate for full hours, and then adds any special trainer costs.
 */
export const recalcDay = (
  day: DayRow,
  trainerHourlyCost: number,
  fullHourTrainerCost = 10000
): DayRow => {
  const participantRevenue = day.entries.reduce((sum, entry) => sum + (entry.label === 'Egyéb' ? entry.amount : entry.amount * entry.quantity), 0);
  const extraRevenue = (day.extraRevenues || []).reduce((sum, item) => sum + item.amount, 0);
  const revenue = participantRevenue + extraRevenue;
  const participants = day.entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const fullHours = Math.min(day.fullHours, day.heldHours);
  const regularHours = Math.max(day.heldHours - fullHours, 0);
  const specialTrainerCost = (day.specialTrainerCosts || []).reduce((sum, item) => sum + item.cost, 0);
  return {
    ...day,
    revenue,
    participants,
    trainerCost: regularHours * trainerHourlyCost + fullHours * fullHourTrainerCost + specialTrainerCost,
  };
};

/**
 * Sums already-calculated day rows into one raw activity total.
 *
 * This intentionally does not include week-level legacy fields like expired
 * passes or studio rent; callers decide when those should be added.
 */
export const sumDays = (days: DayRow[]) => ({
  revenue: days.reduce((a, r) => a + r.revenue, 0),
  heldHours: days.reduce((a, r) => a + r.heldHours, 0),
  fullHours: days.reduce((a, r) => a + r.fullHours, 0),
  participants: days.reduce((a, r) => a + r.participants, 0),
  trainerCost: days.reduce((a, r) => a + r.trainerCost, 0),
  extraRevenue: days.reduce((a, r) => a + (r.extraRevenues || []).reduce((sum, item) => sum + item.amount, 0), 0),
});

/**
 * Calculates totals for a full week as one unit.
 *
 * Used by weekly screens where the entire week should stay together. Adds
 * day totals plus week-level extra revenue fields exactly once.
 */
export const weekTotals = (week: WeekRow) => {
  const d = sumDays(week.days);
  const legacyExtraRevenue = week.expiredPasses + week.studioRent;
  const weekExtraRevenue = (week.extraRevenues || []).reduce((sum, item) => sum + item.amount, 0);
  const extraRevenue = d.extraRevenue + legacyExtraRevenue + weekExtraRevenue;
  const revenue = d.revenue + legacyExtraRevenue + weekExtraRevenue;
  const expense = d.trainerCost;
  return {
    ...d,
    revenue,
    extraRevenue,
    expense,
    profit: revenue - expense,
    avg: safeDiv(d.participants, d.heldHours),
  };
};

/**
 * Returns revenue stored on the week instead of on a specific day.
 *
 * Monthly reports use this separately because these values cannot be split by
 * day; the current rule is to count them in the week start month.
 */
const weekLevelExtraRevenue = (week: WeekRow) =>
  week.expiredPasses + week.studioRent + (week.extraRevenues || []).reduce((sum, item) => sum + item.amount, 0);

/**
 * Calculates the part of a week that belongs to one calendar month.
 *
 * A crossing week is split by inferring each day date from `week.startDate`
 * plus the day index. Week-level extra revenue is counted only when the week
 * starts inside the requested month range.
 */
const weekTotalsForMonthRange = (week: WeekRow, range: { start: string; end: string }) => {
  const daysInMonth = week.days.filter((_, index) => {
    const dayDate = addDays(week.startDate, index);
    return dayDate >= range.start && dayDate <= range.end;
  });
  const d = sumDays(daysInMonth);
  const weekExtraRevenue = weekLevelExtraRevenue(week);
  const includeWeekExtraRevenue = week.startDate >= range.start && week.startDate <= range.end;
  const extraRevenue = d.extraRevenue + (includeWeekExtraRevenue ? weekExtraRevenue : 0);
  const revenue = d.revenue + (includeWeekExtraRevenue ? weekExtraRevenue : 0);
  const expense = d.trainerCost;

  return {
    ...d,
    revenue,
    extraRevenue,
    expense,
    profit: revenue - expense,
    avg: safeDiv(d.participants, d.heldHours),
    hasDailyActivity: daysInMonth.length > 0 && (d.revenue > 0 || d.heldHours > 0 || d.fullHours > 0 || d.participants > 0 || d.trainerCost > 0 || d.extraRevenue > 0),
    hasWeekLevelExtraRevenue: includeWeekExtraRevenue && weekExtraRevenue > 0,
  };
};


/**
 * Sums active manual or one-time expenses for one month/year.
 *
 * Pass `category` to limit the result to one expense category, such as ads or
 * utilities. Without a category it returns all manual expenses for the month.
 */
export const getManualExpensesForMonth = (expenses: Expense[], month: string, year: number, category?: string) =>
  expenses
    .filter(e => e.active !== false)
    .filter(e => (e.expenseType === 'monthly-manual' || e.recurrence === 'one-time'))
    .filter(e => e.month === month && e.year === year)
    .filter(e => !category || e.category === category)
    .reduce((sum, e) => sum + e.amount, 0);

/**
 * Finds active fixed monthly expenses matching a predicate.
 *
 * Returns the matched total, or `fallback` when older/missing data does not
 * contain the expected fixed expense row.
 */
export const getNamedFixedExpense = (expenses: Expense[], matcher: (expense: Expense) => boolean, fallback: number) => {
  const total = expenses
    .filter(e => e.active !== false)
    .filter(e => e.expenseType === 'fixed' || e.recurrence === 'monthly')
    .filter(matcher)
    .reduce((sum, e) => sum + e.amount, 0);
  return total || fallback;
};

/**
 * Calculates one month of the annual report for a specific year.
 *
 * Closed weeks are included when they overlap the month, but only the days
 * that actually fall inside the month are summed. Operating expenses are then
 * layered on top to produce total expense, profit, and activity flags.
 */
export const monthTotalsForYear = (weeks: WeekRow[], expenses: Expense[], month: string, year: number) => {
  const range = getMonthRange(year, month);
  const monthWeeks = weeks
    .map(normalizeWeekDates)
    .filter(w => w.status === 'closed' && rangesOverlap(w.startDate, w.endDate, range.start, range.end));

  const totals = monthWeeks.reduce((acc, w) => {
    const t = weekTotalsForMonthRange(w, range);
    acc.revenue += t.revenue;
    acc.heldHours += t.heldHours;
    acc.fullHours += t.fullHours;
    acc.participants += t.participants;
    acc.trainerCost += t.trainerCost;
    acc.extraRevenue += t.extraRevenue;
    acc.hasActivity = acc.hasActivity || t.hasDailyActivity || t.hasWeekLevelExtraRevenue;
    return acc;
  }, { revenue: 0, heldHours: 0, fullHours: 0, participants: 0, trainerCost: 0, extraRevenue: 0, hasActivity: false });

  const pos = totals.revenue * 0.02;
  const rent = getNamedFixedExpense(expenses, e => e.expenseType === 'fixed' && e.category === 'Bérlet' || /bérlet|bérleti/i.test(e.name), 350000);
  const cleaning = getNamedFixedExpense(expenses, e => e.expenseType === 'fixed' && e.category === 'Üzemeltetés' || /tisztító/i.test(e.name), 10000);
  const motibro = getNamedFixedExpense(expenses, e => e.expenseType === 'fixed' && /motibro/i.test(e.name), 21070);
  const szamlazz = getManualExpensesForMonth(expenses, month, year, 'Számlázz.hu');
  const ads = getManualExpensesForMonth(expenses, month, year, 'Hirdetés');
  const utilities = getManualExpensesForMonth(expenses, month, year, 'Rezsi');
  const otherManual = expenses
    .filter(e => e.active !== false)
    .filter(e => (e.expenseType === 'monthly-manual' || e.recurrence === 'one-time'))
    .filter(e => e.month === month && e.year === year)
    .filter(e => !['Számlázz.hu', 'Hirdetés', 'Rezsi'].includes(e.category))
    .reduce((sum, e) => sum + e.amount, 0);

  const operatingExpenses = pos + rent + cleaning + motibro + szamlazz + ads + utilities + otherManual;
  const expense = totals.trainerCost + operatingExpenses;
  const totalRevenue = totals.revenue;

  return {
    ...totals,
    pos,
    rent,
    cleaning,
    motibro,
    szamlazz,
    ads,
    utilities,
    otherManual,
    fixedExpenses: rent + cleaning + motibro,
    operatingExpenses,
    expense,
    profit: totalRevenue - expense,
    avg: safeDiv(totals.participants, totals.heldHours),
    hasActivity: totals.hasActivity || szamlazz > 0 || ads > 0 || utilities > 0 || otherManual > 0,
  };
};

/**
 * Convenience wrapper for older call sites that only provide a month name.
 *
 * It infers the year from the first week with that month, falling back to the
 * current year when no matching week exists.
 */
export const monthTotals = (weeks: WeekRow[], expenses: Expense[], month: string) => {
  const year = weeks.find(w => w.month === month)?.year || new Date().getFullYear();
  return monthTotalsForYear(weeks, expenses, month, year);
};

/**
 * Returns all years represented by the stored weeks.
 *
 * Both start and end years are included so a crossing week near New Year can
 * make both years selectable in the UI.
 */
export const getAvailableYears = (weeks: WeekRow[]) => {
  const years = new Set<number>();
  weeks.map(normalizeWeekDates).forEach(w => {
    years.add(Number(w.startDate.slice(0, 4)));
    years.add(Number(w.endDate.slice(0, 4)));
  });
  return Array.from(years).sort((a, b) => b - a);
};

/**
 * Builds the month rows that should appear in the annual report.
 *
 * The studio starts from July 2025, so that first year hides earlier months.
 * Later years show January through the latest month that has activity.
 */
export const getVisibleMonthsForYear = (weeks: WeekRow[], expenses: Expense[], year: number) => {
  const startIndex = year === 2025 ? 6 : 0; // Július
  const rows = months.map((month, index) => ({ month, index, totals: monthTotalsForYear(weeks, expenses, month, year) }));
  const lastActivityIndex = rows.reduce((last, row) => row.totals.hasActivity ? row.index : last, -1);
  if (lastActivityIndex < startIndex) return [];
  return rows.filter(row => row.index >= startIndex && row.index <= lastActivityIndex);
};


/**
 * Groups week records by calendar week for the weekly summary table.
 *
 * This lets imported historical rows and manually edited rows for the same
 * Monday-Sunday period display as one calendar-week row.
 */
export const aggregateWeeksForCalendarView = (weeks: WeekRow[]): WeekRow[] => {
  const groups = new Map<string, WeekRow[]>();

  weeks.map(normalizeWeekDates).forEach(week => {
    const key = getMondayOfWeek(week.startDate);
    const existing = groups.get(key) || [];
    existing.push(week);
    groups.set(key, existing);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([calendarStart, group]) => {
      const calendarEnd = getWeekEnd(calendarStart);
      const first = group[0];
      const aggregatedDays = group.flatMap(week => week.days);
      return {
        ...first,
        id: `calendar-week-${calendarStart}`,
        week: formatWeekLabel(calendarStart, calendarEnd),
        startDate: calendarStart,
        endDate: calendarEnd,
        year: Number(calendarStart.slice(0, 4)),
        month: getMonthNameFromIso(calendarStart),
        status: group.some(week => week.status === 'open') ? 'open' : 'closed',
        monthClosed: group.every(week => week.monthClosed),
        expiredPasses: group.reduce((sum, week) => sum + week.expiredPasses, 0),
        studioRent: group.reduce((sum, week) => sum + week.studioRent, 0),
        extraRevenues: group.flatMap(week => week.extraRevenues || []),
        note: group.map(week => week.note).filter(Boolean).join(' | '),
        source: group.every(week => week.source === 'summary-import') ? 'summary-import' : 'manual',
        days: aggregatedDays,
      };
    });
};


/**
 * Finds the newest year/month that has report activity.
 *
 * Used by the UI to open dashboards on the latest meaningful period instead
 * of an empty month.
 */
export const getLatestActivityPeriod = (weeks: WeekRow[], expenses: Expense[]) => {
  const years = getAvailableYears(weeks);
  const candidateYears = years.length ? years : [new Date().getFullYear()];

  for (const year of candidateYears.sort((a, b) => b - a)) {
    for (let index = months.length - 1; index >= 0; index--) {
      const month = months[index];
      if (monthTotalsForYear(weeks, expenses, month, year).hasActivity) {
        return { year, month };
      }
    }
  }

  return { year: new Date().getFullYear(), month: months[new Date().getMonth()] };
};
