"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import type { CalendarEvent, CalendarEventColor } from '../../types';

type CalendarView = 'day' | 'week' | 'month' | 'year';

type Props = {
  events: CalendarEvent[];
  setEvents: (updater: CalendarEvent[] | ((events: CalendarEvent[]) => CalendarEvent[])) => void;
};

const monthNames = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
];
const dayNames = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const fullDayNames = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'];
const hours = Array.from({ length: 16 }, (_, index) => index + 6);
const timelineStartMinute = 6 * 60;
const timelineEndMinute = 22 * 60;
const hourRowHeight = 58;
const eventColorOptions: { value: CalendarEventColor; label: string }[] = [
  { value: 'green', label: 'Zöld' },
  { value: 'yellow', label: 'Sárga' },
  { value: 'red', label: 'Piros' },
  { value: 'purple', label: 'Lila' },
  { value: 'blue', label: 'Kék' },
];

const pad = (value: number) => String(value).padStart(2, '0');
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toDateTimeInput = (date: Date) => `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};
const startOfWeek = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
};
const startOfMonthGrid = (date: Date) => startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
const dayRange = (date: Date) => {
  const key = toDateKey(date);
  return { start: `${key}T00:00`, end: `${key}T23:59` };
};
const eventOverlapsDay = (event: CalendarEvent, date: Date) => {
  const range = dayRange(date);
  return event.start <= range.end && event.end >= range.start;
};
const minutesFromDateTime = (dateTime: string) => {
  const [hour = '0', minute = '0'] = dateTime.slice(11, 16).split(':');
  return Number(hour) * 60 + Number(minute);
};
const normalizeAllDayRange = (startDate: string, endDate: string) => ({
  start: `${startDate}T00:00`,
  end: `${endDate}T23:59`,
});
const getEventColor = (event: Pick<CalendarEvent, 'color'>): CalendarEventColor => event.color || 'green';

const formatEventTime = (event: CalendarEvent) => {
  const startDay = event.start.slice(0, 10);
  const endDay = event.end.slice(0, 10);
  if (event.allDay) return startDay === endDay ? 'Egész nap' : `${startDay} - ${endDay}`;

  const startTime = event.start.slice(11, 16);
  const endTime = event.end.slice(11, 16);
  if (startDay === endDay) return `${startTime}-${endTime}`;
  return `${startDay} ${startTime} - ${endDay} ${endTime}`;
};

const createTimedEvent = (date = new Date(), hour?: number): CalendarEvent => {
  const start = new Date(date);
  const selectedHour = hour ?? new Date().getHours();
  start.setHours(selectedHour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    id: `event-${Date.now()}`,
    title: '',
    start: toDateTimeInput(start),
    end: toDateTimeInput(end),
    allDay: false,
    description: '',
    color: 'green',
  };
};

const createAllDayEvent = (date: Date): CalendarEvent => {
  const dateKey = toDateKey(date);
  return {
    id: `event-${Date.now()}`,
    title: '',
    ...normalizeAllDayRange(dateKey, dateKey),
    allDay: true,
    description: '',
    color: 'green',
  };
};

export function CalendarPage({ events, setEvents }: Props) {
  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [draft, setDraft] = useState<CalendarEvent | null>(null);
  const [formError, setFormError] = useState('');

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.start.localeCompare(b.start)),
    [events]
  );

  const periodTitle = useMemo(() => {
    if (view === 'day') return `${monthNames[anchorDate.getMonth()]} ${anchorDate.getDate()}, ${anchorDate.getFullYear()}`;
    if (view === 'week') {
      const start = startOfWeek(anchorDate);
      const end = addDays(start, 6);
      return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    if (view === 'month') return `${monthNames[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
    return `${anchorDate.getFullYear()}`;
  }, [anchorDate, view]);

  const movePeriod = (direction: -1 | 1) => {
    if (view === 'day') setAnchorDate(addDays(anchorDate, direction));
    if (view === 'week') setAnchorDate(addDays(anchorDate, direction * 7));
    if (view === 'month') setAnchorDate(addMonths(anchorDate, direction));
    if (view === 'year') setAnchorDate(new Date(anchorDate.getFullYear() + direction, anchorDate.getMonth(), 1));
  };

  const openNewTimedEvent = (date = new Date(), hour?: number) => {
    setEditingEvent(null);
    setDraft(createTimedEvent(date, hour));
    setFormError('');
  };

  const openNewAllDayEvent = (date: Date) => {
    setEditingEvent(null);
    setDraft(createAllDayEvent(date));
    setFormError('');
  };

  const openDay = (date: Date) => {
    setAnchorDate(date);
    setView('day');
  };

  const openEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setDraft({ ...event, allDay: event.allDay || false, color: getEventColor(event) });
    setFormError('');
  };

  const saveEvent = () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setFormError('Adj meg egy esemény nevet.');
      return;
    }

    const cleanEvent = { ...draft, title: draft.title.trim(), description: draft.description?.trim() || '', color: getEventColor(draft) };
    if (cleanEvent.allDay) {
      const normalized = normalizeAllDayRange(cleanEvent.start.slice(0, 10), cleanEvent.end.slice(0, 10));
      cleanEvent.start = normalized.start;
      cleanEvent.end = normalized.end;
    }

    if (cleanEvent.end < cleanEvent.start) {
      setFormError('A befejezés nem lehet korábban, mint a kezdés.');
      return;
    }

    setEvents(current => {
      const exists = current.some(event => event.id === cleanEvent.id);
      return exists ? current.map(event => event.id === cleanEvent.id ? cleanEvent : event) : [...current, cleanEvent];
    });
    setDraft(null);
    setEditingEvent(null);
  };

  const deleteEvent = () => {
    if (!draft) return;
    if (!window.confirm('Biztosan törlöd ezt az eseményt?')) return;
    setEvents(current => current.filter(event => event.id !== draft.id));
    setDraft(null);
    setEditingEvent(null);
  };

  const renderEventChip = (event: CalendarEvent, compact = false) => (
    <button className={`calendarEventChip calendarEventColor-${getEventColor(event)} ${compact ? 'compactEventChip' : ''}`} key={event.id} onClick={(e) => { e.stopPropagation(); openEvent(event); }}>
      <span>{formatEventTime(event)}</span>
      <strong>{event.title}</strong>
    </button>
  );

  const renderMonthGrid = (monthDate = anchorDate, mini = false) => {
    const start = startOfMonthGrid(monthDate);
    const days = Array.from({ length: mini ? 35 : 42 }, (_, index) => addDays(start, index));

    return (
      <div className={mini ? 'miniMonthGrid' : 'calendarMonthGrid'}>
        {dayNames.map(day => <div className="calendarDayName" key={day}>{day}</div>)}
        {days.map(day => {
          const inMonth = day.getMonth() === monthDate.getMonth();
          const dayEvents = sortedEvents.filter(event => eventOverlapsDay(event, day));
          return (
            <div
              role="button"
              tabIndex={0}
              className={`calendarDayCell ${inMonth ? '' : 'outsideMonth'} ${toDateKey(day) === toDateKey(new Date()) ? 'todayCell' : ''}`}
              key={toDateKey(day)}
              onClick={() => openDay(day)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openDay(day);
                }
              }}
            >
              <span className="calendarDateNumber">{day.getDate()}</span>
              {!mini && (
                <>
                  <button className="calendarDayAddButton" onClick={(event) => { event.stopPropagation(); openNewAllDayEvent(day); }} aria-label="Új egész napos esemény">
                    <Plus size={14} />
                  </button>
                  <div className="calendarCellEvents">{dayEvents.map(event => renderEventChip(event, true))}</div>
                </>
              )}
              {mini && dayEvents.length > 0 && <span className={`miniEventDot calendarEventColor-${getEventColor(dayEvents[0])}`} />}
            </div>
          );
        })}
      </div>
    );
  };

  const getEventSegment = (event: CalendarEvent, date: Date) => {
    if (event.allDay || !eventOverlapsDay(event, date)) return null;

    const dayKey = toDateKey(date);
    const rawStart = event.start.slice(0, 10) < dayKey ? 0 : minutesFromDateTime(event.start);
    const rawEnd = event.end.slice(0, 10) > dayKey ? 24 * 60 : minutesFromDateTime(event.end);
    const startMinute = Math.max(timelineStartMinute, rawStart);
    const endMinute = Math.min(timelineEndMinute, rawEnd);
    if (endMinute <= timelineStartMinute || startMinute >= timelineEndMinute || endMinute <= startMinute) return null;

    return {
      top: ((startMinute - timelineStartMinute) / 60) * hourRowHeight,
      height: Math.max(30, ((endMinute - startMinute) / 60) * hourRowHeight),
    };
  };

  const renderDayList = (date: Date) => {
    const dayEvents = sortedEvents.filter(event => eventOverlapsDay(event, date));
    const allDayEvents = dayEvents.filter(event => event.allDay);
    const timedEvents = dayEvents.filter(event => !event.allDay);

    return (
      <div className="calendarDaySchedule">
        <div className="calendarAllDayLane">
          <span>Egész nap</span>
          <div>
            {allDayEvents.length > 0
              ? allDayEvents.map(event => renderEventChip(event))
              : <button className="calendarEmptyLane" onClick={() => openNewAllDayEvent(date)}>Új egész napos esemény</button>}
          </div>
        </div>

        <div className="calendarTimeline">
          <div className="calendarTimeLabels">
            {hours.map(hour => <span key={hour}>{pad(hour)}:00</span>)}
          </div>
          <div className="calendarTimelineBody">
            {hours.map(hour => (
              <button className="calendarHourSlot" key={hour} onClick={() => openNewTimedEvent(date, hour)} aria-label={`${pad(hour)}:00 esemény hozzáadása`} />
            ))}
            {timedEvents.map(event => {
              const segment = getEventSegment(event, date);
              if (!segment) return null;
              return (
                <button
                  className={`calendarTimedEvent calendarEventColor-${getEventColor(event)}`}
                  key={event.id}
                  style={{ top: segment.top, height: segment.height }}
                  onClick={(clickEvent) => { clickEvent.stopPropagation(); openEvent(event); }}
                >
                  <span>{formatEventTime(event)}</span>
                  <strong>{event.title}</strong>
                </button>
              );
            })}
          </div>
        </div>
        {dayEvents.length === 0 && <div className="calendarEmpty">Nincs esemény ezen a napon.</div>}
      </div>
    );
  };

  const renderWeek = () => {
    const start = startOfWeek(anchorDate);
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    return (
      <div className="calendarWeekGrid">
        {days.map((day, index) => (
          <section className="calendarWeekDay" key={toDateKey(day)}>
            <button className="calendarWeekHead" onClick={() => openDay(day)}>
              <strong>{fullDayNames[index]}</strong>
              <span>{monthNames[day.getMonth()]} {day.getDate()}</span>
            </button>
            {sortedEvents.filter(event => eventOverlapsDay(event, day)).map(event => renderEventChip(event))}
          </section>
        ))}
      </div>
    );
  };

  const renderYear = () => (
    <div className="calendarYearGrid">
      {Array.from({ length: 12 }, (_, index) => {
        const monthDate = new Date(anchorDate.getFullYear(), index, 1);
        return (
          <section className="calendarMiniMonth" key={index}>
            <button onClick={() => { setAnchorDate(monthDate); setView('month'); }}>{monthNames[index]}</button>
            {renderMonthGrid(monthDate, true)}
          </section>
        );
      })}
    </div>
  );

  return (
    <section className="panel calendarPanel">
      <div className="calendarToolbar">
        <div className="segmented calendarViewSwitch">
          {(['day', 'week', 'month', 'year'] as CalendarView[]).map(nextView => (
            <button className={view === nextView ? 'active' : ''} key={nextView} onClick={() => setView(nextView)}>
              {nextView === 'day' ? 'Nap' : nextView === 'week' ? 'Hét' : nextView === 'month' ? 'Hónap' : 'Év'}
            </button>
          ))}
        </div>

        <div className="calendarPeriodControls">
          <Button variant="icon" onClick={() => movePeriod(-1)}><ChevronLeft size={18} /></Button>
          <strong>{periodTitle}</strong>
          <Button variant="icon" onClick={() => movePeriod(1)}><ChevronRight size={18} /></Button>
        </div>

        <div className="calendarActions">
          <Button onClick={() => setAnchorDate(new Date())}>Ma</Button>
          <Button variant="primary" onClick={() => openNewTimedEvent()}><Plus size={17} /> Új esemény</Button>
        </div>
      </div>

      {view === 'day' && renderDayList(anchorDate)}
      {view === 'week' && renderWeek()}
      {view === 'month' && renderMonthGrid()}
      {view === 'year' && renderYear()}

      {draft && (
        <Modal title={editingEvent ? 'Esemény szerkesztése' : 'Új esemény'} onClose={() => setDraft(null)}>
          <div className="formGrid calendarForm">
            <label>
              Esemény neve
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Esemény neve" />
            </label>
            <fieldset className="calendarColorField">
              <legend>Szín</legend>
              <div className="calendarColorOptions">
                {eventColorOptions.map(option => (
                  <button
                    type="button"
                    className={`calendarColorOption calendarEventColor-${option.value} ${getEventColor(draft) === option.value ? 'active' : ''}`}
                    key={option.value}
                    onClick={() => setDraft({ ...draft, color: option.value })}
                    aria-pressed={getEventColor(draft) === option.value}
                  >
                    <span />
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="calendarCheckboxField">
              <input
                type="checkbox"
                checked={draft.allDay || false}
                onChange={e => {
                  if (e.target.checked) {
                    const normalized = normalizeAllDayRange(draft.start.slice(0, 10), draft.end.slice(0, 10));
                    setDraft({ ...draft, ...normalized, allDay: true });
                  } else {
                    const startDate = parseDateKey(draft.start.slice(0, 10));
                    startDate.setHours(9, 0, 0, 0);
                    const endDate = new Date(startDate);
                    endDate.setHours(10, 0, 0, 0);
                    setDraft({ ...draft, start: toDateTimeInput(startDate), end: toDateTimeInput(endDate), allDay: false });
                  }
                }}
              />
              Egész nap
            </label>
            {draft.allDay ? (
              <>
                <label>
                  Kezdés
                  <input
                    type="date"
                    value={draft.start.slice(0, 10)}
                    onChange={e => setDraft({ ...draft, start: `${e.target.value}T00:00` })}
                  />
                </label>
                <label>
                  Befejezés
                  <input
                    type="date"
                    value={draft.end.slice(0, 10)}
                    onChange={e => setDraft({ ...draft, end: `${e.target.value}T23:59` })}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Kezdés
                  <input type="datetime-local" value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} />
                </label>
                <label>
                  Befejezés
                  <input type="datetime-local" value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} />
                </label>
              </>
            )}
            <label className="calendarDescriptionField">
              Megjegyzés
              <textarea value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </label>
          </div>
          {formError && <div className="errorText">{formError}</div>}
          <div className="modalActions calendarModalActions">
            {editingEvent && <Button variant="danger" onClick={deleteEvent}><Trash2 size={17} /> Törlés</Button>}
            <Button onClick={() => setDraft(null)}>Mégse</Button>
            <Button variant="primary" onClick={saveEvent}>Mentés</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
