'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Download, FileUp, RefreshCw, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GuestRecord } from '../../types/guest';
import { parseGuestWorkbook } from '../../utils/guestExcel';
import { parseGuestActivityWorkbook } from '../../utils/guestActivityExcel';
import type { GuestActivityImport, GuestPurchase, GuestVisit } from '../../types/guest';

type Section = 'overview' | 'registration' | 'attendance' | 'courses' | 'guest-list' | 'guest-stats' | 'comparison' | 'import';
type GuestSortKey = 'guestId' | 'lastName' | 'firstName' | 'registeredAt' | 'firstVisitAt' | 'lastVisitAt' | 'courses' | 'activeMembership';
type AnalysisSortKey = 'name' | 'source' | 'attendedCount' | 'firstVisit' | 'lastVisit' | 'ticketCount' | 'passCount' | 'paidTotal' | 'status';
const isPassPurchase = (purchase: GuestPurchase) => /bérlet/i.test(purchase.name) && purchase.sessionCount > 1 && !/magánóra/i.test(purchase.name);
const isCountedPassPurchase = (purchase: GuestPurchase) => isPassPurchase(purchase) && (purchase.listPrice > 0 || purchase.paidPrice > 0);
const isTicketPurchase = (purchase: GuestPurchase) => purchase.category === 'ticket' && !/magánóra/i.test(purchase.name);
const isWorkshopVisit = (visit: GuestVisit) => /work\s?shop/i.test(`${visit.courseName} ${visit.className}`);
const passSize = (purchase: GuestPurchase) => /10\s*alkalmas/i.test(purchase.name) || purchase.sessionCount === 10 ? 10 : /5\s*alkalmas/i.test(purchase.name) || purchase.sessionCount === 5 ? 5 : 0;
const passBaseline = (purchase: GuestPurchase) => {
  if (passSize(purchase) === 10) return 60000;
  if (passSize(purchase) === 5) return 32000;
  return purchase.listPrice || 0;
};
const friendPassPrice = (purchase: GuestPurchase) => {
  const size = passSize(purchase);
  if (size === 5 && purchase.paidPrice === 25000) return 'friend';
  if (size === 10 && purchase.paidPrice === 50000) return 'friend';
  if (size === 5 && purchase.paidPrice === 15000) return 'superFriend';
  if (size === 10 && purchase.paidPrice === 30000) return 'superFriend';
  return null;
};
const passCategoryPrice = (purchase: GuestPurchase) => friendPassPrice(purchase) ? purchase.paidPrice : purchase.listPrice > 0 ? purchase.listPrice : purchase.paidPrice;
const passPriceCategory = (purchase: GuestPurchase) => {
  if (purchase.listPrice <= 0 && purchase.paidPrice <= 0) return 'free';
  const friendCategory = friendPassPrice(purchase);
  if (friendCategory) return friendCategory;
  const size = passSize(purchase);
  const price = purchase.listPrice > 0 ? purchase.listPrice : purchase.paidPrice;
  const priceMap: Record<number, string> = size === 5
    ? { 32000: 'original', 30400: 'fivePercent', 28800: 'tenPercent', 27200: 'fifteenPercent', 25600: 'twentyPercent', 25000: 'friend', 15000: 'superFriend' }
    : size === 10
      ? { 60000: 'original', 57000: 'fivePercent', 54000: 'tenPercent', 51000: 'fifteenPercent', 48000: 'twentyPercent', 50000: 'friend', 30000: 'superFriend' }
      : {};
  const exact = Object.entries(priceMap).find(([amount]) => Math.abs(Number(amount) - price) <= 1);
  if (exact) return exact[1];
  if (!size && purchase.listPrice > 0 && price >= purchase.listPrice) return 'original';
  return 'other';
};
const sections: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Áttekintés' }, { id: 'registration', label: 'Regisztrációk' },
  { id: 'attendance', label: 'Óralátogatás' }, { id: 'courses', label: 'Kurzusok' },
  { id: 'guest-list', label: 'Vendéglista' }, { id: 'guest-stats', label: 'Vendégelemzés' }, { id: 'comparison', label: 'Összehasonlítás' }, { id: 'import', label: 'Excel import' },
];
const monthName = (month: string) => new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'short' }).format(new Date(`${month}-01T12:00:00`));
const monthLabels = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: new Intl.DateTimeFormat('hu-HU', { month: 'long' }).format(new Date(2025, i, 1)) }));

function periodSummary(records: GuestRecord[], visits: GuestVisit[] = []) {
  const registered = records.filter(g => g.registeredAt);
  const attendedIds = new Set(visits.filter(visit => visit.attended).map(visit => visit.guestId));
  const attended = registered.filter(g => g.firstVisitAt || g.lastVisitAt || attendedIds.has(g.guestId));
  return { registrations: registered.length, attended: attended.length, rate: registered.length ? attended.length / registered.length * 100 : 0 };
}

function Change({ current, previous, percent = false }: { current: number; previous: number; percent?: boolean }) {
  const difference = current - previous;
  const relative = previous ? difference / previous * 100 : null;
  return <span className={`guestChange ${difference > 0 ? 'up' : difference < 0 ? 'down' : ''}`}>
    {difference > 0 ? '+' : ''}{percent ? `${difference.toFixed(1)} százalékpont` : difference}
    {relative !== null && !percent ? ` (${relative > 0 ? '+' : ''}${relative.toFixed(1)}%)` : ''}
  </span>;
}

