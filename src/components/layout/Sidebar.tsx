"use client";

import { BarChart3, Calendar, CreditCard, Home, LineChart, Menu, Settings, WalletCards, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Page, WeekRow } from '../../types';

const navItems = [
  { page: 'dashboard', label: 'Dashboard', icon: Home },
  { page: 'weekly-entry', label: 'Heti rögzítés', icon: Calendar },
  { page: 'weekly-summary', label: 'Heti lebontás', icon: BarChart3 },
  { page: 'monthly-summary', label: 'Éves kimutatások', icon: LineChart },
  { page: 'passes', label: 'Bérletek / árak', icon: WalletCards },
  { page: 'expenses', label: 'Költségek', icon: CreditCard },
  { page: 'settings', label: 'Beállítások', icon: Settings },
] as const;

type Props = {
  page: Page;
  setPage: (page: Page) => void;
  currentWeek?: WeekRow;
  onCurrentWeekClick?: () => void;
};

function SidebarContent({ page, setPage, currentWeek, onCurrentWeekClick, closeMobile }: Props & { closeMobile?: () => void }) {
  const [loggedInUsername, setLoggedInUsername] = useState('moonlab');

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.username) setLoggedInUsername(data.username);
      })
      .catch(() => setLoggedInUsername('moonlab'));
  }, []);

  const goToPage = (nextPage: Page) => {
    setPage(nextPage);
    closeMobile?.();
  };

  return (
    <>
      <div className="brand">
        <img className="brandLogo" src="/moonlab-logo.png" alt="Moon Lab Pilates logo" />
        <div><strong>MOON LAB</strong><span>PILATES</span></div>
      </div>

      <nav>
        {navItems.map(({ page: p, label, icon: Icon }) => (
          <button className={`navItem ${p === page ? 'active' : ''}`} key={p} onClick={() => goToPage(p)}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>

      <button className="currentWeek clickableCurrentWeek" onClick={() => { onCurrentWeekClick?.(); closeMobile?.(); }}>
        <div className="muted">Aktuális hét <Calendar size={15} /></div>
        <strong>{currentWeek?.week || 'Nincs nyitott hét'}</strong>
        <span className={`pill ${currentWeek ? 'success' : ''}`}>{currentWeek ? 'Nyitva' : 'Lezárva'}</span>
      </button>

      <div className="profile">
        <img className="avatarLogo" src="/moonlab-logo.png" alt="Moon Lab Pilates logo" />
        <strong>{loggedInUsername}</strong>
      </div>
    </>
  );
}

export function Sidebar(props: Props) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      <button className="mobileMenuButton" onClick={() => setIsMobileOpen(true)}><Menu size={20}/> Menü</button>

      <aside className="sidebar desktopSidebar">
        <SidebarContent {...props} />
      </aside>

      {isMobileOpen && (
        <div className="mobileSidebarBackdrop" onClick={() => setIsMobileOpen(false)}>
          <aside className="sidebar mobileSidebar" onClick={e => e.stopPropagation()}>
            <button className="mobileCloseButton" onClick={() => setIsMobileOpen(false)}><X size={18}/> Bezárás</button>
            <SidebarContent {...props} closeMobile={() => setIsMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
