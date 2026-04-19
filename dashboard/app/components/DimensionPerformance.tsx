'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity } from 'lucide-react';

interface DimensionPerformanceProps {
  dimensionAverages: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
}

export function DimensionPerformance({ dimensionAverages }: DimensionPerformanceProps) {
  const formatData = (data: Record<string, number>, bucket: string) =>
    Object.entries(data).map(([name, score]) => ({
      name: name.replace('behavior_', '').replace(/_/g, ' '),
      score: Number(score.toFixed(2)),
      bucket,
    }));

  const technicalData = formatData(dimensionAverages.technical, 'technical');
  const behavioralData = formatData(dimensionAverages.behavioral, 'behavioral');
  const allData = [...technicalData, ...behavioralData].sort((a, b) => b.score - a.score);

  return (
    <div className="mt-8 stat-card">
      <div className="flex items-center gap-3 mb-8">
        <div className="rounded-xl p-2 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
            Dimension Performance
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Average scores across all evaluation categories (Scale 1-3)
          </p>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={allData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 3]} ticks={[0, 1, 2, 3]} />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={150} 
              tick={{ fontSize: 12, fill: 'currentColor' }}
              className="text-slate-600 dark:text-slate-400 font-medium"
            />
            <Tooltip
              cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="glass-card p-3 rounded-xl shadow-xl border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-bold uppercase text-slate-400 mb-1">{data.bucket}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mb-1 uppercase">{data.name}</p>
                      <p className="text-xl font-black text-brand-600 dark:text-brand-400">{data.score}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="score" radius={[0, 10, 10, 0]} barSize={24}>
              {allData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.bucket === 'technical' ? '#6366f1' : '#a855f7'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-500" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Technical Track</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Behavioral Track</span>
        </div>
      </div>
    </div>
  );
}
