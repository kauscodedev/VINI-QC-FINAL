'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Target, MessageSquare } from 'lucide-react';

interface TrackComparisonProps {
  recommendationMix: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
}

const COLORS = {
  PASS: '#10b981',
  PASS_WITH_ISSUES: '#8b5cf6',
  REVIEW: '#f59e0b',
  FAIL: '#ef4444',
  Unknown: '#94a3b8',
};

export function TrackComparison({ recommendationMix }: TrackComparisonProps) {
  const processData = (mix: Record<string, number>) =>
    Object.entries(mix).map(([name, value]) => ({ name, value }));

  const technicalData = processData(recommendationMix.technical);
  const behavioralData = processData(recommendationMix.behavioral);

  const renderSection = (title: string, data: any[], icon: any, color: string) => (
    <div className="stat-card">
      <div className="flex items-center gap-3 mb-6">
        <div className={`rounded-xl p-2 bg-${color}-50 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400`}>
          {icon}
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
          {title} Outcomes
        </h2>
      </div>
      
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry: any, index: number) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.Unknown} 
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {renderSection('Technical', technicalData, <Target className="w-5 h-5" />, 'brand')}
      {renderSection('Behavioral', behavioralData, <MessageSquare className="w-5 h-5" />, 'purple')}
    </div>
  );
}
