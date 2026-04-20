'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Target, MessageSquare } from 'lucide-react';
import type { TabId, FilterState } from '../dashboard';

export interface TrackComparisonProps {
  recommendationMix: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
  averageTechnicalScore: number;
  averageBehavioralScore: number;
  onNavigate: (tab: TabId, filters?: Partial<FilterState>) => void;
}

const OUTCOME_COLORS: Record<string, string> = {
  PASS: '#10b981',
  PASS_WITH_ISSUES: '#8b5cf6',
  REVIEW: '#f59e0b',
  FAIL: '#ef4444',
  Unknown: '#94a3b8',
};

const OUTCOME_ORDER = ['PASS', 'PASS_WITH_ISSUES', 'REVIEW', 'FAIL', 'Unknown'];

function scoreColor(score: number) {
  if (score >= 2.5) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 1.7) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function MiniOutcomeBar({ mix, total }: { mix: Record<string, number>; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden gap-px mt-2">
      {OUTCOME_ORDER.map((key) => {
        const count = mix[key] ?? 0;
        if (!count) return null;
        const pct = (count / total) * 100;
        return (
          <div
            key={key}
            style={{ width: `${pct}%`, backgroundColor: OUTCOME_COLORS[key] }}
            title={`${key}: ${count}`}
            className="transition-all"
          />
        );
      })}
    </div>
  );
}

function OutcomeLegend({ mix, total, onNavigate, filterKey }: {
  mix: Record<string, number>;
  total: number;
  onNavigate: (tab: TabId, filters?: Partial<FilterState>) => void;
  filterKey: 'tech_outcome' | 'behav_outcome';
}) {
  return (
    <div className="mt-3 space-y-1.5">
      {OUTCOME_ORDER.filter((k) => (mix[k] ?? 0) > 0).map((key) => {
        const count = mix[key] ?? 0;
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
        return (
          <button
            key={key}
            onClick={() => onNavigate('calllog', { [filterKey]: key })}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: OUTCOME_COLORS[key] }}
              />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {key.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{pct}%</span>
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 w-8 text-right">{count}</span>
              <span className="text-[9px] text-brand-500 opacity-0 group-hover:opacity-100 font-bold">→</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DonutPanel({
  title,
  data,
  score,
  Icon,
  accentClass,
  filterKey,
  onNavigate,
}: {
  title: string;
  data: { name: string; value: number }[];
  score: number;
  Icon: React.ElementType;
  accentClass: string;
  filterKey: 'tech_outcome' | 'behav_outcome';
  onNavigate: (tab: TabId, filters?: Partial<FilterState>) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const mix = Object.fromEntries(data.map((d) => [d.name, d.value]));

  return (
    <div className="stat-card flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-xl p-2 ${accentClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {title}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Score</p>
          <p className={`text-xl font-black ${scoreColor(score)}`}>{score.toFixed(2)}<span className="text-xs font-medium text-slate-400"> /3</span></p>
        </div>
      </div>

      {/* Mini bar */}
      <MiniOutcomeBar mix={mix} total={total} />

      {/* Donut */}
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={68}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={OUTCOME_COLORS[entry.name] ?? OUTCOME_COLORS.Unknown}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.length) {
                  const d = payload[0].payload;
                  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
                  return (
                    <div className="glass-card px-3 py-2 rounded-xl shadow-xl text-sm">
                      <p className="font-bold text-slate-800 dark:text-white">{d.name.replace(/_/g, ' ')}</p>
                      <p className="text-slate-500">{d.value} calls ({pct}%)</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Outcome list — each row is clickable */}
      <OutcomeLegend mix={mix} total={total} onNavigate={onNavigate} filterKey={filterKey} />
    </div>
  );
}

export function TrackComparison({ recommendationMix, averageTechnicalScore, averageBehavioralScore, onNavigate }: TrackComparisonProps) {
  const sortByOrder = (mix: Record<string, number>) =>
    OUTCOME_ORDER.filter((k) => k in mix).map((name) => ({ name, value: mix[name] }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <DonutPanel
        title="Technical Outcomes"
        data={sortByOrder(recommendationMix.technical)}
        score={averageTechnicalScore}
        Icon={Target}
        accentClass="bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
        filterKey="tech_outcome"
        onNavigate={onNavigate}
      />
      <DonutPanel
        title="Behavioral Outcomes"
        data={sortByOrder(recommendationMix.behavioral)}
        score={averageBehavioralScore}
        Icon={MessageSquare}
        accentClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        filterKey="behav_outcome"
        onNavigate={onNavigate}
      />
    </div>
  );
}
