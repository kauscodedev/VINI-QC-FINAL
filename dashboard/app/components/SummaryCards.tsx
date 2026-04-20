'use client';

import { PhoneCall, TrendingUp, BarChart3, AlertCircle, Building2 } from 'lucide-react';
import type { TabId, FilterState } from '../dashboard';

export interface SummaryCardsProps {
  totalCalls: number;
  passRate: number;
  averageTechnicalScore: number;
  averageBehavioralScore: number;
  avgQualityScore: number;
  criticalIssueCount: number;
  uniqueDealerships: number;
  onNavigate: (tab: TabId, filters?: Partial<FilterState>) => void;
}

function scoreColor(score: number) {
  if (score >= 2.5) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 1.7) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function passRateColor(rate: number) {
  if (rate >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

interface CardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueClass?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
}

function StatCard({ label, value, subtitle, icon, iconBg, valueClass, onClick, badge }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`stat-card ${onClick ? 'cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 active:scale-[0.98]' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            {badge}
          </div>
          <h3 className={`mt-2 text-3xl font-black tracking-tight ${valueClass ?? 'text-slate-900 dark:text-white'}`}>
            {value}
          </h3>
          {subtitle && (
            <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-2xl p-3 shrink-0 ${iconBg}`}>{icon}</div>
      </div>
      {onClick && (
        <div className="mt-3 text-[10px] font-bold text-brand-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
          Click to drill down →
        </div>
      )}
      <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-slate-50 opacity-10 transition-transform duration-500 group-hover:scale-150 dark:bg-slate-800" />
    </div>
  );
}

export function SummaryCards({
  totalCalls,
  passRate,
  avgQualityScore,
  criticalIssueCount,
  uniqueDealerships,
  onNavigate,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard
        label="Total Calls"
        value={totalCalls.toLocaleString()}
        subtitle="Analyzed calls"
        icon={<PhoneCall className="h-5 w-5" />}
        iconBg="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
        onClick={() => onNavigate('calllog')}
      />

      <StatCard
        label="Pass Rate"
        value={`${passRate.toFixed(1)}%`}
        subtitle="Both tracks passing"
        icon={<TrendingUp className="h-5 w-5" />}
        iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        valueClass={passRateColor(passRate)}
        onClick={() => onNavigate('calllog', { tech_outcome: 'PASS' })}
      />

      <StatCard
        label="Avg Quality"
        value={`${avgQualityScore.toFixed(2)} / 3`}
        subtitle="Tech + behavioral combined"
        icon={<BarChart3 className="h-5 w-5" />}
        iconBg="bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
        valueClass={scoreColor(avgQualityScore)}
      />

      <StatCard
        label="Critical Issues"
        value={criticalIssueCount.toLocaleString()}
        subtitle="Across filtered calls"
        icon={<AlertCircle className="h-5 w-5" />}
        iconBg="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        valueClass={criticalIssueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}
        onClick={() => onNavigate('issues')}
      />

      <StatCard
        label="Dealerships"
        value={uniqueDealerships}
        subtitle="Unique locations"
        icon={<Building2 className="h-5 w-5" />}
        iconBg="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        valueClass="text-purple-600 dark:text-purple-400"
      />
    </div>
  );
}
