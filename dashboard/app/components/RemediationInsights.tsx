'use client';

import { useState } from 'react';
import { ShieldCheck, Settings, FileText, Cpu, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface Insight {
  id?: string;
  gap_id?: string;
  root_cause_type?: string;
  analysis?: string;
  proposed_remediation?: string;
}

interface RemediationInsightsProps {
  insights: Insight[];
}

const ROOT_CAUSE_COLORS: Record<string, string> = {
  prompt: 'text-purple-400 bg-purple-900/30',
  config: 'text-blue-400 bg-blue-900/30',
  setup: 'text-blue-400 bg-blue-900/30',
  model: 'text-emerald-400 bg-emerald-900/30',
  data: 'text-amber-400 bg-amber-900/30',
};

function getCauseStyle(type?: string) {
  const key = type?.toLowerCase() ?? '';
  for (const [k, v] of Object.entries(ROOT_CAUSE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return 'text-brand-400 bg-brand-900/30';
}

function getIcon(type?: string) {
  const t = type?.toLowerCase() ?? '';
  if (t.includes('prompt')) return <FileText className="w-4 h-4" />;
  if (t.includes('config') || t.includes('setup')) return <Settings className="w-4 h-4" />;
  if (t.includes('model')) return <Cpu className="w-4 h-4" />;
  return <ShieldCheck className="w-4 h-4" />;
}

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const causeStyle = getCauseStyle(insight.root_cause_type);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${causeStyle}`}>
            {getIcon(insight.root_cause_type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                #{index + 1}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${causeStyle}`}>
                {insight.root_cause_type?.replace(/_/g, ' ') ?? 'General'}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-300 leading-relaxed line-clamp-2">
              {insight.analysis}
            </p>
          </div>
        </div>
        <div className="ml-3 shrink-0 text-slate-500">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Root Cause Analysis</p>
            <p className="text-sm font-medium text-slate-200 leading-relaxed">{insight.analysis}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Proposed Remediation</p>
            <p className="text-sm font-bold text-white leading-relaxed bg-white/5 px-3 py-2 rounded-xl">
              {insight.proposed_remediation}
            </p>
          </div>
          {insight.gap_id && (
            <p className="text-[10px] text-slate-500 font-medium">
              Gap ref: <span className="font-mono text-slate-400">{insight.gap_id.slice(0, 8)}…</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function RemediationInsights({ insights }: RemediationInsightsProps) {
  const [showAll, setShowAll] = useState(false);
  const PAGE = 4;
  const displayed = showAll ? insights : insights.slice(0, PAGE);

  if (!insights || insights.length === 0) return null;

  return (
    <div className="stat-card bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="rounded-xl p-2 bg-brand-500/20 text-brand-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">
              Root Cause & Remediation
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">
              {insights.length} insight{insights.length !== 1 ? 's' : ''} · click to expand
            </p>
          </div>
        </div>
        {insights.length > PAGE && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1 text-xs font-bold text-brand-400 hover:text-brand-300"
          >
            <ExternalLink className="w-3 h-3" />
            {showAll ? 'Show less' : `View all ${insights.length}`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {displayed.map((insight, idx) => (
          <InsightCard key={insight.id ?? idx} insight={insight} index={idx} />
        ))}
      </div>

      {!showAll && insights.length > PAGE && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-white/20 text-xs font-bold text-slate-400 hover:border-brand-500 hover:text-brand-400 transition-colors"
        >
          + {insights.length - PAGE} more insights
        </button>
      )}
    </div>
  );
}
