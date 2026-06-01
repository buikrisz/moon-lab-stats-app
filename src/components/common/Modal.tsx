"use client";

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ title, onClose, children }: Props) {
  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="panelHead">
          <h2>{title}</h2>
          <Button variant="icon" onClick={onClose}><X size={18} /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}
