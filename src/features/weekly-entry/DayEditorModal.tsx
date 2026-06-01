"use client";

import { Minus, Plus, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DayRow, PassType } from '../../types';
import { recalcDay } from '../../utils/calculations';
import { huf } from '../../utils/format';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';

type Props = {
  day: DayRow;
  passes: PassType[];
  trainerHourlyCost: number;
  fullHourTrainerCost: number;
  onClose: () => void;
  onSave: (day: DayRow) => void;
};

export function DayEditorModal({ day, passes, trainerHourlyCost, fullHourTrainerCost, onClose, onSave }: Props) {
  const [form, setForm] = useState<DayRow>({
    ...day,
    specialTrainerCosts: day.specialTrainerCosts || [],
    extraRevenues: day.extraRevenues || [],
  });

  const [specialLabel, setSpecialLabel] = useState('Workshop / event');
  const [specialCost, setSpecialCost] = useState(0);

  const [isOtherEntryOpen, setIsOtherEntryOpen] = useState(false);
  const [otherAmount, setOtherAmount] = useState(0);
  const [otherQuantity, setOtherQuantity] = useState(1);


  const activePasses = passes.filter(p => p.active).sort((a, b) => (b.price / b.occasions) - (a.price / a.occasions));
  const calculated = useMemo(() => recalcDay(form, trainerHourlyCost, fullHourTrainerCost), [form, trainerHourlyCost, fullHourTrainerCost]);

  const addEntry = (pass: PassType) => {
    const amount = Math.round(pass.price / pass.occasions);
    setForm(prev => {
      const existing = prev.entries.find(e => e.label === pass.name && e.amount === amount);
      const entries = existing
        ? prev.entries.map(e => e.id === existing.id ? { ...e, quantity: e.quantity + 1 } : e)
        : [...prev.entries, { id: crypto.randomUUID(), label: pass.name, amount, quantity: 1 }];
      return recalcDay({ ...prev, entries }, trainerHourlyCost, fullHourTrainerCost);
    });
  };

  const addOtherEntry = () => {
    if (!otherAmount || otherAmount <= 0 || !otherQuantity || otherQuantity <= 0) return;

    setForm(prev => {
      const entries = [
        ...prev.entries,
        { id: crypto.randomUUID(), label: 'Egyéb', amount: otherAmount, quantity: otherQuantity },
      ];
      return recalcDay({ ...prev, entries }, trainerHourlyCost, fullHourTrainerCost);
    });

    setOtherAmount(0);
    setOtherQuantity(1);
    setIsOtherEntryOpen(false);
  };

  const updateEntryQuantity = (id: string, delta: number) => {
    setForm(prev => {
      const entries = prev.entries
        .map(e => e.id === id ? { ...e, quantity: Math.max(0, e.quantity + delta) } : e)
        .filter(e => e.quantity > 0);
      return recalcDay({ ...prev, entries }, trainerHourlyCost, fullHourTrainerCost);
    });
  };

  const removeEntry = (id: string) => {
    setForm(prev => recalcDay({ ...prev, entries: prev.entries.filter(e => e.id !== id) }, trainerHourlyCost, fullHourTrainerCost));
  };

  const setHours = (key: 'heldHours' | 'fullHours', value: number) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'heldHours' && next.fullHours > value) next.fullHours = value;
      return recalcDay(next, trainerHourlyCost, fullHourTrainerCost);
    });
  };

  const addSpecialTrainerCost = () => {
    if (!specialCost || specialCost <= 0) return;
    setForm(prev => recalcDay({
      ...prev,
      specialTrainerCosts: [
        ...(prev.specialTrainerCosts || []),
        { id: crypto.randomUUID(), label: specialLabel.trim() || 'Speciális óra', cost: specialCost },
      ],
    }, trainerHourlyCost, fullHourTrainerCost));
    setSpecialLabel('Workshop / event');
    setSpecialCost(0);
  };

  const removeSpecialTrainerCost = (id: string) => {
    setForm(prev => recalcDay({
      ...prev,
      specialTrainerCosts: (prev.specialTrainerCosts || []).filter(item => item.id !== id),
    }, trainerHourlyCost, fullHourTrainerCost));
  };


  const regularHours = Math.max(calculated.heldHours - calculated.fullHours, 0);
  const baseTrainerCost = regularHours * trainerHourlyCost + calculated.fullHours * fullHourTrainerCost;
  const specialTrainerCost = (calculated.specialTrainerCosts || []).reduce((sum, item) => sum + item.cost, 0);

  return (
    <Modal title={`${day.day} napi rögzítés`} onClose={onClose}>
      <div className="quickButtons">
        {activePasses.map(pass => {
          const amount = Math.round(pass.price / pass.occasions);
          return (
            <button key={pass.id} onClick={() => addEntry(pass)}>
              <strong>{huf(amount)}</strong>
              <span>{pass.name}</span>
            </button>
          );
        })}
        <button className="otherPassCard" onClick={() => setIsOtherEntryOpen(prev => !prev)}>
          <strong>Egyéb</strong>
          <span>Totál bevétel + fő</span>
        </button>
      </div>

      {isOtherEntryOpen && (
        <div className="otherEntryBox">
          <label>Összes bevétel
            <input type="number" value={otherAmount} onChange={e => setOtherAmount(Number(e.target.value))} placeholder="pl. 70000" />
          </label>
          <label>Fő
            <input type="number" min="1" value={otherQuantity} onChange={e => setOtherQuantity(Number(e.target.value))} />
          </label>
          <Button variant="primary" onClick={addOtherEntry}><Plus size={15}/> Egyéb hozzáadása</Button>
        </div>
      )}

      <div className="formGrid">
        <label>Megtartott órák
          <input type="number" min="0" step="0.5" value={form.heldHours} onChange={e => setHours('heldHours', Number(e.target.value))} />
        </label>
        <label>Teltházas órák
          <input type="number" min="0" max={form.heldHours} step="0.5" value={form.fullHours} onChange={e => setHours('fullHours', Number(e.target.value))} />
        </label>
      </div>

      <div className="entryList">
        <h3>Résztvevő bevételek</h3>
        {form.entries.length === 0 && <p className="emptyText">Még nincs bevitt résztvevő.</p>}
        {form.entries.map(entry => (
          <div className="entryRow" key={entry.id}>
            <div>
              <strong>{entry.label}</strong>
              <span>{entry.label === 'Egyéb' ? 'Totál bevétel' : `${huf(entry.amount)} / résztvevő`}</span>
            </div>
            <div className="qtyControls">
              {entry.label !== 'Egyéb' && <Button variant="icon" onClick={() => updateEntryQuantity(entry.id, -1)}><Minus size={15}/></Button>}
              <b>{entry.quantity} fő</b>
              {entry.label !== 'Egyéb' && <Button variant="icon" onClick={() => updateEntryQuantity(entry.id, 1)}><Plus size={15}/></Button>}
              <Button variant="icon" onClick={() => removeEntry(entry.id)}><Trash2 size={15}/></Button>
            </div>
            <b>{huf(entry.label === 'Egyéb' ? entry.amount : entry.amount * entry.quantity)}</b>
          </div>
        ))}
      </div>

      <div className="entryList specialCostBox">
        <h3>Speciális oktatói költség</h3>
        <div className="specialCostForm">
          <input value={specialLabel} onChange={e => setSpecialLabel(e.target.value)} placeholder="Workshop / event neve" />
          <input type="number" value={specialCost} onChange={e => setSpecialCost(Number(e.target.value))} placeholder="Oktatói költség" />
          <Button variant="primary" onClick={addSpecialTrainerCost}><Plus size={15}/> Hozzáadás</Button>
        </div>

        {(form.specialTrainerCosts || []).length === 0 && <p className="emptyText">Nincs speciális oktatói költség.</p>}
        {(form.specialTrainerCosts || []).map(item => (
          <div className="entryRow" key={item.id}>
            <div>
              <strong>{item.label}</strong>
              <span>Manuális oktatói költség</span>
            </div>
            <span />
            <div className="qtyControls">
              <b>{huf(item.cost)}</b>
              <Button variant="icon" onClick={() => removeSpecialTrainerCost(item.id)}><Trash2 size={15}/></Button>
            </div>
          </div>
        ))}
      </div>

      <div className="miniStats">
        <div>Bevétel <b>{huf(calculated.revenue)}</b></div>
        <div>Résztvevők <b>{calculated.participants}</b></div>
        <div>Oktatói alap <b>{huf(baseTrainerCost)}</b></div>
        <div>Össz. oktatói <b>{huf(calculated.trainerCost)}</b></div>
      </div>

      <div className="modalActions">
        <Button onClick={onClose}>Mégse</Button>
        <Button variant="primary" onClick={() => onSave(calculated)}><Save size={16}/> Mentés</Button>
      </div>
    </Modal>
  );
}
