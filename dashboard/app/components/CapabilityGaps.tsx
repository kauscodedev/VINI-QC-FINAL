'use client';

import { useState } from 'react';
import { Lightbulb, Users, Target, Zap, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface Gap {
  id?: string;
  gap_type?: string;
  pattern?: string;
  affected_calls?: number;
  affected_call_ids?: string[];
  recommendation?: string;
  surfaced_at?: string;
}

interface Insight {
  id?: string;
  gap_id?: string;
  root_cause_type?: string;
  analysis?: string;
  proposed_remediation?: string;
}

interface CapabilityGapsProps {
  gaps: Gap[];
  remediationInsights: Insight[];
}

function getIcon(type?: string) {
  switch (type) {
    case 'agent_behavior': return <Users className="w-4 h-4 text-blue-500" />;
    case 'tool_failure_handling': return <Zap className="w-4 h-4 text-amber-500" />;
    case 'knowledge_gap': return <Lightbulb className="w-4 h-4 text-emerald-500" />;
    case 'system_latency': return <Target className="w-4 h-4 text-red-500" />;
    default: return <Lightbulb className="w-4 h-4 text-brand-500" />;
  }
}

function GapCard({ gap, linkedInsights }: { gap: Gap; linkedInsights: Insight[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 overflow-hidden transition-all">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm shrink-0 mt-0.5">
            {getIcon(gap.gap_type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                {(gap.gap_type ?? 'unknown').replace(/_/g, ' ')}
              </span>
              {gap.affected_calls != null && (
                <span className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter">
                  {gap.affected_calls} calls
                </span>
              )}
              {linkedInsights.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-tighter">
                  {linkedInsights.length} insight{linkedInsights.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
              {gap.pattern}
            </p>
          </div>
        </div>
        <div className="ml-3 shrink-0 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
          {/* Full pattern */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Full Pattern</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{gap.pattern}</p>
          </div>

          {/* Recommendation */}
          {gap.recommendation && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-500 mb-1">Actionable Step</p>
              <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 px-3 py-2 rounded-xl">
                {gap.recommendation}
              </p>
            </div>
          )}

          {/* Linked remediation insights */}
          {linkedInsights.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Remediation</p>
              <div className="space-y-2">
                {linkedInsights.map((insight, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-900 dark:bg-black text-white">
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-1">
                      {insight.root_cause_type?.replace(/_/g, ' ') ?? 'General'}
                    </p>
                    <p className="text-xs text-slate-300 mb-2 leading-relaxed">{insight.analysis}</p>
                    <p className="text-xs font-bold text-emerald-400 leading-relaxed">{insight.proposed_remediation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected call IDs */}
          {gap.affected_call_ids && gap.affected_call_ids.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Affected Calls ({gap.affected_call_ids.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {gap.affected_call_ids.slice(0, 12).map((id) => (
                  <span
                    key={id}
                    className="text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md"
                  >
                    {id.slice(0, 8)}…
                  </span>
                ))}
                {gap.affected_call_ids.length > 12 && (
                  <span className="text-[10px] text-slate-400 px-2 py-0.5">+{gap.affected_call_ids.length - 12} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CapabilityGaps({ gaps, remediationInsights }: CapabilityGapsProps) {
  const [showAll, setShowAll] = useState(false);
  const PAGE = 6;
  const displayed = showAll ? gaps : gaps.slice(0, PAGE);

  if (!gaps || gaps.length === 0) {
    return (
      <div className="stat-card">
        <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Capability Gaps</h2>
        <p className="mt-3 text-sm text-slate-400 italic">No capability gaps detected in recent batches.</p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="rounded-xl p-2 bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Capability Gaps
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">
              {gaps.length} pattern{gaps.length !== 1 ? 's' : ''} identified · click to expand
            </p>
          </div>
        </div>
        {gaps.length > PAGE && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
          >
            <ExternalLink className="w-3 h-3" />
            {showAll ? 'Show less' : `View all ${gaps.length}`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {displayed.map((gap, idx) => {
          const linked = remediationInsights.filter((r) => r.gap_id === gap.id);
          return <GapCard key={gap.id ?? idx} gap={gap} linkedInsights={linked} />;
        })}
      </div>

      {!showAll && gaps.length > PAGE && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          + {gaps.length - PAGE} more gaps
        </button>
      )}
    </div>
  );
}
