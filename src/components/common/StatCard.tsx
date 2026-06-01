"use client";

import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  hint: string;
};

export function StatCard({ title, value, icon: Icon, hint }: Props) {
  return (
    <div className="statCard">
      <div className="iconBubble"><Icon size={19} /></div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}
