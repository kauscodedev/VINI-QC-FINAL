'use client';

import { LucideIcon, PhoneCall, BarChart3, TrendingUp, Building2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SummaryCardsProps {
  totalCalls: number;
  averageTechnicalScore: number;
  averageBehavioralScore: number;
  uniqueDealerships: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  colorClass: string;
  iconColorClass: string;
}

function StatCard({ label, value, subtitle, icon: Icon, trend, colorClass, iconColorClass }: StatCardProps) {
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <h3 className={cn("mt-2 text-3xl font-bold tracking-tight", colorClass)}>
            {value}
          </h3>
          {subtitle && (
            <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        <div className={cn("rounded-2xl p-3 transition-colors duration-300", iconColorClass)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      
      {/* Subtle decorative background element */}
      <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-slate-50 opacity-10 transition-transform duration-500 group-hover:scale-150 dark:bg-slate-800" />
    </div>
  );
}

export function SummaryCards({
  totalCalls,
  averageTechnicalScore,
  averageBehavioralScore,
  uniqueDealerships,
}: SummaryCardsProps) {
  const formatScore = (score: number) => score.toFixed(2);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Calls"
        value={totalCalls}
        icon={PhoneCall}
        colorClass="text-slate-900 dark:text-white"
        iconColorClass="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      />

      <StatCard
        label="Avg Technical Score"
        value={formatScore(averageTechnicalScore)}
        subtitle="SDR Technical Execution"
        icon={BarChart3}
        colorClass="text-brand-600 dark:text-brand-400"
        iconColorClass="bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
      />

      <StatCard
        label="Avg Behavioral Score"
        value={formatScore(averageBehavioralScore)}
        subtitle="SDR Behavioral Soft Skills"
        icon={TrendingUp}
        colorClass="text-purple-600 dark:text-purple-400"
        iconColorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
      />

      <StatCard
        label="Unique Dealerships"
        value={uniqueDealerships}
        icon={Building2}
        colorClass="text-emerald-600 dark:text-emerald-400"
        iconColorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
      />
    </div>
  );
}
