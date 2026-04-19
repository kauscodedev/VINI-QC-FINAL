'use client';

import { useState } from 'react';
import { ChevronRight, Search, Filter, ArrowUpDown, Calendar, User, Building } from 'lucide-react';

interface Call {
  call_id: string;
  call_start_time?: string | null;
  agent_name?: string | null;
  agent_type?: string | null;
  dealership_name?: string | null;
  call_type?: string | null;
  primary_intent?: string | null;
  technical_overall_score?: number | null;
  behavioral_overall_score?: number | null;
  technical_recommendation?: string | null;
  behavioral_recommendation?: string | null;
}

interface CallsTableProps {
  calls: Call[];
}

export function CallsTable({ calls }: CallsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCalls = calls.filter((call) =>
    (call.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     call.dealership_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     call.call_id.includes(searchTerm))
  );

  const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-slate-400';
    if (score >= 2.5) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 1.7) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getRecBadge = (rec: string | null | undefined) => {
    switch (rec) {
      case 'PASS':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800';
      case 'PASS_WITH_ISSUES':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-100 dark:border-purple-800';
      case 'REVIEW':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-100 dark:border-amber-800';
      case 'FAIL':
        return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-100 dark:border-red-800';
      default:
        return 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-100 dark:border-slate-700';
    }
  };

  return (
    <div className="mt-8 stat-card mb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
            Comprehensive Call Log
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Drill down into individual agent performance
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search agents, IDs, or dealerships..."
            className="pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full md:w-80 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-slate-400 dark:text-slate-500">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Call Identity</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Classification</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center">Tech Score</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center">Behav Score</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCalls.map((call) => (
              <tr key={call.call_id} className="group transition-all hover:translate-x-1">
                <td className="px-4 py-4 bg-slate-50 dark:bg-slate-800/40 first:rounded-l-2xl border-y border-l border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{call.agent_name || 'System Agent'}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-tight">{call.dealership_name || 'Direct Enterprise'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800/50">
                   <div className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{call.call_type?.replace(/_/g, ' ')}</div>
                   <div className="text-[10px] text-slate-400 mt-0.5">{call.primary_intent || 'General Inquiry'}</div>
                </td>
                <td className="px-4 py-4 bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800/50 text-center">
                  <div className={`text-sm font-black ${getScoreColor(call.technical_overall_score)}`}>
                    {call.technical_overall_score?.toFixed(2) || 'N/A'}
                  </div>
                  <div className={`inline-flex px-2 py-0.5 mt-1 rounded-md border text-[9px] font-black uppercase tracking-tighter ${getRecBadge(call.technical_recommendation)}`}>
                    {call.technical_recommendation || 'PENDING'}
                  </div>
                </td>
                <td className="px-4 py-4 bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800/50 text-center">
                  <div className={`text-sm font-black ${getScoreColor(call.behavioral_overall_score)}`}>
                    {call.behavioral_overall_score?.toFixed(2) || 'N/A'}
                  </div>
                  <div className={`inline-flex px-2 py-0.5 mt-1 rounded-md border text-[9px] font-black uppercase tracking-tighter ${getRecBadge(call.behavioral_recommendation)}`}>
                    {call.behavioral_recommendation || 'PENDING'}
                  </div>
                </td>
                <td className="px-4 py-4 bg-slate-50 dark:bg-slate-800/40 last:rounded-r-2xl border-y border-r border-slate-100 dark:border-slate-800/50">
                  <button className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-brand-50 hover:border-brand-200 transition-colors">
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-brand-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
