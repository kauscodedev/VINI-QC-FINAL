'use client';

import { Lightbulb, Users, Target, Zap } from 'lucide-react';

interface Gap {
  gap_type?: string;
  pattern?: string;
  affected_calls?: number;
  recommendation?: string;
  surfaced_at?: string;
}

interface CapabilityGapsProps {
  gaps: Gap[];
}

export function CapabilityGaps({ gaps }: CapabilityGapsProps) {
  if (!gaps || gaps.length === 0) {
    return (
      <div className="mt-8 stat-card">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
          Capability Gaps
        </h2>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 italic">
          No aggregate capability gaps detected in recent batches.
        </p>
      </div>
    );
  }

  const getIcon = (type?: string) => {
    switch (type) {
      case 'agent_behavior': return <Users className="w-5 h-5 text-blue-500" />;
      case 'tool_failure_handling': return <Zap className="w-5 h-5 text-amber-500" />;
      case 'knowledge_gap': return <Lightbulb className="w-5 h-5 text-emerald-500" />;
      case 'system_latency': return <Target className="w-5 h-5 text-red-500" />;
      default: return <Lightbulb className="w-5 h-5 text-brand-500" />;
    }
  };

  return (
    <div className="mt-8 stat-card">
      <div className="flex items-center gap-3 mb-8">
        <div className="rounded-xl p-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
            Top Capability Gaps
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            LLM-identified recurring patterns across batches
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gaps.map((gap, idx) => (
          <div
            key={idx}
            className="group relative flex flex-col p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-all hover:shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                  {getIcon(gap.gap_type)}
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white capitalize">
                  {(gap.gap_type || 'Unknown').replace(/_/g, ' ')}
                </h3>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-700 px-3 py-1 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">
                {gap.affected_calls} instances
              </span>
            </div>
            
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              {gap.pattern}
            </p>

            {gap.recommendation && (
              <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                  Actionable Step
                </p>
                <p className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-3 py-2 rounded-lg">
                  {gap.recommendation}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
