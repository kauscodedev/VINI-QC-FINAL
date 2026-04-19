'use client';

import { ShieldCheck, Settings, FileText, Cpu } from 'lucide-react';

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

export function RemediationInsights({ insights }: RemediationInsightsProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  const getIcon = (type?: string) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('prompt')) return <FileText className="w-5 h-5 text-purple-500" />;
    if (t.includes('config') || t.includes('setup')) return <Settings className="w-5 h-5 text-blue-500" />;
    if (t.includes('model')) return <Cpu className="w-5 h-5 text-emerald-500" />;
    return <ShieldCheck className="w-5 h-5 text-brand-500" />;
  };

  return (
    <div className="mt-8 stat-card bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="flex items-center gap-3 mb-8">
        <div className="rounded-xl p-2 bg-brand-500/20 text-brand-400">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">
            Root Cause & Remediation
          </h2>
          <p className="text-sm text-slate-400">
            Deep-dive architect insights from the latest batch
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="flex flex-col p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-800 rounded-xl">
                {getIcon(insight.root_cause_type)}
              </div>
              <h3 className="font-bold text-white uppercase text-xs tracking-widest text-slate-400">
                Strategic Insight #{idx + 1}
              </h3>
            </div>

            <div className="mb-4">
              <span className="text-[10px] font-black uppercase text-brand-400 tracking-widest block mb-1">
                Root Cause: {insight.root_cause_type?.replace(/_/g, ' ') || 'General'}
              </span>
              <p className="text-sm font-medium text-slate-200">
                {insight.analysis}
              </p>
            </div>

            <div className="mt-auto pt-4 border-t border-white/5">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest block mb-1">
                Proposed Remediation
              </span>
              <p className="text-sm font-bold text-white leading-relaxed">
                {insight.proposed_remediation}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
