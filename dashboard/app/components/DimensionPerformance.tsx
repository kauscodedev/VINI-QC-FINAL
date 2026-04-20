'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Target, MessageSquare } from 'lucide-react';

interface DimensionPerformanceProps {
  dimensionAverages: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
}

function barFill(score: number) {
  if (score >= 2.5) return '#10b981';
  if (score >= 1.7) return '#f59e0b';
  return '#ef4444';
}

function cleanName(name: string) {
  return name.replace(/^behavior_/, '').replace(/_/g, ' ');
}

function TrackChart({
  title,
  data,
  Icon,
  accentClass,
}: {
  title: string;
  data: { name: string; score: number }[];
  Icon: React.ElementType;
  accentClass: string;
}) {
  const sorted = [...data].sort((a, b) => b.score - a.score);
  const height = Math.max(240, sorted.length * 44);

  return (
    <div className="stat-card flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className={`rounded-xl p-2 ${accentClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h2>
          <p className="text-[10px] text-slate-400 font-medium">Average score · Scale 1–3</p>
        </div>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.4} />
            <XAxis
              type="number"
              domain={[0, 3]}
              ticks={[0, 1, 1.7, 2.5, 3]}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickFormatter={cleanName}
              tickLine={false}
              axisLine={false}
              className="text-slate-600 dark:text-slate-400 capitalize"
            />
            <Tooltip
              cursor={{ fill: 'rgba(99,102,241,0.05)' }}
              content={({ active, payload }) => {
                if (active && payload?.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="glass-card px-3 py-2 rounded-xl shadow-xl text-sm">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">{cleanName(d.name)}</p>
                      <p className="text-xl font-black" style={{ color: barFill(d.score) }}>{d.score}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={22} label={{ position: 'right', fontSize: 11, fontWeight: 700, fill: '#64748b', formatter: (v: number) => v.toFixed(2) }}>
              {sorted.map((entry, i) => (
                <Cell key={i} fill={barFill(entry.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 pt-1">
        {[{ label: '≥ 2.5 Pass', color: '#10b981' }, { label: '1.7–2.5 Review', color: '#f59e0b' }, { label: '< 1.7 Fail', color: '#ef4444' }].map((t) => (
          <div key={t.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DimensionPerformance({ dimensionAverages }: DimensionPerformanceProps) {
  const toChartData = (map: Record<string, number>) =>
    Object.entries(map).map(([name, score]) => ({ name, score: Number(score.toFixed(2)) }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <TrackChart
        title="Technical Performance"
        data={toChartData(dimensionAverages.technical)}
        Icon={Target}
        accentClass="bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
      />
      <TrackChart
        title="Behavioral Performance"
        data={toChartData(dimensionAverages.behavioral)}
        Icon={MessageSquare}
        accentClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
      />
    </div>
  );
}
