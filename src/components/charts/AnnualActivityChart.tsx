"use client";

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { integerTicks } from '../../utils/chartTicks';

type Metric = 'Órák és résztvevők' | 'Átlag résztvevő / óra';

type Props = {
  data: { month: string; Órák: number; Résztvevők: number; Átlag: number }[];
};

export function AnnualActivityChart({ data }: Props) {
  const [metric, setMetric] = useState<Metric>('Órák és résztvevők');
  const activityTicks = useMemo(() => integerTicks(data.flatMap(item => [item.Órák, item.Résztvevők]), 25), [data]);
  const avgTicks = useMemo(() => integerTicks(data.map(item => item.Átlag), 1), [data]);

  return (
    <div>
      <div className="chartToggle">
        {(['Órák és résztvevők', 'Átlag résztvevő / óra'] as Metric[]).map(item => (
          <button key={item} className={metric === item ? 'active' : ''} onClick={() => setMetric(item)}>
            {item}
          </button>
        ))}
      </div>

      {metric === 'Órák és résztvevők' ? (
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" />
            <YAxis ticks={activityTicks} domain={[0, activityTicks[activityTicks.length - 1]]} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Órák" fill="#9fbf9f" radius={[8, 8, 0, 0]} />
            <Bar dataKey="Résztvevők" fill="#315c49" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" />
            <YAxis ticks={avgTicks} domain={[0, avgTicks[avgTicks.length - 1]]} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Átlag" stroke="#315c49" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
