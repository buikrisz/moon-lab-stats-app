"use client";

import { CalendarDays, Save } from 'lucide-react';
import { useState } from 'react';
import type { WeekRow } from '@/types';
import { createEmptyDays } from '@/utils/calculations';
import { formatWeekLabel, getMonthNameFromIso, getWeekEnd, getYearFromIso, isMonday } from '@/utils/date';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';

type Props = {
  onClose: () => void;
  onCreate: (week: WeekRow) => void;
};

export function NewWeekModal({ onClose, onCreate }: Props) {
  const [startDate, setStartDate] = useState('');
  const [customName, setCustomName] = useState('');

  const endDate = startDate && isMonday(startDate) ? getWeekEnd(startDate) : '';
  const generatedName = startDate && endDate ? formatWeekLabel(startDate, endDate) : '';
  const finalName = customName.trim() || generatedName;
  const canCreate = Boolean(startDate && endDate && finalName);

  const create = () => {
    if (!canCreate) return;

    onCreate({
      id: crypto.randomUUID(),
      week: finalName,
      startDate,
      endDate,
      year: getYearFromIso(startDate),
      month: getMonthNameFromIso(startDate),
      status: 'open',
      monthClosed: false,
      expiredPasses: 0,
      studioRent: 0,
      note: '',
      source: 'manual',
      days: createEmptyDays(),
    });
  };

  return (
    <Modal title="Új hét indítása" onClose={onClose}>
      <div className="infoBox">
        Válassz hétfői kezdőnapot. A rendszer automatikusan vasárnapig számolja a hetet.
      </div>

      <div className="formGrid">
        <label>
          Hét kezdete
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </label>

        <label>
          Hét neve, szerkeszthető
          <input value={customName || generatedName} onChange={e => setCustomName(e.target.value)} placeholder="Automatikus név" />
        </label>
      </div>

      {startDate && !isMonday(startDate) && (
        <p className="errorText">A kiválasztott nap nem hétfő. Kérlek hétfőt válassz.</p>
      )}

      {startDate && endDate && (
        <div className="miniStats">
          <div><CalendarDays size={18}/> Kezdés <b>{startDate}</b></div>
          <div><CalendarDays size={18}/> Zárás <b>{endDate}</b></div>
          <div>Havi besorolás <b>{getMonthNameFromIso(startDate)}</b></div>
        </div>
      )}

      <div className="modalActions">
        <Button onClick={onClose}>Mégse</Button>
        <Button variant="primary" disabled={!canCreate} onClick={create}><Save size={16}/> Hét létrehozása</Button>
      </div>
    </Modal>
  );
}
