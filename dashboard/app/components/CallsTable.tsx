'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Clock, ExternalLink } from 'lucide-react';
import { CallDetailDrawer } from './CallDetailDrawer';

interface Call {
  call_id: string;
  call_start_time?: string | null;
  agent_name?: string | null;
  agent_type?: string | null;
  duration_ms?: number | null;
  dealership_name?: string | null;
  call_type?: string | null;
  primary_intent?: string | null;
  technical_overall_score?: number | null;
  behavioral_overall_score?: number | null;
  technical_recommendation?: string | null;
  behavioral_recommendation?: string | null;
}

type SortField = 'call_start_time' | 'technical_overall_score' | 'behavioral_overall_score';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const OUTCOME_OPTIONS = ['PASS', 'PASS_WITH_ISSUES', 'REVIEW', 'FAIL'] as const;

function scoreColor(score: number | null | undefined) {
  if (score == null) return 'text-slate-400';
  if (score >= 2.5) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 1.7) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function recBadge(rec: string | null | undefined) {
  switch (rec) {
    case 'PASS': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    case 'PASS_WITH_ISSUES': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-purple-200 dark:border-purple-800';
    case 'REVIEW': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    case 'FAIL': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800';
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  }
}

function recLabel(rec: string | null | undefined) {
  if (!rec) return 'PENDING';
  return rec.replace(/_/g, ' ');
}

function formatDuration(ms: number | null | undefined) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTime(ts: string | null | undefined) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SortHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField | null;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
    >
      {label}
      {active ? (
        sortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );
}

export function CallsTable({ calls }: { calls: Call[] }) {
  const [search, setSearch] = useState('');
  const [localTech, setLocalTech] = useState('');
  const [localBehav, setLocalBehav] = useState('');
  const [sortField, setSortField] = useState<SortField | null>('call_start_time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return calls.filter((c) => {
      if (q && !c.agent_name?.toLowerCase().includes(q) && !c.dealership_name?.toLowerCase().includes(q) && !c.call_id.includes(q) && !c.call_type?.toLowerCase().includes(q)) return false;
      if (localTech && c.technical_recommendation !== localTech) return false;
      if (localBehav && c.behavioral_recommendation !== localBehav) return false;
      return true;
    });
  }, [calls, search, localTech, localBehav]);

  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? -Infinity;
      const bv = b[sortField] ?? -Infinity;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() { setPage(1); }

  const selectClass = 'h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 pr-6 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none cursor-pointer';

  return (
    <>
      <div className="stat-card mb-12">
        {/* Table header */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Call Log</h2>
              <p className="text-[10px] text-slate-400 font-medium">
                {sorted.length.toLocaleString()} calls · page {page} of {totalPages || 1}
              </p>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search agent, dealership, call ID…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                className="w-full pl-9 pr-4 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="relative">
              <select value={localTech} onChange={(e) => { setLocalTech(e.target.value); resetPage(); }} className={selectClass}>
                <option value="">Tech outcome</option>
                {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            <div className="relative">
              <select value={localBehav} onChange={(e) => { setLocalBehav(e.target.value); resetPage(); }} className={selectClass}>
                <option value="">Behav outcome</option>
                {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            {(search || localTech || localBehav) && (
              <button
                onClick={() => { setSearch(''); setLocalTech(''); setLocalBehav(''); resetPage(); }}
                className="h-8 px-3 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 dark:border-slate-700 hover:border-slate-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-left border-separate border-spacing-y-1.5" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Call / Agent</th>
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <SortHeader label="Time" field="call_start_time" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Type / Intent</th>
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                  <SortHeader label="Tech" field="technical_overall_score" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                  <SortHeader label="Behav" field="behavioral_overall_score" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((call) => (
                <tr key={call.call_id} className="group">
                  {/* Call identity */}
                  <td className="px-3 py-3 bg-slate-50 dark:bg-slate-800/40 first:rounded-l-xl border-y border-l border-slate-100 dark:border-slate-800/60">
                    <div className="font-mono text-[10px] text-slate-400 mb-0.5">{call.call_id.slice(0, 8)}…</div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{call.agent_name ?? 'VINI'}</div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{call.dealership_name ?? '—'}</div>
                  </td>

                  {/* Time + duration */}
                  <td className="px-3 py-3 bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800/60">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatTime(call.call_start_time)}</div>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      {formatDuration(call.duration_ms)}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-3 py-3 bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800/60">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{call.call_type?.replace(/_/g, ' ') ?? '—'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">{call.primary_intent ?? '—'}</div>
                  </td>

                  {/* Tech score + rec */}
                  <td className="px-3 py-3 bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800/60 text-center">
                    <div className={`text-sm font-black ${scoreColor(call.technical_overall_score)}`}>
                      {call.technical_overall_score?.toFixed(2) ?? 'N/A'}
                    </div>
                    <div className={`inline-flex mt-1 px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-tight ${recBadge(call.technical_recommendation)}`}>
                      {recLabel(call.technical_recommendation)}
                    </div>
                  </td>

                  {/* Behav score + rec */}
                  <td className="px-3 py-3 bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800/60 text-center">
                    <div className={`text-sm font-black ${scoreColor(call.behavioral_overall_score)}`}>
                      {call.behavioral_overall_score?.toFixed(2) ?? 'N/A'}
                    </div>
                    <div className={`inline-flex mt-1 px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-tight ${recBadge(call.behavioral_recommendation)}`}>
                      {recLabel(call.behavioral_recommendation)}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-3 py-3 bg-slate-50 dark:bg-slate-800/40 last:rounded-r-xl border-y border-r border-slate-100 dark:border-slate-800/60">
                    <button
                      onClick={() => setSelectedCall(call)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:text-brand-600 text-xs font-bold text-slate-500 transition-all group-hover:border-brand-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-400 italic">
                    No calls match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:border-brand-400 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) p = i + 1;
                else if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${p === page ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:border-brand-400 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Call detail drawer */}
      <CallDetailDrawer call={selectedCall} onClose={() => setSelectedCall(null)} />
    </>
  );
}
