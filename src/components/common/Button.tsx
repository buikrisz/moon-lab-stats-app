"use client";

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger' | 'icon';
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
};

export function Button({ children, variant = 'ghost', onClick, type = 'button', className = '', disabled = false }: Props) {
  return <button disabled={disabled} type={type} onClick={onClick} className={`btn ${variant} ${className}`}>{children}</button>;
}
