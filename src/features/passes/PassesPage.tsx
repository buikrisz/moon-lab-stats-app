"use client";

import { Edit3, Plus, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PassType } from '../../types';
import { huf, safeDiv } from '../../utils/format';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';

type Props = {
  passes: PassType[];
  setPasses: (updater: PassType[] | ((passes: PassType[]) => PassType[])) => void;
};

type SortKey = 'name' | 'price' | 'occasions' | 'unitPrice' | 'active';
type SortDirection = 'asc' | 'desc';

export function PassesPage({ passes, setPasses }: Props) {
  const [modal, setModal] = useState<PassType | 'new' | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedPasses = useMemo(() => {
    return [...passes].sort((a, b) => {
      const getValue = (p: PassType) => {
        if (sortKey === 'unitPrice') return safeDiv(p.price, p.occasions);
        if (sortKey === 'active') return p.active ? 1 : 0;
        return p[sortKey];
      };

      const av = getValue(a);
      const bv = getValue(b);
      const result = typeof av === 'string'
        ? av.localeCompare(String(bv), 'hu')
        : Number(av) - Number(bv);

      return sortDirection === 'asc' ? result : -result;
    });
  }, [passes, sortKey, sortDirection]);

  const changeSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'price' ? 'desc' : 'asc');
  };

  const sortMark = (key: SortKey) => sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

  const save = (pass: PassType) => {
    setPasses(prev => modal === 'new' ? [pass, ...prev] : prev.map(p => p.id === pass.id ? pass : p));
    setModal(null);
  };

  const remove = (id: string) => {
    if (confirm('Biztos törlöd ezt a bérletet?')) {
      setPasses(prev => prev.filter(pass => pass.id !== id));
    }
  };

  return (
    <section className="panel">
      <div className="panelHead"><h2>Bérletek / árak</h2><Button variant="primary" onClick={() => setModal('new')}><Plus size={17}/> Új bérlet</Button></div>
      <table>
        <thead>
          <tr>
            <th><button className="sortHeader" onClick={() => changeSort('name')}>Név{sortMark('name')}</button></th>
            <th><button className="sortHeader" onClick={() => changeSort('price')}>Ár{sortMark('price')}</button></th>
            <th><button className="sortHeader" onClick={() => changeSort('occasions')}>Alkalmak{sortMark('occasions')}</button></th>
            <th><button className="sortHeader" onClick={() => changeSort('unitPrice')}>Egy alkalom értéke{sortMark('unitPrice')}</button></th>
            <th><button className="sortHeader" onClick={() => changeSort('active')}>Aktív{sortMark('active')}</button></th>
            <th>Műveletek</th>
          </tr>
        </thead>
        <tbody>{sortedPasses.map(p => (
          <tr key={p.id}>
            <td><b>{p.name}</b></td><td>{huf(p.price)}</td><td>{p.occasions}</td><td>{huf(safeDiv(p.price, p.occasions))}</td><td>{p.active ? 'Igen' : 'Nem'}</td>
            <td className="rowActions">
              <Button variant="icon" onClick={() => setModal(p)}><Edit3 size={15}/></Button>
              <Button variant="icon" onClick={() => remove(p.id)}><Trash2 size={15}/></Button>
            </td>
          </tr>
        ))}</tbody>
      </table>

      {modal && <PassModal pass={modal === 'new' ? { id: crypto.randomUUID(), name: '', price: 0, occasions: 1, active: true } : modal} onClose={() => setModal(null)} onSave={save} />}
    </section>
  );
}

function PassModal({ pass, onClose, onSave }: { pass: PassType; onClose: () => void; onSave: (pass: PassType) => void }) {
  const [form, setForm] = useState(pass);
  return (
    <Modal title="Bérlet szerkesztése" onClose={onClose}>
      <div className="formGrid">
        <label>Név<input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label>
        <label>Ár<input type="number" value={form.price} onChange={e => setForm({...form, price:Number(e.target.value)})}/></label>
        <label>Alkalmak<input type="number" value={form.occasions} onChange={e => setForm({...form, occasions:Number(e.target.value)})}/></label>
        <label>Aktív<select value={String(form.active)} onChange={e => setForm({...form, active:e.target.value === 'true'})}><option value="true">Igen</option><option value="false">Nem</option></select></label>
      </div>
      <div className="modalActions"><Button onClick={onClose}>Mégse</Button><Button variant="primary" onClick={() => onSave(form)}><Save size={16}/> Mentés</Button></div>
    </Modal>
  );
}
