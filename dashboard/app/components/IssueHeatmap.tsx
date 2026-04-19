'use client';

import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface IssueHeatmapProps {
  issueSummary: {
    severity_counts: Record<string, number>;
    top_issue_types: Array<{ issue_type: string; count: number }>;
  };
}

export function IssueHeatmap({ issueSummary }: IssueHeatmapProps) {
  const { severity_counts, top_issue_types } = issueSummary;

  const severityConfigs = {
    critical: {
      label: 'Critical',
      icon: <AlertCircle className="w-5 h-5" />,
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-100 dark:border-red-900/30',
    },
    warning: {
      label: 'Warning',
      icon: <AlertTriangle className="w-5 h-5" />,
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-100 dark:border-amber-900/30',
    },
    info: {
      label: 'Info',
      icon: <Info className="w-5 h-5" />,
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-100 dark:border-blue-900/30',
    },
  };

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Severity Breakdown */}
      <div className="stat-card lg:col-span-1">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-6">
          Severity Breakdown
        </h2>
        <div className="space-y-4">
          {(['critical', 'warning'] as const).map((severity) => {
            const config = severityConfigs[severity];
            const count = severity_counts[severity] || 0;
            return (
              <div
                key={severity}
                className={`flex items-center justify-between p-4 rounded-2xl border ${config.bg} ${config.border}`}
              >
                <div className="flex items-center gap-3">
                  <div className={config.text}>{config.icon}</div>
                  <span className={`font-bold uppercase tracking-wide text-sm ${config.text}`}>
                    {config.label}
                  </span>
                </div>
                <span className={`text-2xl font-black ${config.text}`}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Issue Types */}
      <div className="stat-card lg:col-span-2">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-6">
          Recurring Issue Patterns
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {top_issue_types.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Issue Type
                </span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">
                  {item.issue_type.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Count
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {item.count}
                </span>
              </div>
            </div>
          ))}
          {top_issue_types.length === 0 && (
            <p className="col-span-2 text-center py-8 text-slate-500 dark:text-slate-400 italic">
              No specific issue patterns identified yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
