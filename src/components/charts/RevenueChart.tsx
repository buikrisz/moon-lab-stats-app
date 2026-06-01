"use client";

import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { huf } from '../../utils/format';
import { moneyTicks } from '../../utils/chartTicks';

type Metric = 'Bevétel' | 'Kiadás' | 'Profit';
type Props = { data: { month: string; Bevétel: number; Kiadás: number; Profit: number }[] };

const metricColors: Record<Metric, string> = {
  Bevétel: '#2f7d5c',
  Kiadás: '#c58b37',
  Profit: '#5b6fd8',
};

export function RevenueChart({ data }: Props) {
  const [metric, setMetric] = useState<Metric>('Profit');
  const ticks = useMemo(() => moneyTicks(data.map(item => Math.abs(item[metric]))), [data, metric]);

  return (
    <div>
      <div className="chartToggle">
        {(['Bevétel', 'Kiadás', 'Profit'] as Metric[]).map(item => (
          <button key={item} className={metric === item ? 'active' : ''} onClick={() => setMetric(item)}>
            {item}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" />
          <YAxis ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tickFormatter={(v) => `${Number(v) / 1000}k`} />
          <Tooltip formatter={(value) => huf(Number(value ?? 0))} />
          <Legend />
          <Line type="monotone" dataKey={metric} stroke={metricColors[metric]} strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
