export const huMonths = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
];

export const toIsoDate = (date: Date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const parseIsoDate = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const isMonday = (iso: string) => parseIsoDate(iso).getDay() === 1;

export const addDays = (iso: string, days: number) => {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

export const getWeekEnd = (mondayIso: string) => addDays(mondayIso, 6);

export const getMonthNameFromIso = (iso: string) => huMonths[parseIsoDate(iso).getMonth()];

export const getYearFromIso = (iso: string) => parseIsoDate(iso).getFullYear();

export const formatDateLabel = (iso: string) => {
  const date = parseIsoDate(iso);
  return `${huMonths[date.getMonth()]} ${date.getDate()}`;
};

export const formatWeekLabel = (startIso: string, endIso = getWeekEnd(startIso)) =>
  `${formatDateLabel(startIso)} - ${formatDateLabel(endIso)}`;

export const getMondayOfWeek = (iso: string) => {
  const date = parseIsoDate(iso);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toIsoDate(date);
};

export const getMonthRange = (year: number, monthName: string) => {
  const monthIndex = huMonths.indexOf(monthName);
  const start = toIsoDate(new Date(year, monthIndex, 1));
  const end = toIsoDate(new Date(year, monthIndex + 1, 0));
  return { start, end };
};

export const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart <= bEnd && aEnd >= bStart;

export const normalizeWeekDates = <T extends { startDate?: string; endDate?: string; week: string; year: number; month: string }>(week: T): T & { startDate: string; endDate: string } => {
  if (week.startDate && week.endDate) return week as T & { startDate: string; endDate: string };

  const fallbackMonthIndex = Math.max(0, huMonths.indexOf(week.month));
  const fallback = toIsoDate(new Date(week.year, fallbackMonthIndex, 1));
  const startDate = getMondayOfWeek(fallback);
  return { ...week, startDate, endDate: getWeekEnd(startDate) };
};


export const getCalendarWeekKey = (iso: string) => getMondayOfWeek(iso);

export const formatCalendarWeekLabel = (iso: string) => {
  const start = getMondayOfWeek(iso);
  return formatWeekLabel(start, getWeekEnd(start));
};
