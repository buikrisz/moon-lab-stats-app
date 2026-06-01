"use client";

import { LogOut, Mail, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Settings } from '../../types';
import { Button } from '../../components/common/Button';

type Props = {
  settings: Settings;
  setSettings: (settings: Settings) => void;
};

export function SettingsPage({ settings, setSettings }: Props) {
  const [form, setForm] = useState<Settings>({
    ...settings,
    variableExpenseCategories: settings.variableExpenseCategories?.length
      ? settings.variableExpenseCategories
      : ['Számlázz.hu', 'Hirdetés', 'Rezsi'],
  });
  const [newCategory, setNewCategory] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  const categories = form.variableExpenseCategories || [];

  const addCategory = () => {
    const value = newCategory.trim();
    if (!value || categories.includes(value)) return;
    setForm({ ...form, variableExpenseCategories: [...categories, value] });
    setNewCategory('');
  };

  const removeCategory = (category: string) => {
    if (!confirm(`Biztos törlöd ezt a változó költség kategóriát: ${category}?`)) return;
    setForm({ ...form, variableExpenseCategories: categories.filter(item => item !== category) });
  };

  const changePassword = async () => {
    setAuthMessage('');
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setAuthMessage(payload?.error || 'Nem sikerült jelszót módosítani.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setAuthMessage('Jelszó módosítva.');
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/dashboard';
  };

  return (
    <div className="stack">
      <section className="panel settingsPanel">
        <div className="panelHead">
          <h2>Beállítások</h2>
        </div>

        <div className="formGrid">
          <label>Stúdió neve<input value={form.studioName} onChange={e => setForm({...form, studioName:e.target.value})}/></label>
          <label>Normál oktatói óradíj<input type="number" value={form.trainerHourlyCost} onChange={e => setForm({...form, trainerHourlyCost:Number(e.target.value)})}/></label>
          <label>Teltházas oktatói óradíj<input type="number" value={form.fullHourTrainerCost || 10000} onChange={e => setForm({...form, fullHourTrainerCost:Number(e.target.value)})}/></label>
          <label>Max résztvevő / óra<input type="number" value={form.maxParticipantsPerClass} onChange={e => setForm({...form, maxParticipantsPerClass:Number(e.target.value)})}/></label>
          <label>Pénznem<input value={form.currency} onChange={e => setForm({...form, currency:e.target.value})}/></label>
        </div>
        <Button variant="primary" onClick={() => setSettings(form)}><Save size={16}/> Beállítások mentése</Button>
      </section>

      <section className="panel settingsPanel">
        <div className="panelHead">
          <div>
            <h2>Változó költség kategóriák</h2>
            <p className="panelSub">Ezek jelennek meg a Költségek oldalon a havi manuális költségek kategória listájában.</p>
          </div>
        </div>

        <div className="categoryManager">
          <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Új kategória neve" />
          <Button variant="primary" onClick={addCategory}><Plus size={16}/> Hozzáadás</Button>
        </div>

        <div className="categoryChips">
          {categories.map(category => (
            <div className="categoryChip" key={category}>
              <span>{category}</span>
              <button onClick={() => removeCategory(category)}><Trash2 size={14}/></button>
            </div>
          ))}
        </div>

        <Button variant="primary" onClick={() => setSettings(form)}><Save size={16}/> Kategóriák mentése</Button>
      </section>

      <section className="panel settingsPanel">
        <div className="panelHead">
          <div>
            <h2>Belépés és hozzáférés</h2>
            <p className="panelSub">Az admin felhasználó: <b>moonlab</b>. A jelszó itt módosítható.</p>
          </div>
        </div>

        <div className="formGrid">
          <label>Jelenlegi jelszó<input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
          <label>Új jelszó<input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
        </div>

        <div className="actions authActions">
          <Button variant="primary" onClick={changePassword}><Save size={16}/> Jelszó módosítása</Button>
          <Button onClick={() => { window.location.href = '/api/auth/google/start?action=bind'; }}><Mail size={16}/> Gmail hozzákötése</Button>
          <Button variant="danger" onClick={logout}><LogOut size={16}/> Kijelentkezés</Button>
        </div>

        {authMessage && <div className="infoBox authMessage">{authMessage}</div>}
      </section>
    </div>
  );
}
