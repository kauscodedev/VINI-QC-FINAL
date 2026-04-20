'use client';

import { useState, useMemo } from 'react';
import { AlertCircle, AlertTriangle, BarChart2 } from 'lucide-react';

interface IssueData {
  call_id: string;
  dimension: string;
  issue_type: string;
  severity: string;
  bucket: string;
}

interface IssueHeatmapProps {
  issues: IssueData[];
  issueSummary?: {
    severity_counts: Record<string, number>;
    top_issue_types: Array<{ issue_type: string; count: number }>;
  };
}

function cleanDim(name: string) {
  return name.replace(/^behavior_/, '').replace(/_/g, ' ');
}

function heatColor(count: number, max: number): string {
  if (count === 0) return '';
  const intensity = max > 0 ? count / max : 0;
  if (intensity >= 0.75) return 'bg-red-500 text-white';
  if (intensity >= 0.5) return 'bg-red-300 text-red-900';
  if (intensity >= 0.25) return 'bg-amber-200 text-amber-900';
  return 'bg-amber-100 text-amber-800';
}

const BUCKET_OPTIONS = ['all', 'technical', 'behavioral'] as const;
type BucketOption = typeof BUCKET_OPTIONS[number];

export function IssueHeatmap({ issues }: IssueHeatmapProps) {
  const [bucketFilter, setBucketFilter] = useState<BucketOption>('all');
  const [showAllTypes, setShowAllTypes] = useState(false);

  const filteredIssues = useMemo(
    () => (bucketFilter === 'all' ? issues : issues.filter((i) => i.bucket === bucketFilter)),
    [issues, bucketFilter]
  );

  // Build heatmap: unique dimensions × severities
  const dimensions = useMemo(
    () => [...new Set(filteredIssues.map((i) => i.dimension))].sort(),
    [filteredIssues]
  );

  const heatmap = useMemo(() => {
    const map: Record<string, { critical: number; warning: number }> = {};
    for (const dim of dimensions) map[dim] = { critical: 0, warning: 0 };
    for (const issue of filteredIssues) {
      if (!map[issue.dimension]) map[issue.dimension] = { critical: 0, warning: 0 };
      if (issue.severity === 'critical') map[issue.dimension].critical++;
      else if (issue.severity === 'warning') map[issue.dimension].warning++;
    }
    return map;
  }, [filteredIssues, dimensions]);

  const maxCritical = Math.max(...dimensions.map((d) => heatmap[d]?.critical ?? 0), 1);
  const maxWarning = Math.max(...dimensions.map((d) => heatmap[d]?.warning ?? 0), 1);

  // Top issue types from filtered
  const issueTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of filteredIssues) {
      counts[i.issue_type] = (counts[i.issue_type] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([issue_type, count]) => ({ issue_type, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredIssues]);

  const displayedTypes = showAllTypes ? issueTypeCounts : issueTypeCounts.slice(0, 8);
  const totalIssues = filteredIssues.length;
  const criticalTotal = filteredIssues.filter((i) => i.severity === 'critical').length;
  const warningTotal = filteredIssues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="stat-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="rounded-xl p-2 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Issue Heatmap
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                {totalIssues} issues · {criticalTotal} critical · {warningTotal} warning
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {BUCKET_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => setBucketFilter(b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  bucketFilter === b
                    ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Severity summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">Critical</span>
            </div>
            <span className="text-2xl font-black text-red-600 dark:text-red-400">{criticalTotal}</span>
          </div>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Warning</span>
            </div>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{warningTotal}</span>
          </div>
        </div>

        {/* Heatmap grid */}
        {dimensions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">
                    Dimension
                  </th>
                  <th className="text-center py-2 px-3 text-[10px] font-black text-red-500 uppercase tracking-widest">
                    Critical
                  </th>
                  <th className="text-center py-2 px-3 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                    Warning
                  </th>
                  <th className="text-center py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dimensions
                  .map((dim) => ({
                    dim,
                    critical: heatmap[dim]?.critical ?? 0,
                    warning: heatmap[dim]?.warning ?? 0,
                  }))
                  .sort((a, b) => b.critical * 2 + b.warning - (a.critical * 2 + a.warning))
                  .map(({ dim, critical, warning }) => (
                    <tr key={dim} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 pr-4 font-semibold text-slate-700 dark:text-slate-300 capitalize text-xs">
                        {cleanDim(dim)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {critical > 0 ? (
                          <span className={`inline-flex items-center justify-center w-9 h-7 rounded-lg text-xs font-black ${heatColor(critical, maxCritical)}`}>
                            {critical}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-9 h-7 text-slate-200 dark:text-slate-700 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {warning > 0 ? (
                          <span className={`inline-flex items-center justify-center w-9 h-7 rounded-lg text-xs font-black ${heatColor(warning, maxWarning)}`}>
                            {warning}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-9 h-7 text-slate-200 dark:text-slate-700 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-xs font-bold text-slate-500">{critical + warning}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-8 text-slate-400 italic text-sm">No issues found for selected filters.</p>
        )}
      </div>

      {/* Top Issue Types */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="rounded-xl p-2 bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Issue Type Breakdown
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">{issueTypeCounts.length} distinct types</p>
            </div>
          </div>
          {issueTypeCounts.length > 8 && (
            <button
              onClick={() => setShowAllTypes((v) => !v)}
              className="text-xs font-bold text-brand-600 hover:text-brand-700"
            >
              {showAllTypes ? 'Show less' : `View all ${issueTypeCounts.length}`}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {displayedTypes.map(({ issue_type, count }, idx) => {
            const pct = totalIssues > 0 ? (count / totalIssues) * 100 : 0;
            return (
              <div key={issue_type} className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-400 w-4 text-right">{idx + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">
                      {issue_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300">{count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
