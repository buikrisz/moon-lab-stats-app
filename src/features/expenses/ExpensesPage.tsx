"use client";

import { Edit3, Plus, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Expense } from '../../types';
import { months } from '../../utils/calculations';
import { huf } from '../../utils/format';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';

type Props = {
  expenses: Expense[];
  setExpenses: (updater: Expense[] | ((expenses: Expense[]) => Expense[])) => void;
  variableCategories: string[];
  selectedYear: number;
  selectedMonth: string;
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: string) => void;
};

export function ExpensesPage({ expenses, setExpenses, variableCategories, selectedYear, selectedMonth, setSelectedYear, setSelectedMonth }: Props) {
  const currentYear = new Date().getFullYear();
  const [modal, setModal] = useState<Expense | 'new-fixed' | 'new-manual' | null>(null);
  const year = selectedYear;
  const month = selectedMonth;

  const years = useMemo(() => {
    const fromExpenses = expenses.map(e => e.year).filter(Boolean) as number[];
    return Array.from(new Set([2025, 2026, currentYear, ...fromExpenses])).sort((a, b) => b - a);
  }, [expenses, currentYear]);

  const fixedExpenses = expenses.filter(e => e.active !== false && (
    e.expenseType === 'fixed' ||
    /bérlet|bérleti|tisztító|motibro/i.test(e.name)
  ));

  const monthlyExpenses = expenses.filter(e => e.active !== false && (
    e.expenseType === 'monthly-manual' ||
    (e.recurrence === 'one-time' && Boolean(e.year))
  ));

  const filteredMonthlyExpenses = monthlyExpenses.filter(e => e.year === year && e.month === month);

  const save = (expense: Expense) => {
    const normalized = {
      ...expense,
      active: true,
      name: expense.category,
    };

    setExpenses(prev => modal === 'new-fixed' || modal === 'new-manual'
      ? [normalized, ...prev]
      : prev.map(e => e.id === normalized.id ? normalized : e)
    );

    if (normalized.expenseType === 'monthly-manual') {
      if (normalized.year) setSelectedYear(normalized.year);
      setSelectedMonth(normalized.month);
    }

    setModal(null);
  };

  const remove = (id: string) => {
    if (confirm('Biztos törlöd ezt a költséget?')) {
      setExpenses(prev => prev.filter(e => e.id !== id));
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <div className="panelHead">
          <div>
            <h2>Fix havi költségek</h2>
            <p className="panelSub">Ezek minden hónapban automatikusan bekerülnek az éves kimutatásba.</p>
          </div>
          <Button variant="primary" onClick={() => setModal('new-fixed')}><Plus size={17}/> Új fix költség</Button>
        </div>

        <table>
          <thead><tr><th>Név</th><th>Kategória</th><th>Összeg</th><th>Műveletek</th></tr></thead>
          <tbody>{fixedExpenses.map(e => (
            <tr key={e.id}>
              <td><b>{e.name}</b></td>
              <td>{e.category}</td>
              <td>{huf(e.amount)}</td>
              <td className="rowActions">
                <Button variant="icon" onClick={() => setModal(e)}><Edit3 size={15}/></Button>
                <Button variant="icon" onClick={() => remove(e.id)}><Trash2 size={15}/></Button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <h2>Havi manuális költségek</h2>
            <p className="panelSub">Számlázz.hu, hirdetés, rezsi és egyéb havi tételek.</p>
          </div>
          <div className="actions">
            <label className="selectWrap">
              <select value={year} onChange={e => setSelectedYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="selectWrap">
              <select value={month} onChange={e => setSelectedMonth(e.target.value)}>
                {months.map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
            <Button variant="primary" onClick={() => setModal('new-manual')}><Plus size={17}/> Új havi költség</Button>
          </div>
        </div>

        <table>
          <thead><tr><th>Kategória</th><th>Év</th><th>Hónap</th><th>Összeg</th><th>Műveletek</th></tr></thead>
          <tbody>
            {filteredMonthlyExpenses.map(e => (
              <tr key={e.id}>
                <td><b>{e.category}</b></td>
                <td>{e.year}</td>
                <td>{e.month}</td>
                <td>{huf(e.amount)}</td>
                <td className="rowActions">
                  <Button variant="icon" onClick={() => setModal(e)}><Edit3 size={15}/></Button>
                  <Button variant="icon" onClick={() => remove(e.id)}><Trash2 size={15}/></Button>
                </td>
              </tr>
            ))}
            {filteredMonthlyExpenses.length === 0 && (
              <tr><td colSpan={5} className="emptyTableCell">Nincs manuális költség erre a hónapra.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {modal && <ExpenseModal
        expense={modal === 'new-fixed'
          ? { id: crypto.randomUUID(), name: 'Bérleti díj', category: 'Bérlet', amount: 0, recurrence: 'monthly', month: 'Minden hónap', active: true, expenseType: 'fixed' }
          : modal === 'new-manual'
            ? { id: crypto.randomUUID(), name: variableCategories[0] || 'Számlázz.hu', category: variableCategories[0] || 'Számlázz.hu', amount: 0, recurrence: 'one-time', month, year, active: true, expenseType: 'monthly-manual' }
            : modal}
        mode={modal === 'new-fixed' ? 'fixed' : modal === 'new-manual' ? 'manual' : modal.expenseType === 'fixed' ? 'fixed' : 'manual'}
        variableCategories={variableCategories}
        onClose={() => setModal(null)}
        onSave={save}
      />}
    </div>
  );
}

function ExpenseModal({ expense, mode, variableCategories, onClose, onSave }: { expense: Expense; mode: 'fixed' | 'manual'; variableCategories: string[]; onClose: () => void; onSave: (expense: Expense) => void }) {
  const [form, setForm] = useState(expense);
  const selectedCategory = form.category || variableCategories[0] || 'Számlázz.hu';

  const updateManualCategory = (category: string) => {
    setForm({ ...form, category, name: category });
  };

  return (
    <Modal title={mode === 'fixed' ? 'Fix költség szerkesztése' : 'Havi költség szerkesztése'} onClose={onClose}>
      <div className="formGrid">
        {mode === 'fixed' && (
          <>
            <label>Név<input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label>
            <label>Kategória<input value={form.category} onChange={e => setForm({...form, category:e.target.value})}/></label>
          </>
        )}

        {mode === 'manual' && (
          <>
            <label>Kategória
              <select value={selectedCategory} onChange={e => updateManualCategory(e.target.value)}>
                {variableCategories.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Év<input type="number" value={form.year || new Date().getFullYear()} onChange={e => setForm({...form, year:Number(e.target.value)})}/></label>
            <label>Hónap<select value={form.month} onChange={e => setForm({...form, month:e.target.value})}>{months.map(m => <option key={m}>{m}</option>)}</select></label>
          </>
        )}

        <label>Összeg<input type="number" value={form.amount} onChange={e => setForm({...form, amount:Number(e.target.value)})}/></label>
      </div>

      <div className="modalActions">
        <Button onClick={onClose}>Mégse</Button>
        <Button variant="primary" onClick={() => onSave({
          ...form,
          active: true,
          name: mode === 'manual' ? form.category : form.name,
          expenseType: mode === 'fixed' ? 'fixed' : 'monthly-manual',
          recurrence: mode === 'fixed' ? 'monthly' : 'one-time',
        })}><Save size={16}/> Mentés</Button>
      </div>
    </Modal>
  );
}
