"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { huf } from '../../utils/format';

type Props = { data: { name: string; value: number }[] };

const colors = ['#315c49', '#c58b37', '#8d80b8', '#d66d50', '#77a6b6', '#9fbf9f', '#d9a441', '#7f8c8d'];

export function ExpensePieChart({ data }: Props) {
  return (
    <div className="pieWrap">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie data={data} dataKey="value" innerRadius="42%" outerRadius="82%" paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => huf(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="legendList">
        {data.map((e, i) => (
          <div key={e.name}>
            <span className="dot" style={{ background: colors[i % colors.length] }} />
            <span>{e.name}</span>
            <b className="legendValue">{huf(e.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
