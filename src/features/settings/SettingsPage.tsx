'use client';

import { DatabaseBackup, LogOut, Mail, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppData, Settings } from '../../types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';

type Props = {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  onDataRestored: (data: AppData) => void;
};

type BackupStatus = {
  exists: boolean;
  updatedAt: string | null;
};

export function SettingsPage({ settings, setSettings, onDataRestored }: Props) {
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
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({
    exists: false,
    updatedAt: null,
  });
  const [backupMessage, setBackupMessage] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [restorePin, setRestorePin] = useState('');
  const [showRestorePinModal, setShowRestorePinModal] = useState(false);

  const categories = form.variableExpenseCategories || [];

  useEffect(() => {
    fetch('/api/backup', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((status: BackupStatus | null) => {
        if (status) setBackupStatus(status);
      })
      .catch(() => undefined);
  }, []);

  const addCategory = () => {
    const value = newCategory.trim();
    if (!value || categories.includes(value)) return;
    setForm({ ...form, variableExpenseCategories: [...categories, value] });
    setNewCategory('');
  };

  const removeCategory = (category: string) => {
    if (!confirm(`Biztos törlöd ezt a változó költség kategóriát: ${category}?`)) return;
    setForm({ ...form, variableExpenseCategories: categories.filter((item) => item !== category) });
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

  const createBackup = async () => {
    if (!confirm('Biztos felülírod a jelenlegi biztonsági másolatot az aktuális adatokkal?'))
      return;

    setBackupBusy(true);
    setBackupMessage('');

    const res = await fetch('/api/backup', { method: 'POST' });
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      setBackupMessage(payload?.error || 'Nem sikerült létrehozni a biztonsági másolatot.');
      setBackupBusy(false);
      return;
    }

    setBackupStatus(payload);
    setBackupMessage('Biztonsági másolat elmentve.');
    setBackupBusy(false);
  };

  const openRestorePinModal = () => {
    if (!backupStatus.exists) return;
    setRestorePin('');
    setBackupMessage('');
    setShowRestorePinModal(true);
  };

  const restoreBackup = async () => {
    if (!/^\d{6}$/.test(restorePin)) {
      setBackupMessage('Adj meg egy 6 számjegyű PIN kódot.');
      return;
    }
    if (!backupStatus.exists) return;
    if (
      !confirm(
        'Biztos visszaállítod a legutóbbi biztonsági másolatot? A jelenlegi adatok felülíródnak.',
      )
    )
      return;

    setBackupBusy(true);
    setBackupMessage('');

    const res = await fetch('/api/backup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: restorePin }),
    });
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      setBackupMessage(payload?.error || 'Nem sikerült visszaállítani a biztonsági másolatot.');
      setBackupBusy(false);
      return;
    }

    onDataRestored(payload);
    setShowRestorePinModal(false);
    setRestorePin('');
    setForm({
      ...payload.settings,
      variableExpenseCategories: payload.settings.variableExpenseCategories?.length
        ? payload.settings.variableExpenseCategories
        : ['Számlázz.hu', 'Hirdetés', 'Rezsi'],
    });
    setBackupMessage('Biztonsági másolat visszaállítva.');
    setBackupBusy(false);
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
          <label>
            Stúdió neve
            <input
              value={form.studioName}
              onChange={(e) => setForm({ ...form, studioName: e.target.value })}
            />
          </label>
          <label>
            Normál oktatói óradíj
            <input
              type="number"
              value={form.trainerHourlyCost}
              onChange={(e) => setForm({ ...form, trainerHourlyCost: Number(e.target.value) })}
            />
          </label>
          <label>
            Teltházas oktatói óradíj
            <input
              type="number"
              value={form.fullHourTrainerCost || 10000}
              onChange={(e) => setForm({ ...form, fullHourTrainerCost: Number(e.target.value) })}
            />
          </label>
          <label>
            Max résztvevő / óra
            <input
              type="number"
              value={form.maxParticipantsPerClass}
              onChange={(e) =>
                setForm({ ...form, maxParticipantsPerClass: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Pénznem
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </label>
        </div>
        <Button variant="primary" onClick={() => setSettings(form)}>
          <Save size={16} /> Beállítások mentése
        </Button>
      </section>

      <section className="panel settingsPanel">
        <div className="panelHead">
          <div>
            <h2>Változó költség kategóriák</h2>
            <p className="panelSub">
              Ezek jelennek meg a Költségek oldalon a havi manuális költségek kategória listájában.
            </p>
          </div>
        </div>

        <div className="categoryManager">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Új kategória neve"
          />
          <Button variant="primary" onClick={addCategory}>
            <Plus size={16} /> Hozzáadás
          </Button>
        </div>

        <div className="categoryChips">
          {categories.map((category) => (
            <div className="categoryChip" key={category}>
              <span>{category}</span>
              <button onClick={() => removeCategory(category)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <Button variant="primary" onClick={() => setSettings(form)}>
          <Save size={16} /> Kategóriák mentése
        </Button>
      </section>

      {showRestorePinModal && (
        <Modal title="Visszaallitasi PIN" onClose={() => setShowRestorePinModal(false)}>
          <div className="formGrid">
            <label>
              6 számjegyű PIN
              <input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]*"
                type="password"
                value={restorePin}
                onChange={(e) => setRestorePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') restoreBackup();
                }}
              />
            </label>
          </div>

          <div className="modalActions">
            <Button onClick={() => setShowRestorePinModal(false)} disabled={backupBusy}>
              Mégse
            </Button>
            <Button
              variant="primary"
              onClick={restoreBackup}
              disabled={backupBusy || restorePin.length !== 6}
            >
              <RotateCcw size={16} /> Visszaállítás
            </Button>
          </div>
        </Modal>
      )}

      <section className="panel settingsPanel">
        <div className="panelHead">
          <div>
            <h2>Biztonsági másolat</h2>
            <p className="panelSub">
              Egy MongoDB snapshot készül az aktuális app adatokról. Új mentésnél a korábbi mentés
              felülíródik.
            </p>
          </div>
        </div>

        <div className="actions">
          <Button variant="primary" onClick={createBackup} disabled={backupBusy}>
            <DatabaseBackup size={16} /> Biztonsági másolat készítése
          </Button>
          <Button onClick={openRestorePinModal} disabled={backupBusy || !backupStatus.exists}>
            <RotateCcw size={16} /> Visszaállítás mentésből
          </Button>
        </div>

        <div className="infoBox">
          {backupStatus.exists && backupStatus.updatedAt
            ? `Legutóbbi mentés: ${new Date(backupStatus.updatedAt).toLocaleString('hu-HU')}`
            : 'Még nincs biztonsági másolat.'}
        </div>

        {backupMessage && <div className="infoBox authMessage">{backupMessage}</div>}
      </section>

      <section className="panel settingsPanel">
        <div className="panelHead">
          <div>
            <h2>Belépés és hozzáférés</h2>
            <p className="panelSub">
              Az admin felhasználó: <b>moonlab</b>. A jelszó itt módosítható.
            </p>
          </div>
        </div>

        <div className="formGrid">
          <label>
            Jelenlegi jelszó
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            Új jelszó
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
        </div>

        <div className="actions authActions">
          <Button variant="primary" onClick={changePassword}>
            <Save size={16} /> Jelszó módosítása
          </Button>
          <Button
            onClick={() => {
              window.location.href = '/api/auth/google/start?action=bind';
            }}
          >
            <Mail size={16} /> Gmail hozzákötése
          </Button>
          <Button variant="danger" onClick={logout}>
            <LogOut size={16} /> Kijelentkezés
          </Button>
        </div>

        {authMessage && <div className="infoBox authMessage">{authMessage}</div>}
      </section>
    </div>
  );
}
