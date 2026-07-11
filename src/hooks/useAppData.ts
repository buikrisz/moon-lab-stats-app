"use client";

import { useEffect, useMemo, useState } from 'react';
import type { AppData, CalendarEvent, Expense, PassType, Settings, WeekRow } from '../types';

export const useAppData = () => {
  const [data, setData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (!res.ok) {
      setError('Nem sikerült betölteni az adatokat. Ellenőrizd a MongoDB env változókat.');
      setIsLoading(false);
      return;
    }
    setData(await res.json());
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveData = async (nextData: AppData) => {
    setData(nextData);
    setIsSaving(true);
    setError(null);
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextData),
    });
    if (!res.ok) {
      setError('Nem sikerült menteni az adatokat.');
    } else {
      setData(await res.json());
    }
    setIsSaving(false);
  };

  const actions = useMemo(() => ({
    setWeeks: (updater: WeekRow[] | ((weeks: WeekRow[]) => WeekRow[])) => {
      if (!data) return;
      const weeks = typeof updater === 'function' ? updater(data.weeks) : updater;
      saveData({ ...data, weeks });
    },
    setPasses: (updater: PassType[] | ((passes: PassType[]) => PassType[])) => {
      if (!data) return;
      const passes = typeof updater === 'function' ? updater(data.passes) : updater;
      saveData({ ...data, passes });
    },
    setExpenses: (updater: Expense[] | ((expenses: Expense[]) => Expense[])) => {
      if (!data) return;
      const expenses = typeof updater === 'function' ? updater(data.expenses) : updater;
      saveData({ ...data, expenses });
    },
    setCalendarEvents: (updater: CalendarEvent[] | ((events: CalendarEvent[]) => CalendarEvent[])) => {
      if (!data) return;
      const calendarEvents = typeof updater === 'function' ? updater(data.calendarEvents || []) : updater;
      saveData({ ...data, calendarEvents });
    },
    setSettings: (settings: Settings) => {
      if (!data) return;
      saveData({ ...data, settings });
    },
    setFullData: (nextData: AppData) => saveData(nextData),
    replaceDataFromServer: (nextData: AppData) => setData(nextData),
    refetch: fetchData,
  }), [data]);

  return { data, isLoading, isSaving, error, ...actions };
};