export function GuestsPage() {
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [visits, setVisits] = useState<GuestVisit[]>([]);
  const [purchases, setPurchases] = useState<GuestPurchase[]>([]);
  const [activityImports, setActivityImports] = useState<GuestActivityImport[]>([]);
  const [familyIds, setFamilyIds] = useState<string[]>([]);
  const [influencerIds, setInfluencerIds] = useState<string[]>([]);
  const [familyIdInput, setFamilyIdInput] = useState('');
  const [influencerIdInput, setInfluencerIdInput] = useState('');
  const [excludeFamily, setExcludeFamily] = useState(false);
  const [excludeInfluencers, setExcludeInfluencers] = useState(false);
  const [segmentBusy, setSegmentBusy] = useState(false);
  const [segmentMessage, setSegmentMessage] = useState('');
  const [segmentError, setSegmentError] = useState('');
  const [section, setSection] = useState<Section>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activityBusy, setActivityBusy] = useState(false);
  const [sourceChartMode, setSourceChartMode] = useState(false);
  const [analysisTab, setAnalysisTab] = useState<'list' | 'insights'>('list');
  const [analysisStatus, setAnalysisStatus] = useState('all');
  const [analysisPurchases, setAnalysisPurchases] = useState('all');
  const [analysisSource, setAnalysisSource] = useState('all');
  const [analysisSortKey, setAnalysisSortKey] = useState<AnalysisSortKey>('lastVisit');
  const [analysisSortDirection, setAnalysisSortDirection] = useState<'asc' | 'desc'>('desc');
  const [lapseThreshold, setLapseThreshold] = useState(60);
  const [sortKey, setSortKey] = useState<GuestSortKey>('guestId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [periodMode, setPeriodMode] = useState<'all' | 'year' | 'month'>('all');
  const [periodYear, setPeriodYear] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [compareYearA, setCompareYearA] = useState('');
  const [compareMonthA, setCompareMonthA] = useState('');
  const [compareYearB, setCompareYearB] = useState('');
  const [compareMonthB, setCompareMonthB] = useState('');
  const [compareAnnualA, setCompareAnnualA] = useState('');
  const [compareAnnualB, setCompareAnnualB] = useState('');
  const [comparisonDefaultsReady, setComparisonDefaultsReady] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [guestResponse, activityResponse, segmentResponse] = await Promise.all([
        fetch('/api/guests', { cache: 'no-store' }), fetch('/api/guest-activity', { cache: 'no-store' }), fetch('/api/guest-segments', { cache: 'no-store' }),
      ]);
      const [guestData, activityData, segmentData] = await Promise.all([guestResponse.json(), activityResponse.json(), segmentResponse.json()]);
      if (!guestResponse.ok) throw new Error(guestData.error || 'Nem sikerült betölteni a vendégeket.');
      if (!activityResponse.ok) throw new Error(activityData.error || 'Nem sikerült betölteni az óra- és vásárlási adatokat.');
      if (!segmentResponse.ok) throw new Error(segmentData.error || 'Nem sikerült betölteni a csoportlistákat.');
      setGuests(guestData); setVisits(activityData.visits || []); setPurchases(activityData.purchases || []); setActivityImports(activityData.imports || []);
      setFamilyIds(segmentData.familyIds || []); setInfluencerIds(segmentData.influencerIds || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Betöltési hiba.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);

  const saveSegmentLists = async (nextFamilyIds: string[], nextInfluencerIds: string[]) => {
    setSegmentBusy(true); setSegmentError(''); setSegmentMessage('');
    try {
      const response = await fetch('/api/guest-segments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ familyIds: nextFamilyIds, influencerIds: nextInfluencerIds }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Nem sikerült menteni a listákat.');
      setFamilyIds(result.familyIds); setInfluencerIds(result.influencerIds);
      setSegmentMessage('A család- és influencerlista elmentve.');
    } catch (e) { setSegmentError(e instanceof Error ? e.message : 'Nem sikerült menteni a listákat.'); }
    finally { setSegmentBusy(false); }
  };
  const addSegmentId = async (segment: 'family' | 'influencer') => {
    const id = (segment === 'family' ? familyIdInput : influencerIdInput).trim();
    const current = segment === 'family' ? familyIds : influencerIds;
    if (!id || current.includes(id) || segmentBusy) return;
    const nextFamilyIds = segment === 'family' ? [...familyIds, id] : familyIds;
    const nextInfluencerIds = segment === 'influencer' ? [...influencerIds, id] : influencerIds;
    if (segment === 'family') setFamilyIdInput(''); else setInfluencerIdInput('');
    void saveSegmentLists(nextFamilyIds, nextInfluencerIds);
  };
  const removeSegmentId = (segment: 'family' | 'influencer', id: string) => {
    if (segmentBusy) return;
    const nextFamilyIds = segment === 'family' ? familyIds.filter(value => value !== id) : familyIds;
    const nextInfluencerIds = segment === 'influencer' ? influencerIds.filter(value => value !== id) : influencerIds;
    void saveSegmentLists(nextFamilyIds, nextInfluencerIds);
  };

  const availableYears = useMemo(() => [...new Set(guests.flatMap(g => g.registeredAt ? [Number(g.registeredAt.slice(0, 4))] : []))].sort((a, b) => b - a), [guests]);
  const guestById = useMemo(() => new Map(guests.map(guest => [guest.guestId, guest])), [guests]);
  const excludedGuestIds = useMemo(() => new Set([...(excludeFamily ? familyIds : []), ...(excludeInfluencers ? influencerIds : [])]), [excludeFamily, excludeInfluencers, familyIds, influencerIds]);
  const visibleGuests = useMemo(() => guests.filter(guest => !excludedGuestIds.has(guest.guestId)), [guests, excludedGuestIds]);
  const latestMonth = useMemo(() => guests.map(g => g.registeredAt?.slice(0, 7)).filter((v): v is string => Boolean(v)).sort().at(-1) || '', [guests]);
  const latestCompleteActivityImport = [...activityImports].filter(item => {
    const start = item.periodStart.match(/^(\d{4})-(\d{2})-01$/);
    if (!start) return false;
    const lastDay = new Date(Date.UTC(Number(start[1]), Number(start[2]), 0)).getUTCDate();
    return item.periodEnd === `${start[1]}-${start[2]}-${String(lastDay).padStart(2, '0')}`;
  }).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
  const analysisAsOfDate = latestCompleteActivityImport?.periodEnd || new Date().toISOString().slice(0, 10);
  const analysisAsOfMs = new Date(analysisAsOfDate + 'T00:00:00Z').getTime();
  useEffect(() => {
    if (!latestMonth || comparisonDefaultsReady) return;
    const [latestYear, latestMonthValue] = latestMonth.split('-');
    setPeriodYear(latestYear); setPeriodMonth(latestMonthValue);
    setCompareYearA(latestYear); setCompareMonthA(latestMonthValue);
    setCompareYearB(String(Number(latestYear) - 1)); setCompareMonthB(latestMonthValue);
    setCompareAnnualA(latestYear); setCompareAnnualB(String(Number(latestYear) - 1));
    setComparisonDefaultsReady(true);
  }, [latestMonth, comparisonDefaultsReady]);

  const periodGuests = useMemo(() => visibleGuests.filter(g => {
    if (!g.registeredAt || periodMode === 'all') return periodMode === 'all';
    if (periodMode === 'year') return g.registeredAt.startsWith(periodYear);
    return g.registeredAt.startsWith(`${periodYear}-${periodMonth}`);
  }), [visibleGuests, periodMode, periodYear, periodMonth]);
  const periodSummaryValue = periodSummary(periodGuests, visits);

  const isSelectedActivityPeriod = (date: string) => periodMode === 'all' || (periodMode === 'year' ? date.startsWith(periodYear) : date.startsWith(periodYear + '-' + periodMonth));
  const visibleGuestIds = new Set(visibleGuests.map(g => g.guestId));
  const selectedVisitRows = visits.filter(v => visibleGuestIds.has(v.guestId) && isSelectedActivityPeriod(v.startsAt));
  const selectedReportingVisitRows = selectedVisitRows.filter(visit => !isWorkshopVisit(visit));
  const courseVisitGroups = new Map<string, { count: number; guests: Set<string> }>();
  selectedReportingVisitRows.filter(v => v.attended).forEach(v => { const name = v.courseName || v.className || 'Nincs kurzusadat'; const item = courseVisitGroups.get(name) || { count: 0, guests: new Set<string>() }; item.count++; item.guests.add(v.guestId); courseVisitGroups.set(name, item); });
  const courseStats = [...courseVisitGroups].map(([course, item]) => ({ course, count: item.guests.size, visits: item.count })).sort((x, y) => y.visits - x.visits);
  const hasRegistrationDate = periodGuests.filter(g => g.registeredAt);
  const filtered = periodGuests.filter(g => `${g.guestId} ${g.lastName} ${g.firstName} ${g.nickname}`.toLocaleLowerCase('hu').includes(query.toLocaleLowerCase('hu')));
  const sourceNames = [...new Set(periodGuests.map(g => g.registrationSource?.trim() || 'Nincs adat az exportokban'))].sort((a, b) => a.localeCompare(b, 'hu'));
  const sourcePalette = ['#437f5a', '#5386bd', '#d29b43', '#9864a8', '#d16b52', '#49a6a0', '#7d8b47', '#a46c4e'];
  const sourceSeries = sourceNames.map((name, index) => ({ name, key: `forras${index}`, registeredKey: `regisztralt${index}`, attendedKey: `oraraJott${index}`, color: sourcePalette[index % sourcePalette.length] }));
  const sourceKeyByName = new Map(sourceSeries.map(item => [item.name, item]));
  const registrationSourceDistribution = sourceSeries.map(source => ({ name: source.name, count: hasRegistrationDate.filter(g => (g.registrationSource?.trim() || 'Nincs adat az exportokban') === source.name).length, color: source.color })).filter(item => item.count > 0);
  const eventCounts = new Map<string, number>();
  const attendedGuestIds = new Set<string>();
  const visitDates = new Map<string, string[]>();
  const debtGuestIds = new Set<string>();
  visits.forEach(visit => {
    if (visit.attended) {
      eventCounts.set(visit.guestId, (eventCounts.get(visit.guestId) || 0) + 1);
      attendedGuestIds.add(visit.guestId);
      visitDates.set(visit.guestId, [...(visitDates.get(visit.guestId) || []), visit.startsAt]);
    }
    if (visit.hasDebt) debtGuestIds.add(visit.guestId);
  });
  const guestPurchases = new Map<string, GuestPurchase[]>();
  purchases.forEach(purchase => guestPurchases.set(purchase.guestId, [...(guestPurchases.get(purchase.guestId) || []), purchase]));
  const cohortIds = new Set(periodGuests.map(g => g.guestId));
  const periodAttendedGuestCount = periodGuests.filter(g => attendedGuestIds.has(g.guestId) || g.firstVisitAt || g.lastVisitAt).length;
  const registeredPeriodAttendedGuestCount = hasRegistrationDate.filter(g => attendedGuestIds.has(g.guestId) || g.firstVisitAt || g.lastVisitAt).length;
  const periodAttendanceCount = visits.filter(v => v.attended && cohortIds.has(v.guestId)).length;
  const periodNoShowCount = visits.filter(v => !v.attended && cohortIds.has(v.guestId)).length;
  const passPurchases = purchases.filter(p => isCountedPassPurchase(p) && cohortIds.has(p.guestId));
  const ticketPurchases = purchases.filter(p => isTicketPurchase(p) && cohortIds.has(p.guestId));
  const repeatGuestCount = periodGuests.filter(g => (eventCounts.get(g.guestId) || ((g.firstVisitAt || g.lastVisitAt) ? 1 : 0)) > 1).length;
  const registeredRepeatGuestCount = hasRegistrationDate.filter(g => (eventCounts.get(g.guestId) || ((g.firstVisitAt || g.lastVisitAt) ? 1 : 0)) > 1).length;
  const lapsedGuestCount = periodGuests.filter(g => {
    const dates = visitDates.get(g.guestId) || (g.lastVisitAt ? [g.lastVisitAt] : []);
    if (!dates.length) return false;
    const latest = [...dates].sort().at(-1) || '';
    return (analysisAsOfMs - new Date(latest.slice(0, 10) + 'T00:00:00Z').getTime()) / 86400000 > lapseThreshold;
  }).length;
  const ticketBuyerCount = new Set(ticketPurchases.map(p => p.guestId)).size;
  const passBuyerCount = new Set(passPurchases.map(p => p.guestId)).size;
  const ticketPurchaseCount = ticketPurchases.length;
  const passPurchaseCount = passPurchases.length;
  const analyticsRows = periodGuests.map(guest => {
    const dates = [...(visitDates.get(guest.guestId) || []), ...(guest.firstVisitAt ? [guest.firstVisitAt] : []), ...(guest.lastVisitAt ? [guest.lastVisitAt] : [])].sort();
    const guestTickets = guestPurchases.get(guest.guestId) || [];
    const attendedCount = eventCounts.get(guest.guestId) || ((guest.firstVisitAt || guest.lastVisitAt) ? 1 : 0);
    const lastVisit = dates.at(-1)?.slice(0, 10) || '';
    const daysSinceLastVisit = lastVisit ? (analysisAsOfMs - new Date(lastVisit + 'T00:00:00Z').getTime()) / 86400000 : null;
    const status = attendedCount === 0 ? 'Még nem járt' : daysSinceLastVisit !== null && daysSinceLastVisit > lapseThreshold ? 'Lemorzsolódott' : 'Aktív';
    return { guest, attendedCount, firstVisit: dates[0]?.slice(0, 10) || guest.firstVisitAt || '', lastVisit, ticketCount: guestTickets.filter(isTicketPurchase).length, passCount: guestTickets.filter(isCountedPassPurchase).length, paidTotal: guestTickets.reduce((sum, p) => sum + p.paidPrice, 0), status, hasDebt: debtGuestIds.has(guest.guestId) };
  });
  const passPriceCategories = [
    { key: 'original', name: 'Eredeti ár', color: '#789b76' },
    { key: 'fivePercent', name: '5%', color: '#9ba86a' },
    { key: 'tenPercent', name: '10%', color: '#9eb979' },
    { key: 'fifteenPercent', name: '15%', color: '#77aeb0' },
    { key: 'twentyPercent', name: '20%', color: '#5386bd' },
    { key: 'friend', name: 'Baráti', color: '#d29b43' },
    { key: 'superFriend', name: 'Szuper baráti', color: '#d16b52' },
  ];
  const passKinds = [
    { name: '5 alkalmas', size: 5 }, { name: '10 alkalmas', size: 10 },
  ].map(kind => {
    const matching = passPurchases.filter(p => passSize(p) === kind.size);
    return { name: kind.name, count: matching.length, ...Object.fromEntries(passPriceCategories.map(category => [category.key, matching.filter(p => passPriceCategory(p) === category.key).length])) };
  });
  const visiblePassPriceCategories = passPriceCategories.filter(category => passPurchases.some(p => passSize(p) !== 0 && passPriceCategory(p) === category.key));
  const discountedPasses = passPurchases.map(p => {
    const baseline = passBaseline(p);
    const categoryPrice = passCategoryPrice(p);
    return { purchase: p, percent: baseline > 0 ? Math.max(0, (baseline - categoryPrice) / baseline * 100) : 0, category: passPriceCategory(p) };
  }).filter(item => item.category !== 'original' && item.category !== 'free');
  const discountCategoryStats = passPriceCategories.filter(category => category.key !== 'original').map(category => ({
    ...category,
    count: passPurchases.filter(p => passPriceCategory(p) === category.key).length,
  })).filter(category => category.count > 0);
  const discountCounts = [
    { name: 'Teljes ár', count: passPurchases.filter(p => passPriceCategory(p) === 'original').length, color: '#789b76' },
    { name: 'Kedvezményes', count: discountedPasses.length, color: '#d29b43' },
  ];
  const averageDiscountPercent = discountedPasses.length ? discountedPasses.reduce((sum, item) => sum + item.percent, 0) / discountedPasses.length : 0;
  const registeredAnalytics = analyticsRows.filter(row => row.guest.registeredAt);
  const sourceVisitConversion = sourceSeries.map(source => {
    const registrations = registeredAnalytics.filter(row => (row.guest.registrationSource?.trim() || 'Nincs adat az exportokban') === source.name);
    const attended = registrations.filter(row => row.attendedCount > 0).length;
    return { name: source.name, registrations: registrations.length, attended, rate: registrations.length ? attended / registrations.length * 100 : 0, color: source.color };
  }).filter(source => source.registrations > 0);
  const registrationMs = (value: string) => Date.parse(value.slice(0, 10) + 'T00:00:00Z');
  const daysBetween = (start: string, end: string) => Math.floor((registrationMs(end) - registrationMs(start)) / 86400000);
  const retentionWindows = [30, 60, 90].map(days => {
    const eligible = registeredAnalytics.filter(row => daysBetween(row.guest.registeredAt || '', analysisAsOfDate) >= days);
    const converted = eligible.filter(row => (visitDates.get(row.guest.guestId) || []).some(date => { const age = daysBetween(row.guest.registeredAt || '', date); return age >= 0 && age <= days; }));
    return { days, eligible: eligible.length, converted: converted.length, rate: eligible.length ? converted.length / eligible.length * 100 : 0 };
  });
  const repeatWindowStats = [30, 60, 90].map(days => {
    const eligible = registeredAnalytics.filter(row => { const dates = [...(visitDates.get(row.guest.guestId) || [])].sort(); return dates.length >= 1 && daysBetween(dates[0], analysisAsOfDate) >= days; });
    const returned = eligible.filter(row => { const dates = [...(visitDates.get(row.guest.guestId) || [])].sort(); return dates.length >= 2 && daysBetween(dates[0], dates[1]) <= days; });
    return { days, eligible: eligible.length, returned: returned.length, rate: eligible.length ? returned.length / eligible.length * 100 : 0 };
  });
  const secondVisitIntervals = registeredAnalytics.flatMap(row => { const dates = [...(visitDates.get(row.guest.guestId) || [])].sort(); return dates.length >= 2 ? [daysBetween(dates[0], dates[1])] : []; });
  const averageSecondVisitDays = secondVisitIntervals.length ? secondVisitIntervals.reduce((sum, days) => sum + days, 0) / secondVisitIntervals.length : null;
  const reactivatedGuestCount = registeredAnalytics.filter(row => { const dates = [...(visitDates.get(row.guest.guestId) || [])].map(date => date.slice(0,10)).sort(); return dates.some((date, i) => i > 0 && daysBetween(dates[i-1], date) > lapseThreshold); }).length;
  const sourceFunnel = sourceSeries.map(source => {
    const cohort = registeredAnalytics.filter(row => (row.guest.registrationSource?.trim() || 'Nincs adat az exportokban') === source.name);
    const attended = cohort.filter(row => row.attendedCount > 0);
    const eligible30 = cohort.filter(row => daysBetween(row.guest.registeredAt || '', analysisAsOfDate) >= 30);
    const attended30 = eligible30.filter(row => (visitDates.get(row.guest.guestId) || []).some(date => { const age = daysBetween(row.guest.registeredAt || '', date); return age >= 0 && age <= 30; }));
    const repeat = cohort.filter(row => (eventCounts.get(row.guest.guestId) || 0) >= 2);
    const ticket = cohort.filter(row => (guestPurchases.get(row.guest.guestId) || []).some(isTicketPurchase));
    const pass = cohort.filter(row => (guestPurchases.get(row.guest.guestId) || []).some(isCountedPassPurchase));
    return { name: source.name, registrations: cohort.length, attended: attended.length, eligible30: eligible30.length, attended30: attended30.length, rate30: eligible30.length ? attended30.length / eligible30.length * 100 : 0, repeat: repeat.length, ticket: ticket.length, pass: pass.length, color: source.color };
  }).filter(row => row.registrations > 0);
  const paidTicketTotal = ticketPurchases.reduce((sum, p) => sum + p.paidPrice, 0);
  const paidPassTotal = passPurchases.reduce((sum, p) => sum + p.paidPrice, 0);
  const cohortRevenuePerGuest = periodGuests.length ? (paidTicketTotal + paidPassTotal) / periodGuests.length : 0;
  const ticketRevenueByGuest = new Set(ticketPurchases.map(p => p.guestId)).size;
  const passRevenueByGuest = new Set(passPurchases.map(p => p.guestId)).size;
  const revenueStats = [
    { name: 'Jegyek', purchases: ticketPurchases.length, buyers: ticketRevenueByGuest, revenue: paidTicketTotal, average: ticketRevenueByGuest ? paidTicketTotal / ticketRevenueByGuest : 0 },
    { name: 'B\u00e9rletek', purchases: passPurchases.length, buyers: passRevenueByGuest, revenue: paidPassTotal, average: passRevenueByGuest ? paidPassTotal / passRevenueByGuest : 0 },
  ];
  const discountRevenueStats = passPriceCategories.map(category => { const matches = passPurchases.filter(p => passSize(p) > 0 && passPriceCategory(p) === category.key); return { ...category, count: matches.length, revenue: matches.reduce((sum, p) => sum + p.paidPrice, 0) }; }).filter(row => row.count > 0);
  const groupVisitRows = (keyFor: (visit: GuestVisit) => string) => {
    const groups = new Map<string, { bookings: number; attended: number; guests: Set<string> }>();
    selectedReportingVisitRows.forEach(v => { const key = keyFor(v).trim() || 'Nincs adat'; const row = groups.get(key) || { bookings: 0, attended: 0, guests: new Set<string>() }; row.bookings++; if (v.attended) { row.attended++; row.guests.add(v.guestId); } groups.set(key, row); });
    return [...groups].map(([name, row]) => ({ name, ...row, uniqueGuests: row.guests.size, showRate: row.bookings ? row.attended / row.bookings * 100 : 0 })).sort((a,b) => b.bookings-a.bookings);
  };
  const courseAttendanceStats = groupVisitRows(v => v.courseName || v.className);
  const instructorAttendanceStats = groupVisitRows(v => v.instructor);
  const weekdayLabels = ['Vas\u00e1rnap', 'H\u00e9tf\u0151', 'Kedd', 'Szerda', 'Cs\u00fct\u00f6rt\u00f6k', 'P\u00e9ntek', 'Szombat'];
  const weekdayAttendanceStats = groupVisitRows(v => weekdayLabels[new Date(v.startsAt).getDay()] || 'Nincs adat');
  const hourlyAttendanceStats = groupVisitRows(v => { const hour = new Date(v.startsAt).getHours(); return Number.isFinite(hour) ? String(hour).padStart(2,'0') + ':00' : 'Nincs adat'; }).sort((a,b) => a.name.localeCompare(b.name));

  const attendanceDistribution = (labels: string[], counts: Map<string, number>) => { const total = [...counts.values()].reduce((sum, count) => sum + count, 0); return labels.map(name => ({ name, count: counts.get(name) || 0, share: total ? (counts.get(name) || 0) / total * 100 : 0 })); };
  const attendedInSelectedPeriod = selectedReportingVisitRows.filter(v => v.attended);
  const monthNames = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('hu-HU', { month: 'long' }).format(new Date(2025, i, 1)));
  const monthCounts = new Map<string, number>(); const thirdCounts = new Map<string, number>();
  const weekdayOrder = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'];
  const weekdayCounts = new Map<string, number>(); const weekPartCounts = new Map<string, number>(); const dayPartCounts = new Map<string, number>(); const hourCounts = new Map<string, number>();
  attendedInSelectedPeriod.forEach(visit => {
    const date = new Date(visit.startsAt); const month = monthNames[date.getMonth()]; const day = date.getDate(); const hour = date.getHours();
    monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    const third = day <= 10 ? 'Hónap eleje (1–10.)' : day <= 20 ? 'Hónap közepe (11–20.)' : 'Hónap vége (21–utolsó nap)'; thirdCounts.set(third, (thirdCounts.get(third) || 0) + 1);
    const weekday = weekdayOrder[(date.getDay() + 6) % 7]; weekdayCounts.set(weekday, (weekdayCounts.get(weekday) || 0) + 1);
    const weekPart = date.getDay() === 0 || date.getDay() === 6 ? 'Hétvége' : 'Hétköznap'; weekPartCounts.set(weekPart, (weekPartCounts.get(weekPart) || 0) + 1);
    const dayPart = hour < 12 ? 'Délelőtt' : 'Délután'; dayPartCounts.set(dayPart, (dayPartCounts.get(dayPart) || 0) + 1);
    const hourLabel = String(hour).padStart(2, '0') + ':00'; hourCounts.set(hourLabel, (hourCounts.get(hourLabel) || 0) + 1);
  });
  const monthlyAttendanceDistribution = attendanceDistribution(monthNames, monthCounts);
  const monthThirdDistribution = attendanceDistribution(['Hónap eleje (1–10.)', 'Hónap közepe (11–20.)', 'Hónap vége (21–utolsó nap)'], thirdCounts);
  const weekdayAttendanceDistribution = attendanceDistribution(weekdayOrder, weekdayCounts);
  const weekPartDistribution = attendanceDistribution(['Hétköznap', 'Hétvége'], weekPartCounts);
  const dayPartDistribution = attendanceDistribution(['Délelőtt', 'Délután'], dayPartCounts);
  const classSessionsPerWeekPart = new Map<string, Set<string>>([['Hétköznap',new Set<string>()],['Hétvége',new Set<string>()]]);
  const attendeesPerWeekPart = new Map<string, number>([['Hétköznap',0],['Hétvége',0]]);
  selectedReportingVisitRows.forEach(visit => {
    const date = visit.startsAt.slice(0,10); const weekday = new Date(date + 'T00:00:00Z').getUTCDay(); const part = weekday === 0 || weekday === 6 ? 'Hétvége' : 'Hétköznap';
    const sessionKey = [visit.startsAt, visit.className, visit.courseName, visit.instructor].join('|');
    classSessionsPerWeekPart.get(part)?.add(sessionKey);
    if (visit.attended) attendeesPerWeekPart.set(part, (attendeesPerWeekPart.get(part) || 0) + 1);
  });
  const averageGuestsPerWeekPart = ['Hétköznap','Hétvége'].map(name => { const classes = classSessionsPerWeekPart.get(name)?.size || 0; const attendees = attendeesPerWeekPart.get(name) || 0; return { name, classes, attendees, average: classes ? attendees / classes : 0 }; });

  const hourlyAttendanceDistribution = attendanceDistribution([...hourCounts.keys()].sort(), hourCounts);
  const renderAttendanceDistribution = (title: string, data: { name: string; count: number; share: number }[], color: string) => <div className="guestAttendanceDistributionChart"><h4>{title}</h4><div className="guestChart"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}><BarChart data={data} margin={{ left: 8, right: 14, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={data.length > 10 ? 1 : 0}/><YAxis type="number" domain={[0, 100]} tickFormatter={value => value + '%'}/><Tooltip formatter={(value, _name, item) => [Number(value).toFixed(1) + '% · ' + item.payload.count + ' óra', 'Megoszlás']}/><Bar dataKey="share" name="Arány" fill={color} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></div>;
  const visitMilestones = [
    { name: 'Még nem járt', count: registeredAnalytics.filter(row => row.attendedCount === 0).length, color: '#c6cec8' },
    { name: '1 alkalom', count: registeredAnalytics.filter(row => row.attendedCount === 1).length, color: '#91b39a' },
    { name: '2–4 alkalom', count: registeredAnalytics.filter(row => row.attendedCount >= 2 && row.attendedCount <= 4).length, color: '#5d9d70' },
    { name: '5–9 alkalom', count: registeredAnalytics.filter(row => row.attendedCount >= 5 && row.attendedCount <= 9).length, color: '#438262' },
    { name: '10+ alkalom', count: registeredAnalytics.filter(row => row.attendedCount >= 10).length, color: '#275d46' },
  ];
  const firstVisitTiming = [
    { name: '7 napon belül', count: 0 }, { name: '8–30 nap', count: 0 },
    { name: '30 napon túl', count: 0 }, { name: 'Regisztráció előtt', count: 0 }, { name: 'Még nem járt', count: 0 },
  ];
  registeredAnalytics.forEach(row => {
    if (!row.firstVisit) { firstVisitTiming[4].count++; return; }
    const registeredMs = Date.parse(`${row.guest.registeredAt}T00:00:00Z`);
    const firstVisitMs = Date.parse(`${row.firstVisit}T00:00:00Z`);
    const days = Math.floor((firstVisitMs - registeredMs) / 86400000);
    if (days < 0) firstVisitTiming[3].count++;
    else firstVisitTiming[days <= 7 ? 0 : days <= 30 ? 1 : 2].count++;
  });
  const statusBreakdown = [
    { name: 'Aktív', value: analyticsRows.filter(row => row.status === 'Aktív').length, color: '#438262' },
    { name: 'Lemorzsolódott', value: analyticsRows.filter(row => row.status === 'Lemorzsolódott').length, color: '#d16b52' },
    { name: 'Még nem járt', value: analyticsRows.filter(row => row.status === 'Még nem járt').length, color: '#d4d9d5' },
  ];
  const purchaseConversion = [
    { name: 'Jegyet vásárolt', count: analyticsRows.filter(row => row.ticketCount > 0).length, color: '#5287b4' },
    { name: 'Bérletet vásárolt', count: analyticsRows.filter(row => row.passCount > 0).length, color: '#b58945' },
  ];
  const analysisRows = useMemo(() => {
    const searched = analyticsRows.filter(row => {
      const search = `${row.guest.guestId} ${row.guest.lastName} ${row.guest.firstName}`.toLocaleLowerCase('hu');
      if (!search.includes(query.toLocaleLowerCase('hu'))) return false;
      if (analysisSource !== 'all' && (row.guest.registrationSource || 'Nincs adat az exportokban') !== analysisSource) return false;
      if (analysisStatus === 'active' && row.status !== 'Aktív') return false;
      if (analysisStatus === 'lapsed' && row.status !== 'Lemorzsolódott') return false;
      if (analysisStatus === 'never' && row.status !== 'Még nem járt') return false;
      if (analysisStatus === 'repeat' && row.attendedCount <= 1) return false;
      if (analysisStatus === 'fiveplus' && row.attendedCount < 5) return false;
      if (analysisStatus === 'tenplus' && row.attendedCount < 10) return false;
      if (analysisStatus === 'debt' && !row.hasDebt) return false;
      if (analysisPurchases === 'ticket' && row.ticketCount === 0) return false;
      if (analysisPurchases === 'pass' && row.passCount === 0) return false;
      if (analysisPurchases === 'any' && row.ticketCount + row.passCount === 0) return false;
      if (analysisPurchases === 'none' && row.ticketCount + row.passCount > 0) return false;
      return true;
    });
    const valueFor = (row: typeof analyticsRows[number]): string | number => {
      switch (analysisSortKey) {
        case 'name': return `${row.guest.lastName} ${row.guest.firstName}`;
        case 'source': return row.guest.registrationSource || '';
        case 'attendedCount': return row.attendedCount;
        case 'firstVisit': return row.firstVisit;
        case 'lastVisit': return row.lastVisit;
        case 'ticketCount': return row.ticketCount;
        case 'passCount': return row.passCount;
        case 'paidTotal': return row.paidTotal;
        case 'status': return row.status;
      }
    };
    const collator = new Intl.Collator('hu', { numeric: true, sensitivity: 'base' });
    return [...searched].sort((a, b) => {
      const left = valueFor(a); const right = valueFor(b);
      if (left === '' && right !== '') return 1;
      if (right === '' && left !== '') return -1;
      const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : collator.compare(String(left), String(right));
      return analysisSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [analyticsRows, query, analysisSource, analysisStatus, analysisPurchases, analysisSortKey, analysisSortDirection]);
  const monthly = useMemo(() => {
    const counts = new Map<string, { count: number; attended: number; breakdown: Record<string, number> }>();
    periodGuests.forEach(g => {
      if (!g.registeredAt) return;
      const month = g.registeredAt.slice(0, 7);
      const item = counts.get(month) || { count: 0, attended: 0, breakdown: {} };
      const source = sourceKeyByName.get(g.registrationSource?.trim() || 'Nincs adat az exportokban');
      if (source) item.breakdown[source.registeredKey] = (item.breakdown[source.registeredKey] || 0) + 1;
      item.count++;
      if (attendedGuestIds.has(g.guestId) || g.firstVisitAt || g.lastVisitAt) {
        item.attended++;
        if (source) item.breakdown[source.attendedKey] = (item.breakdown[source.attendedKey] || 0) + 1;
      }
      counts.set(month, item);
    });
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({ month: monthName(month), count: data.count, attended: data.attended, ...data.breakdown }));
  }, [periodGuests, sourceSeries, visits]);
  const sortedFiltered = useMemo(() => {
    const collator = new Intl.Collator('hu', { numeric: true, sensitivity: 'base' });
    return [...filtered].sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      const a = Array.isArray(leftValue) ? leftValue.join(', ') : leftValue || '';
      const b = Array.isArray(rightValue) ? rightValue.join(', ') : rightValue || '';
      const result = collator.compare(String(a), String(b));
      return sortDirection === 'asc' ? result : -result;
    });
  }, [filtered, sortKey, sortDirection]);
  const periodLabel = periodMode === 'all' ? 'Teljes időszak' : periodMode === 'year' ? `${periodYear || '—'} teljes év` : periodYear && periodMonth ? monthName(`${periodYear}-${periodMonth}`) : 'Válassz időszakot';
  const monthCompareA = periodSummary(visibleGuests.filter(g => g.registeredAt?.startsWith(`${compareYearA}-${compareMonthA}`)), visits);
  const monthCompareB = periodSummary(visibleGuests.filter(g => g.registeredAt?.startsWith(`${compareYearB}-${compareMonthB}`)), visits);
  const yearCompareA = periodSummary(visibleGuests.filter(g => g.registeredAt?.startsWith(compareAnnualA)), visits);
  const yearCompareB = periodSummary(visibleGuests.filter(g => g.registeredAt?.startsWith(compareAnnualB)), visits);

  const importFile = async (file?: File) => {
    if (!file) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      const parsed = await parseGuestWorkbook(file);
      if (!parsed.length) throw new Error('Nem találtam importálható vendégsort a fájlban.');
      const response = await fetch('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guests: parsed }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Az import nem sikerült.');
      setMessage(`Import kész: ${result.inserted} új vendég, ${result.updated} frissített rekord (${result.received} sor), ${result.sourcesProvided} forrásadattal.`);
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Az Excel beolvasása nem sikerült.'); }
    finally { setBusy(false); }
  };

  const importActivityFile = async (file?: File) => {
    if (!file) return;
    setError(''); setMessage(''); setActivityBusy(true);
    try {
      const parsed = await parseGuestActivityWorkbook(file);
      const response = await fetch('/api/guest-activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Az óralátogatási import nem sikerült.');
      setMessage(`Import kész: ${result.newVisits} új óraalkalom, ${result.visits - result.newVisits} frissített alkalom, ${result.newPurchases} új jegy- vagy bérletvásárlás. ${result.sourcesLinked} vendég forrásadata frissült.${parsed.reportPeriod ? ` A riport időszaka rögzítve: ${parsed.reportPeriod.startDate} – ${parsed.reportPeriod.endDate}.` : ' A fájlnévben nem találtam időszakot, ezért a teljes hónap jelzés nem frissült.'}`);
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Az Excel beolvasása nem sikerült.'); }
    finally { setActivityBusy(false); }
  };

  const exportCsv = () => {
    const data = [['Vendég ID', 'Vezetéknév', 'Keresztnév', 'Becenév', 'Regisztráció', 'Első óralátogatás', 'Utolsó óralátogatás', 'Kurzusok', 'Aktív tagság'], ...sortedFiltered.map(g => [g.guestId, g.lastName, g.firstName, g.nickname, g.registeredAt || '', g.firstVisitAt || '', g.lastVisitAt || '', g.courses.join(', '), g.activeMembership])];
    const csv = '\uFEFF' + data.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'moonlab-vendegek.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  const sortBy = (key: GuestSortKey) => {
    if (sortKey === key) setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
  };
  const sortButton = (label: string, key: GuestSortKey) => <button className="guestSortButton" onClick={() => sortBy(key)}>{label}{sortKey !== key ? <ArrowUpDown size={14}/> : sortDirection === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}</button>;
  const sortAnalysisBy = (key: AnalysisSortKey) => {
    if (analysisSortKey === key) setAnalysisSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
    else { setAnalysisSortKey(key); setAnalysisSortDirection(key === 'lastVisit' ? 'desc' : 'asc'); }
  };
  const analysisSortButton = (label: string, key: AnalysisSortKey) => <button className="guestSortButton" onClick={() => sortAnalysisBy(key)}>{label}{analysisSortKey !== key ? <ArrowUpDown size={14}/> : analysisSortDirection === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}</button>;

  return <div className="stack guestPage">
    <section className="panel">
      <div className="panelHead"><div><h2>Vendégadatok</h2><p className="panelSub">Regisztrációk, első óralátogatások és kurzusok a vendéglistából.</p></div><button className="btn" onClick={() => void reload()}><RefreshCw size={16}/> Frissítés</button></div>
      <div className="guestSections">{sections.map(s => <button key={s.id} className={`guestSection ${section === s.id ? 'active' : ''}`} onClick={() => setSection(s.id)}>{s.label}</button>)}</div>
      {section !== 'import' && section !== 'comparison' && <div className="guestPeriodBar">
        <strong>Időszak</strong>
        <div className="segmented"><button className={periodMode === 'all' ? 'active' : ''} onClick={() => setPeriodMode('all')}>Teljes adat</button><button className={periodMode === 'year' ? 'active' : ''} onClick={() => setPeriodMode('year')}>Év</button><button className={periodMode === 'month' ? 'active' : ''} onClick={() => setPeriodMode('month')}>Hónap</button></div>
        {periodMode !== 'all' && <label className="guestSelect"><span>Év</span><select aria-label="Kiválasztott év" value={periodYear} onChange={e => setPeriodYear(e.target.value)}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select></label>}
        {periodMode === 'month' && <label className="guestSelect"><span>Hónap</span><select aria-label="Kiválasztott hónap" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)}>{monthLabels.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>}
        {(section === 'overview' || section === 'registration' || section === 'attendance') && <div className="chartToggle"><span>Regisztrációk bontása:</span><button className={!sourceChartMode ? 'active' : ''} onClick={() => setSourceChartMode(false)}>Összesen</button><button className={sourceChartMode ? 'active' : ''} onClick={() => setSourceChartMode(true)}>Forrás szerint</button></div>}
        <span className="guestPeriodResult">{periodLabel} · {periodSummaryValue.registrations} regisztráció</span>
      </div>}
      {section !== 'import' && <div className="guestSegmentToggles" aria-label="Család és influencer vendégek szűrése">
        <strong>Vendégcsoportok:</strong>
        <button type="button" className={excludeFamily ? 'excluded' : ''} aria-pressed={excludeFamily} onClick={() => setExcludeFamily(value => !value)}>Család {excludeFamily ? 'kizárva' : 'benne'}</button>
        <button type="button" className={excludeInfluencers ? 'excluded' : ''} aria-pressed={excludeInfluencers} onClick={() => setExcludeInfluencers(value => !value)}>Influencerek {excludeInfluencers ? 'kizárva' : 'benne'}</button>
      </div>}
      {error && <p className="errorText">{error}</p>}{message && <p className="guestSuccess">{message}</p>}
    </section>

    {section === 'import' && <><section className="panel guestImportGuide"><div className="panelHead"><div><h3>Importálási útmutató</h3><p className="panelSub">A vendég ID kapcsolja össze a listát az óra- és vásárlási adatokkal.</p></div><div className="latestImportBadge"><span>Legutóbbi teljes hónap</span><strong>{latestCompleteActivityImport ? `${monthName(latestCompleteActivityImport.periodStart.slice(0, 7))} · ${latestCompleteActivityImport.periodStart} – ${latestCompleteActivityImport.periodEnd}` : 'Még nincs teljes hónap rögzítve'}</strong></div></div><div className="guestImportRules"><div><strong>Vendéglista</strong><span>Mindig a teljes listát töltsd fel, ne csak az új vendégeket. Így a meglévő ID-k adatai is frissülnek.</span></div><div><strong>Óralátogatás és vásárlás</strong><span>Elég az új havi exportokat feltölteni. A korábban betöltött hónap újrafeltöltése biztonságos, nem duplikálja az alkalmakat és vásárlásokat.</span></div></div><p className="panelSub guestFilenameHint">A teljes hónap jelzéshez a fájlnév tartalmazza a riport kezdetét és végét, például: 2026-10-01-2026-10-31.</p></section>

      <div className="guestImportGrid"><section className="panel guestImport"><div className="panelHead"><div><h3>Vendéglista import</h3><p className="panelSub">Azonosító alapján létrehozza vagy frissíti a vendégadatokat.</p></div><FileUp size={22}/></div>
      <label className={`guestDrop ${busy ? 'disabled' : ''}`}><input type="file" accept=".xlsx,.xls" disabled={busy} onChange={e => { void importFile(e.target.files?.[0]); e.currentTarget.value = ''; }}/><FileUp size={30}/><strong>{busy ? 'Beolvasás és mentés…' : 'Vendéglista Excel kiválasztása'}</strong><span>.xlsx vagy .xls · az első munkalap vendégazonosítója alapján frissít.</span></label>
      <p className="infoBox">A fájlban elérhető vendégadatokat menti. Ha a fájlból hiányzik a regisztrációs vagy látogatási dátum, a korábban mentett érték megmarad. A kitöltött forrás frissül, az üres forrás nem törli a korábbi adatot.</p>
    </section><section className="panel guestImport"><div className="panelHead"><div><h3>Óralátogatás és vásárlás import</h3><p className="panelSub">A két munkalapot a vendég ID és óraidőpont alapján összekapcsolja.</p></div><FileUp size={22}/></div>
      <label className={`guestDrop ${activityBusy ? 'disabled' : ''}`}><input type="file" accept=".xlsx,.xls" disabled={activityBusy} onChange={e => { void importActivityFile(e.target.files?.[0]); e.currentTarget.value = ''; }}/><FileUp size={30}/><strong>{activityBusy ? 'Órák és vásárlások feldolgozása…' : 'Óralátogatási Excel kiválasztása'}</strong><span>Az „Óralátogatások” és „Bejelentkezések” munkalap szükséges.</span></label>
      <p className="infoBox">Az órák, részvétel, oktató, kurzus, órabevétel, tartozásjelzés, jegy- és bérletvásárlások, valamint a „Honnan hallottál rólunk?” értéke kerül mentésre. Az e-mailt, címet és megjegyzést nem importálja. Ha a vendéglista még nincs feltöltve, az óraimport akkor is létrehozza az ID-rekordokat; a későbbi vendéglista-import kitölti hozzá a neveket és regisztrációs adatokat. Ugyanaz a fájl ismét feltölthető: az órák és vásárlások nem sokszorozódnak.</p>
    </section></div>
      <section className="panel guestSegmentManager"><div className="panelHead"><div><h3>Család- és influencerlisták</h3><p className="panelSub">Az ID-k automatikusan bekerülnek a megfelelő statisztikákba. A külön kapcsolókkal az összes kimutatásból kizárhatod vagy visszateheted őket.</p></div></div>
        {segmentError && <p className="errorText">{segmentError}</p>}{segmentMessage && <p className="guestSuccess">{segmentMessage}</p>}
        <div className="guestSegmentColumns">
          <div className="guestSegmentColumn"><h4>Család / Family <span>{familyIds.length}</span></h4><form className="guestSegmentAdd" onSubmit={event => { event.preventDefault(); addSegmentId('family'); }}><input className="inlineSelect" aria-label="Családtag vendég ID" placeholder="Vendég ID" value={familyIdInput} onChange={event => setFamilyIdInput(event.target.value)}/><button className="btn" disabled={segmentBusy || !familyIdInput.trim()}>Hozzáadás</button></form>
            <div className="guestSegmentList">{familyIds.map(id => { const guest = guestById.get(id); return <div className="guestSegmentItem" key={id}><div><strong>{guest ? `${guest.lastName} ${guest.firstName}`.trim() : 'Név nem található'}</strong><small>ID: {id}</small></div><button type="button" className="guestSegmentRemove" disabled={segmentBusy} onClick={() => removeSegmentId('family', id)}>Eltávolítás</button></div>; })}{!familyIds.length && <p className="panelSub">A családlista üres.</p>}</div>
          </div>
          <div className="guestSegmentColumn"><h4>Influencerek <span>{influencerIds.length}</span></h4><form className="guestSegmentAdd" onSubmit={event => { event.preventDefault(); addSegmentId('influencer'); }}><input className="inlineSelect" aria-label="Influencer vendég ID" placeholder="Vendég ID" value={influencerIdInput} onChange={event => setInfluencerIdInput(event.target.value)}/><button className="btn" disabled={segmentBusy || !influencerIdInput.trim()}>Hozzáadás</button></form>
            <div className="guestSegmentList">{influencerIds.map(id => { const guest = guestById.get(id); return <div className="guestSegmentItem" key={id}><div><strong>{guest ? `${guest.lastName} ${guest.firstName}`.trim() : 'Név nem található'}</strong><small>ID: {id}</small></div><button type="button" className="guestSegmentRemove" disabled={segmentBusy} onClick={() => removeSegmentId('influencer', id)}>Eltávolítás</button></div>; })}{!influencerIds.length && <p className="panelSub">Az influencerlista üres.</p>}</div>
          </div>
        </div>
      </section>
    </>}

    {section === 'overview' && <>
      <div className="statsGrid guestStats"><article className="statCard"><div className="iconBubble"><Users size={21}/></div><div><span>Vendég összesen</span><strong>{periodGuests.length}</strong><small>egyedi vendégazonosító</small></div></article><article className="statCard"><div className="iconBubble"><CalendarDays size={21}/></div><div><span>Regisztrált</span><strong>{hasRegistrationDate.length}</strong><small>regisztrációs dátummal</small></div></article><article className="statCard"><div className="iconBubble"><Activity size={21}/></div><div><span>Regisztráltból órára jutott</span><strong>{registeredPeriodAttendedGuestCount}</strong><small>{hasRegistrationDate.length ? (registeredPeriodAttendedGuestCount / hasRegistrationDate.length * 100).toFixed(1) : 0}% az adott időszak regisztrációiból</small></div></article><article className="statCard"><div className="iconBubble"><Activity size={21}/></div><div><span>Többször is járt</span><strong>{registeredRepeatGuestCount}</strong><small>{hasRegistrationDate.length ? (registeredRepeatGuestCount / hasRegistrationDate.length * 100).toFixed(1) : 0}% a regisztráltakból</small></div></article><article className="statCard"><div className="iconBubble"><Users size={21}/></div><div><span>Jegyet vásárolt</span><strong>{ticketBuyerCount}</strong><small>{ticketPurchaseCount} jegyvásárlás</small></div></article><article className="statCard"><div className="iconBubble"><Users size={21}/></div><div><span>Bérletet vásárolt</span><strong>{passBuyerCount}</strong><small>{passPurchaseCount} bérletvásárlás</small></div></article><article className="statCard"><div className="iconBubble"><Activity size={21}/></div><div><span>Lemorzsolódott</span><strong>{lapsedGuestCount}</strong><small>{lapseThreshold} napja nem járt órán</small></div></article></div>
      <div className="chartGrid twoCharts"><section className="panel"><h3>Regisztrációk havonta</h3><p className="panelSub">A regisztráció dátuma szerint</p><div className="guestChart"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250} initialDimension={{ width: 600, height: 300 }}><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip/>{sourceChartMode ? sourceSeries.map(source => <Bar key={source.registeredKey} dataKey={source.registeredKey} name={source.name} stackId="registrations" fill={source.color}/>) : <Bar dataKey="count" name="Vendég" fill="#438262" radius={[6,6,0,0]}/>} {sourceChartMode && <Legend/>}</BarChart></ResponsiveContainer></div></section><section className="panel"><h3>Kurzusok</h3><p className="panelSub">Tényleges óralátogatások a kiválasztott dátumidőszakban</p><div className="guestChart"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250} initialDimension={{ width: 600, height: 300 }}><BarChart data={courseStats.slice(0, 9)} layout="vertical" margin={{left:14}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="course" width={140} tick={{fontSize:10}}/><Tooltip/><Bar dataKey="count" name="Vendég" fill="#789b76" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer></div></section></div>
    </>}

    {section === 'registration' && <>{sourceChartMode && <section className="panel"><h3>Regisztrációk forrás szerint</h3><p className="panelSub">{periodLabel} regisztrációinak megoszlása forrás alapján.</p><div className="guestPieChart"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250} initialDimension={{width:360,height:280}}><PieChart><Tooltip/><Legend/><Pie data={registrationSourceDistribution} dataKey="count" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={2}>{registrationSourceDistribution.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie></PieChart></ResponsiveContainer></div></section>}<section className="panel"><h3>Havi regisztrációk</h3><p className="panelSub">{monthly.length ? `${monthly.length} hónapnyi regisztráció van betöltve.` : 'Még nincs regisztrációs adat.'}</p><div className="guestChart tall"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={{ width: 800, height: 360 }}><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tick={{fontSize:12}}/><YAxis allowDecimals={false}/><Tooltip/>{sourceChartMode ? sourceSeries.map(source => <Bar key={source.registeredKey} dataKey={source.registeredKey} name={source.name} stackId="registrations" fill={source.color}/>) : <Bar dataKey="count" name="Vendég" fill="#438262" radius={[6,6,0,0]}/>} {sourceChartMode && <Legend/>}</BarChart></ResponsiveContainer></div><table className="compact"><thead><tr><th>Hónap</th><th>Regisztrálók</th></tr></thead><tbody>{monthly.map(m => <tr key={m.month}><td>{m.month}</td><td>{m.count}</td></tr>)}</tbody></table></section></>}

    {section === 'attendance' && <><section className="panel"><h3>Óralátogatás</h3><p className="panelSub">A bejelentkezési lap részvételi jelzése és az óralátogatási munkalap alapján. Egy vendégnél több alkalom is látszik.</p><div className="statsGrid guestStats"><article className="statCard"><div className="iconBubble"><Activity size={21}/></div><div><span>Volt már órán</span><strong>{periodAttendedGuestCount}</strong></div></article><article className="statCard"><div className="iconBubble"><Users size={21}/></div><div><span>Óralátogatások</span><strong>{periodAttendanceCount}</strong></div></article><article className="statCard"><div className="iconBubble"><CalendarDays size={21}/></div><div><span>Meg nem jelent</span><strong>{periodNoShowCount}</strong></div></article><article className="statCard"><div className="iconBubble"><CalendarDays size={21}/></div><div><span>Regisztrációból órára</span><strong>{hasRegistrationDate.length ? (registeredPeriodAttendedGuestCount / hasRegistrationDate.length * 100).toFixed(1) : 0}%</strong></div></article></div><h3 className="guestSubhead">Regisztrációk havonta</h3><div className="guestChart tall"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={{ width: 800, height: 360 }}><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tick={{fontSize:12}}/><YAxis allowDecimals={false}/><Tooltip/>{sourceChartMode ? sourceSeries.flatMap(source => [<Bar key={`r-${source.name}`} dataKey={source.registeredKey} name={`${source.name} · regisztráció`} stackId="reg" fill={source.color}/>, <Bar key={`a-${source.name}`} dataKey={source.attendedKey} name={`${source.name} · eljutott`} stackId="attendance" fill={source.color} fillOpacity={0.5}/>]) : <><Bar dataKey="count" name="Regisztrált" fill="#438262"/><Bar dataKey="attended" name="Eljutott órára" fill="#dbab5c"/></>}{sourceChartMode && <Legend/>}</BarChart></ResponsiveContainer></div></section><section className="panel"><h3>Órára jutás regisztrációs forrás szerint</h3><p className="panelSub">Az adott forrásból regisztráltak közül hányan jutottak el legalább egy órára.</p>{sourceVisitConversion.length ? <><div className="guestChart tall"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={{width:700,height:360}}><BarChart data={sourceVisitConversion} layout="vertical" margin={{left:8,right:24}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" domain={[0,100]} tickFormatter={value => `${value}%`}/><YAxis type="category" dataKey="name" width={170} tick={{fontSize:11}}/><Tooltip formatter={value => [`${Number(value).toFixed(1)}%`, 'Órára jutási arány']}/><Bar dataKey="rate" name="Órára jutási arány" radius={[0,6,6,0]}>{sourceVisitConversion.map(item => <Cell key={item.name} fill={item.color}/>)}</Bar></BarChart></ResponsiveContainer></div><div className="monthly"><table className="compact"><thead><tr><th>Forrás</th><th>Regisztrált</th><th>Eljutott órára</th><th>Arány</th></tr></thead><tbody>{sourceVisitConversion.map(item => <tr key={item.name}><td>{item.name}</td><td>{item.registrations}</td><td>{item.attended}</td><td>{item.rate.toFixed(1)}%</td></tr>)}</tbody></table></div></> : <p className="panelSub">Nincs forrásadat a kiválasztott időszakra.</p>}</section></>}

    {section === 'guest-stats' && <>
      <section className="panel">
        <div className="panelHead"><div><h3>Vendégelemzés</h3><p className="panelSub">A lemorzsolódás az utolsó teljes óraimportig ({analysisAsOfDate}) és a kiválasztott küszöb alapján számolódik. A látogatási mérföldkövek az importált alkalmakból számolódnak ({visits.length} bejelentkezés).</p></div></div>
        <div className="guestSections"><button className={`guestSection ${analysisTab === 'list' ? 'active' : ''}`} onClick={() => setAnalysisTab('list')}>Vendéglista és szűrők</button><button className={`guestSection ${analysisTab === 'insights' ? 'active' : ''}`} onClick={() => setAnalysisTab('insights')}>Elemzőgrafikonok</button></div>
      </section>
      {analysisTab === 'list' && <section className="panel"><div className="guestAnalysisFilters"><input className="inlineSelect" placeholder="Keresés névre vagy ID-ra" value={query} onChange={e => setQuery(e.target.value)}/><label className="guestSelect"><span>Aktivitás</span><select value={analysisStatus} onChange={e => setAnalysisStatus(e.target.value)}><option value="all">Minden állapot</option><option value="active">Aktív</option><option value="lapsed">Lemorzsolódott</option><option value="never">Még nem járt órán</option><option value="repeat">Legalább 2 óra</option><option value="fiveplus">Legalább 5 óra</option><option value="tenplus">Legalább 10 óra</option><option value="debt">Tartozás jelölve</option></select></label><label className="guestSelect"><span>Vásárlás</span><select value={analysisPurchases} onChange={e => setAnalysisPurchases(e.target.value)}><option value="all">Minden vásárlás</option><option value="ticket">Vett jegyet</option><option value="pass">Vett bérletet</option><option value="any">Bármilyen vásárlás</option><option value="none">Nem vásárolt</option></select></label><label className="guestSelect"><span>Forrás</span><select value={analysisSource} onChange={e => setAnalysisSource(e.target.value)}><option value="all">Minden forrás</option>{sourceNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label><strong className="guestFilterCount">{analysisRows.length} vendég</strong></div>
        <div className="monthly"><table><thead><tr><th>{analysisSortButton('Vendég', 'name')}</th><th>{analysisSortButton('Forrás', 'source')}</th><th>{analysisSortButton('Órák', 'attendedCount')}</th><th>{analysisSortButton('Első látogatás', 'firstVisit')}</th><th>{analysisSortButton('Utolsó látogatás', 'lastVisit')}</th><th>{analysisSortButton('Jegyvásárlás', 'ticketCount')}</th><th>{analysisSortButton('Bérletvásárlás', 'passCount')}</th><th>{analysisSortButton('Vásárolt összesen', 'paidTotal')}</th><th>{analysisSortButton('Állapot', 'status')}</th></tr></thead><tbody>{analysisRows.slice(0, 500).map(row => <tr key={row.guest.guestId}><td>{row.guest.lastName} {row.guest.firstName}<small className="guestIdSub">ID: {row.guest.guestId}</small></td><td>{row.guest.registrationSource || 'Nincs adat az exportokban'}</td><td>{row.attendedCount}</td><td>{row.firstVisit || '—'}</td><td>{row.lastVisit || '—'}</td><td>{row.ticketCount}</td><td>{row.passCount}</td><td>{row.paidTotal.toLocaleString('hu-HU')} Ft</td><td><span className={`guestStatus ${row.status === 'Aktív' ? 'active' : row.status === 'Lemorzsolódott' ? 'lapsed' : ''}`}>{row.status}{row.hasDebt ? ' · tartozás' : ''}</span></td></tr>)}</tbody></table>{analysisRows.length > 500 && <p className="panelSub">Az első 500 találat látható. Szűkíts a kereséssel.</p>}</div>
      </section>}
      {analysisTab === 'insights' && <div className="stack">
        <p className="infoBox">Az alkalomszámok az összes jelenleg importált óraexportból készülnek, nem csak az októberi fájlból. A regisztrációtól az első óráig eltelt idő a vendég regisztrációs és első látogatási dátumát használja.</p><div className="guestAnalysisFilters"><label className="guestSelect"><span>Lemorzsolódási küszöb</span><select value={lapseThreshold} onChange={event => setLapseThreshold(Number(event.target.value))}><option value={30}>30 nap</option><option value={60}>60 nap</option><option value={90}>90 nap</option></select></label></div>
        <div className="statsGrid guestStats"><article className="statCard"><div className="iconBubble"><Activity size={21}/></div><div><span>Legalább 2 alkalom</span><strong>{visitMilestones.slice(2).reduce((sum, item) => sum + item.count, 0)}</strong><small>{registeredAnalytics.length ? (visitMilestones.slice(2).reduce((sum, item) => sum + item.count, 0) / registeredAnalytics.length * 100).toFixed(1) : 0}% a regisztráltakból</small></div></article><article className="statCard"><div className="iconBubble"><Activity size={21}/></div><div><span>Legalább 5 alkalom</span><strong>{visitMilestones.slice(3).reduce((sum, item) => sum + item.count, 0)}</strong><small>visszatérő vendégek</small></div></article><article className="statCard"><div className="iconBubble"><Activity size={21}/></div><div><span>Legalább 10 alkalom</span><strong>{visitMilestones[4].count}</strong><small>törzsvendég mérföldkő</small></div></article><article className="statCard"><div className="iconBubble"><CalendarDays size={21}/></div><div><span>1 héten belül órára jött</span><strong>{firstVisitTiming[0].count}</strong><small>első látogatás a regisztrációtól</small></div></article></div>
        <div className="statsGrid guestStats"><article className="statCard"><div className="iconBubble"><Users size={21}/></div><div><span>Eladott bérletek</span><strong>{passPurchases.length}</strong><small>az ingyeneseket nem számoljuk</small></div></article><article className="statCard"><div className="iconBubble"><Users size={21}/></div><div><span>Kedvezményes bérletek</span><strong>{discountedPasses.length}</strong><small>{passPurchases.length ? (discountedPasses.length / passPurchases.length * 100).toFixed(1) : 0}% · átlag {averageDiscountPercent.toFixed(1)}% kedvezmény</small></div></article><article className="statCard"><div className="iconBubble"><Users size={21}/></div><div><span>5 / 10 alkalmas</span><strong>{passKinds[0].count} / {passKinds[1].count}</strong><small>fizetős vásárlások száma</small></div></article></div>
        <div className="guestInsightGrid"><section className="panel"><h3>Hány órán járt egy vendég?</h3><p className="panelSub">Vendégek száma látogatási mérföldkövenként</p><div className="guestChart tall"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={{width:700,height:360}}><BarChart data={visitMilestones} layout="vertical" margin={{left:12,right:16}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={125} tick={{fontSize:11}}/><Tooltip/><Bar dataKey="count" name="Vendég" radius={[0,6,6,0]}>{visitMilestones.map(item => <Cell key={item.name} fill={item.color}/>)}</Bar></BarChart></ResponsiveContainer></div></section>
          <section className="panel"><h3>Regisztrációtól az első óráig</h3><p className="panelSub">Az első látogatás ideje a regisztrációhoz képest</p><div className="guestChart tall"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={{width:700,height:360}}><BarChart data={firstVisitTiming} layout="vertical" margin={{left:12,right:16}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={125} tick={{fontSize:11}}/><Tooltip/><Bar dataKey="count" name="Vendég" fill="#5386bd" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer></div></section>
          <section className="panel"><h3>Aktivitási állapot</h3><p className="panelSub">Aktív: az utolsó látogatás {lapseThreshold} napon belüli</p><div className="guestPieChart"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250} initialDimension={{width:360,height:280}}><PieChart><Tooltip/><Legend/><Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={2}>{statusBreakdown.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie></PieChart></ResponsiveContainer></div></section>
          <section className="panel"><h3>Vásárlási konverzió</h3><p className="panelSub">Egyedi vásárlók a kiválasztott vendégcsoportban</p><div className="guestChart tall"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={{width:700,height:360}}><BarChart data={purchaseConversion} layout="vertical" margin={{left:12,right:16}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={125} tick={{fontSize:11}}/><Tooltip/><Bar dataKey="count" name="Vendég" radius={[0,6,6,0]}>{purchaseConversion.map(item => <Cell key={item.name} fill={item.color}/>)}</Bar></BarChart></ResponsiveContainer></div></section>
          <section className="panel"><h3>Forrásonkénti konverziós tölcsér</h3><p className="panelSub">Regisztrált, eljutott, visszatérő, jegyet vagy bérletet vásárló vendégek. A 30 napos arány csak a legalább 30 napos utánkövetéssel rendelkező regisztrálókat számolja.</p><div className="monthly"><table className="compact"><thead><tr><th>Forrás</th><th>Regisztrált</th><th>Valaha eljutott</th><th>30 napos eljutás (értékelhető)</th><th>Visszatérő</th><th>Jegyet vett</th><th>Bérletet vett</th></tr></thead><tbody>{sourceFunnel.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.registrations}</td><td>{row.attended} ({(row.attended/row.registrations*100).toFixed(1)}%)</td><td>{row.attended30} / {row.eligible30} ({row.rate30.toFixed(1)}%)</td><td>{row.repeat} ({(row.repeat/row.registrations*100).toFixed(1)}%)</td><td>{row.ticket} ({(row.ticket/row.registrations*100).toFixed(1)}%)</td><td>{row.pass} ({(row.pass/row.registrations*100).toFixed(1)}%)</td></tr>)}</tbody></table></div></section>
          <section className="panel"><h3>30 / 60 / 90 napos első óralátogatás</h3><p className="panelSub">Csak a teljes megfigyelési idővel rendelkező regisztrációk szerepelnek a nevezőben.</p><div className="monthly"><table className="compact"><thead><tr><th>Időablak</th><th>Értékelhető regisztráció</th><th>Órára eljutott</th><th>Arány</th></tr></thead><tbody>{retentionWindows.map(row => <tr key={row.days}><td>{row.days} nap</td><td>{row.eligible}</td><td>{row.converted}</td><td>{row.rate.toFixed(1)}%</td></tr>)}</tbody></table></div></section>
          <section className="panel"><h3>Visszatérés az első óra után</h3><p className="panelSub">A második importált látogatás az első után 30, 60 vagy 90 napon belül. Átlagos idő a második óráig: {averageSecondVisitDays === null ? "nincs elég adat" : Math.round(averageSecondVisitDays) + " nap"}. Újraaktiválódott: {reactivatedGuestCount} vendég ({lapseThreshold} napnál hosszabb kihagyás után visszatért).</p><div className="monthly"><table className="compact"><thead><tr><th>Időablak</th><th>Értékelhető vendég</th><th>Második óra időben</th><th>Arány</th></tr></thead><tbody>{repeatWindowStats.map(row => <tr key={row.days}><td>{row.days} nap</td><td>{row.eligible}</td><td>{row.returned}</td><td>{row.rate.toFixed(1)}%</td></tr>)}</tbody></table></div></section>
          <section className="panel"><h3>Bevétel vásárlástípusonként</h3><p className="panelSub">A kiválasztott regisztrációs kohorsz importált vásárlásainak fizetett összege. Átlag / teljes vendégkohorsz: {Math.round(cohortRevenuePerGuest).toLocaleString("hu-HU")} Ft.</p><div className="monthly"><table className="compact"><thead><tr><th>Típus</th><th>Vásárlás</th><th>Vásárló vendégek</th><th>Fizetett összeg</th><th>Átlag / vásárló</th></tr></thead><tbody>{revenueStats.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.purchases}</td><td>{row.buyers}</td><td>{row.revenue.toLocaleString('hu-HU')} Ft</td><td>{Math.round(row.average).toLocaleString('hu-HU')} Ft</td></tr>)}</tbody></table></div></section>
          <section className="panel"><h3>Bérletbevétel kedvezménykategóriánként</h3><p className="panelSub">Fizetett összeg a besorolt árkategória szerint.</p><div className="monthly"><table className="compact"><thead><tr><th>Kategória</th><th>Bérlet</th><th>Fizetett összeg</th><th>Átlagár</th></tr></thead><tbody>{discountRevenueStats.map(row => <tr key={row.key}><td>{row.name}</td><td>{row.count}</td><td>{row.revenue.toLocaleString('hu-HU')} Ft</td><td>{Math.round(row.revenue/row.count).toLocaleString('hu-HU')} Ft</td></tr>)}</tbody></table></div></section>
          <section className="panel guestAttendanceWide"><h3>Órák és oktatók</h3><p className="panelSub">Részvételi arány a foglalási sorokból; férőhelyadat nélkül ez nem kapacitás-kihasználtság.</p><div className="guestInsightGrid guestAttendanceRows"><div className="monthly"><h4>Kurzus</h4><table className="compact"><thead><tr><th>Név</th><th>Foglalás</th><th>Megjelent</th><th>Arány</th></tr></thead><tbody>{courseAttendanceStats.slice(0,15).map(row => <tr key={row.name}><td>{row.name}</td><td>{row.bookings}</td><td>{row.attended}</td><td>{row.showRate.toFixed(1)}%</td></tr>)}</tbody></table></div><div className="monthly"><h4>Oktató</h4><table className="compact"><thead><tr><th>Név</th><th>Foglalás</th><th>Megjelent</th><th>Arány</th></tr></thead><tbody>{instructorAttendanceStats.slice(0,15).map(row => <tr key={row.name}><td>{row.name}</td><td>{row.bookings}</td><td>{row.attended}</td><td>{row.showRate.toFixed(1)}%</td></tr>)}</tbody></table></div></div><div className="guestInsightGrid guestAttendanceRows"><div className="monthly"><h4>Hét napja</h4><table className="compact"><thead><tr><th>Nap</th><th>Foglalás</th><th>Megjelent</th><th>Arány</th></tr></thead><tbody>{weekdayAttendanceStats.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.bookings}</td><td>{row.attended}</td><td>{row.showRate.toFixed(1)}%</td></tr>)}</tbody></table></div><div className="monthly"><h4>Kezdési óra</h4><table className="compact"><thead><tr><th>Idő</th><th>Foglalás</th><th>Megjelent</th><th>Arány</th></tr></thead><tbody>{hourlyAttendanceStats.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.bookings}</td><td>{row.attended}</td><td>{row.showRate.toFixed(1)}%</td></tr>)}</tbody></table></div></div><div className="guestAttendanceDistribution"><div className="panelHead"><div><h4>Óralátogatások megoszlása</h4><p className="panelSub">A százalékok az aktuális dátumválasztásban megjelent órákból számolódnak ({attendedInSelectedPeriod.length} alkalom). Workshopok nélkül. Hónapon belül: 1–10., 11–20. és 21–utolsó nap.</p></div></div><div className="guestAttendanceDistributionGrid">{periodMode !== 'month' ? renderAttendanceDistribution(periodMode === 'year' ? 'Megjelenések megoszlása hónaponként' : 'Megjelenések megoszlása naptári hónap szerint', monthlyAttendanceDistribution, '#5386bd') : renderAttendanceDistribution('Megjelenések megoszlása a hónapban', monthThirdDistribution, '#d29b43')}{renderAttendanceDistribution('Megjelenések a hét napjai szerint', weekdayAttendanceDistribution, '#789b76')}{renderAttendanceDistribution('Megjelenések hétköznap és hétvégén', weekPartDistribution, '#9864a8')}<div className="guestAttendanceDistributionChart"><h4>Átlagos vendég / óra, hétköznap és hétvégén</h4><p className="panelSub">Az adott időszak nem workshop megjelenéseinek száma osztva az importban szereplő nem workshop órák számával.</p><div className="guestChart"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}><BarChart data={averageGuestsPerWeekPart} margin={{ left: 8, right: 14, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{ fontSize: 11 }}/><YAxis allowDecimals tickFormatter={value => Number(value).toFixed(0)}/><Tooltip formatter={(value, _name, item) => [Number(value).toFixed(1) + ' vendég / óra', item.payload.attendees + ' megjelent vendégalkalom · ' + item.payload.classes + ' óra']}/><Bar dataKey="average" name="Vendég / óra" fill="#9864a8" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></div>{renderAttendanceDistribution('Megjelenések napszak szerint', dayPartDistribution, '#49a6a0')}{renderAttendanceDistribution('Kezdési órák népszerűsége', hourlyAttendanceDistribution, '#d16b52')}</div></div></section>
          <section className="panel"><h3>Bérletvásárlások árkategóriánként</h3><p className="panelSub">A százalékos kategóriák a listaár, a baráti és szuper baráti kategóriák a fizetett összeg szerint készülnek.</p><div className="guestChart tall"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={{width:700,height:360}}><BarChart data={passKinds} margin={{left:8,right:12}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Legend/>{visiblePassPriceCategories.map(category => <Bar key={category.key} dataKey={category.key} name={category.name} stackId="passes" fill={category.color}/>)}</BarChart></ResponsiveContainer></div></section>
          <section className="panel"><h3>Kedvezményes bérletek kategóriái</h3><p className="panelSub">Az eladott kedvezményes bérletek megoszlása kedvezménykategóriák szerint.</p><div className="guestChart tall"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={{width:700,height:360}}><BarChart data={discountCategoryStats} layout="vertical" margin={{left:12,right:16}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={115} tick={{fontSize:11}}/><Tooltip/><Bar dataKey="count" name="Bérlet" radius={[0,6,6,0]}>{discountCategoryStats.map(item => <Cell key={item.key} fill={item.color}/>)}</Bar></BarChart></ResponsiveContainer></div></section>
          <section className="panel"><h3>Teljes ár és kedvezményes arány</h3><p className="panelSub">{passPurchases.length} bérletvásárlás az aktuális vendégcsoportban</p><div className="guestPieChart"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250} initialDimension={{width:360,height:280}}><PieChart><Tooltip/><Legend/><Pie data={discountCounts} dataKey="count" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={2}>{discountCounts.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie></PieChart></ResponsiveContainer></div></section></div>
      </div>}
    </>}

    {section === 'courses' && <section className="panel"><h3>Kurzus szerinti megoszlás</h3><p className="panelSub">Óralátogatási importok alapján ({periodLabel}).</p><div className="monthly"><table className="compact"><thead><tr><th>Kurzus</th><th>Egyedi vendég</th><th>Látogatás</th></tr></thead><tbody>{courseStats.map(c => <tr key={c.course}><td>{c.course}</td><td>{c.count}</td><td>{c.visits}</td></tr>)}</tbody></table></div></section>}

    {section === 'comparison' && <>
      <section className="panel"><div className="panelHead"><div><h3>Havi összehasonlítás</h3><p className="panelSub">Alapértelmezésben a legutóbbi regisztrációs hónap és az előző év azonos hónapja.</p></div></div>
        <div className="guestComparePeriods">{[
          { year: compareYearA, setYear: setCompareYearA, month: compareMonthA, setMonth: setCompareMonthA },
          { year: compareYearB, setYear: setCompareYearB, month: compareMonthB, setMonth: setCompareMonthB },
        ].map((item, index) => <div className="guestComparePick" key={index}><strong>{item.year && item.month ? monthName(`${item.year}-${item.month}`) : '—'}</strong><label className="guestSelect"><span>Év</span><select aria-label={`Év ${index + 1}`} value={item.year} onChange={e => item.setYear(e.target.value)}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}{item.year && !availableYears.includes(Number(item.year)) && <option value={item.year}>{item.year}</option>}</select></label><label className="guestSelect"><span>Hónap</span><select aria-label={`Hónap ${index + 1}`} value={item.month} onChange={e => item.setMonth(e.target.value)}>{monthLabels.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label></div>)}</div>
        <table className="guestCompareTable"><thead><tr><th>Mutató</th><th>{compareYearA && compareMonthA ? monthName(`${compareYearA}-${compareMonthA}`) : '—'}</th><th>{compareYearB && compareMonthB ? monthName(`${compareYearB}-${compareMonthB}`) : '—'}</th><th>Változás</th></tr></thead><tbody><tr><td>Regisztrálók</td><td>{monthCompareA.registrations}</td><td>{monthCompareB.registrations}</td><td><Change current={monthCompareA.registrations} previous={monthCompareB.registrations}/></td></tr><tr><td>Eljutott órára</td><td>{monthCompareA.attended}</td><td>{monthCompareB.attended}</td><td><Change current={monthCompareA.attended} previous={monthCompareB.attended}/></td></tr><tr><td>Órára jutási arány</td><td>{monthCompareA.rate.toFixed(1)}%</td><td>{monthCompareB.rate.toFixed(1)}%</td><td><Change current={monthCompareA.rate} previous={monthCompareB.rate} percent/></td></tr></tbody></table>
      </section>
      <section className="panel"><div className="panelHead"><div><h3>Éves összehasonlítás</h3><p className="panelSub">Két teljes naptári év regisztrációs adatainak összevetése.</p></div></div>
        <div className="guestComparePeriods"><div className="guestComparePick"><strong>{compareAnnualA || '—'}</strong><label className="guestSelect"><span>Év</span><select aria-label="Első összehasonlított év" value={compareAnnualA} onChange={e => setCompareAnnualA(e.target.value)}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select></label></div><div className="guestComparePick"><strong>{compareAnnualB || '—'}</strong><label className="guestSelect"><span>Év</span><select aria-label="Második összehasonlított év" value={compareAnnualB} onChange={e => setCompareAnnualB(e.target.value)}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}{compareAnnualB && !availableYears.includes(Number(compareAnnualB)) && <option value={compareAnnualB}>{compareAnnualB}</option>}</select></label></div></div>
        <table className="guestCompareTable"><thead><tr><th>Mutató</th><th>{compareAnnualA || '—'}</th><th>{compareAnnualB || '—'}</th><th>Változás</th></tr></thead><tbody><tr><td>Regisztrálók</td><td>{yearCompareA.registrations}</td><td>{yearCompareB.registrations}</td><td><Change current={yearCompareA.registrations} previous={yearCompareB.registrations}/></td></tr><tr><td>Eljutott órára</td><td>{yearCompareA.attended}</td><td>{yearCompareB.attended}</td><td><Change current={yearCompareA.attended} previous={yearCompareB.attended}/></td></tr><tr><td>Órára jutási arány</td><td>{yearCompareA.rate.toFixed(1)}%</td><td>{yearCompareB.rate.toFixed(1)}%</td><td><Change current={yearCompareA.rate} previous={yearCompareB.rate} percent/></td></tr></tbody></table>
      </section>
    </>}

    {section === 'guest-list' && <section className="panel"><div className="panelHead"><div><h3>Vendéglista</h3><p className="panelSub">{filtered.length} vendég · oszlopfejlécre kattintva rendezhetsz</p></div><div className="actions"><input className="inlineSelect" placeholder="Keresés névre vagy ID-ra" value={query} onChange={e => setQuery(e.target.value)}/><button className="btn" onClick={exportCsv}><Download size={16}/> CSV export</button></div></div><div className="monthly"><table><thead><tr><th>{sortButton('Vendég ID', 'guestId')}</th><th>{sortButton('Vezetéknév', 'lastName')}</th><th>{sortButton('Keresztnév', 'firstName')}</th><th>{sortButton('Regisztráció', 'registeredAt')}</th><th>{sortButton('Első óra', 'firstVisitAt')}</th><th>{sortButton('Utolsó óra', 'lastVisitAt')}</th><th>{sortButton('Kurzusok', 'courses')}</th><th>{sortButton('Tagság', 'activeMembership')}</th></tr></thead><tbody>{sortedFiltered.slice(0, 500).map(g => <tr key={g.guestId}><td>{g.guestId}</td><td>{g.lastName}</td><td>{g.firstName}</td><td>{g.registeredAt || '—'}</td><td>{g.firstVisitAt || '—'}</td><td>{g.lastVisitAt || '—'}</td><td>{g.courses.join(', ') || '—'}</td><td>{g.activeMembership || '—'}</td></tr>)}</tbody></table>{filtered.length > 500 && <p className="panelSub">Az első 500 találat látható. Szűkíts a kereséssel.</p>}</div></section>}
    {loading && <p className="panelSub">Vendégadatok betöltése…</p>}
  </div>;
}
