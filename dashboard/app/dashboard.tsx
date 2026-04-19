'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, LayoutDashboard, ShieldCheck, Activity } from 'lucide-react';
import { SummaryCards } from './components/SummaryCards';
import { TrackComparison } from './components/TrackComparison';
import { DimensionPerformance } from './components/DimensionPerformance';
import { IssueHeatmap } from './components/IssueHeatmap';
import { CapabilityGaps } from './components/CapabilityGaps';
import { RemediationInsights } from './components/RemediationInsights';
import { CallsTable } from './components/CallsTable';

interface DashboardData {
  total_calls: number;
  average_technical_score: number;
  average_behavioral_score: number;
  unique_dealerships: number;
  recommendation_mix: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
  dimension_averages: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
  issue_summary: {
    severity_counts: Record<string, number>;
    top_issue_types: Array<{ issue_type: string; count: number }>;
  };
  calls: Array<any>;
  capability_gaps: Array<any>;
  remediation_insights: Array<any>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDashboardData() {
    try {
      setRefreshing(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-6 h-6 text-brand-600 animate-pulse" />
          </div>
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-widest text-slate-400 animate-pulse">
          Syncing VINI Neural QC...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full glass-card p-8 rounded-3xl border-red-100 dark:border-red-900/30 text-center">
          <div className="inline-flex p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 mb-6">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 uppercase">
            System Synchronization Error
          </h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed italic">
            "{error}"
          </p>
          <button 
            onClick={() => fetchDashboardData()}
            className="w-full py-4 rounded-2xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/20"
          >
            Attempt Reconnection
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      {/* Top Navigation / Shell */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="mx-auto max-w-7xl px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-tight">
                VINI <span className="text-brand-600">QC</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                Neural Scoring Pipeline
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6 mr-4 border-r border-slate-200 dark:border-slate-800 pr-8">
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Analysis</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{data?.total_calls} Calls Sync'd</p>
              </div>
            </div>
            
            <button 
              onClick={() => fetchDashboardData()}
              className="group p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-brand-500 hover:text-brand-600 transition-all active:scale-95"
              disabled={refreshing}
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-brand-600' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:py-12">
        {/* Header Section */}
        <div className="mb-12">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
            Executive <span className="premium-gradient-text">Summary</span>
          </h2>
          <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4 text-slate-500">
            <p className="text-sm font-medium leading-relaxed max-w-2xl">
              Distilled analytics from the Agentic QC pipeline. Monitoring technical correctness 
              and behavioral SDR performance across all inbound dealership endpoints.
            </p>
          </div>
        </div>

        {data && (
          <div className="space-y-8">
            <SummaryCards
              totalCalls={data.total_calls}
              averageTechnicalScore={data.average_technical_score}
              averageBehavioralScore={data.average_behavioral_score}
              uniqueDealerships={data.unique_dealerships}
            />

            <TrackComparison recommendationMix={data.recommendation_mix} />

            <DimensionPerformance dimensionAverages={data.dimension_averages} />

            <IssueHeatmap issueSummary={data.issue_summary} />

            <CapabilityGaps gaps={data.capability_gaps} />

            <RemediationInsights insights={data.remediation_insights} />

            <CallsTable calls={data.calls} />
          </div>
        )}
      </div>

      {/* Modern Footer */}
      <footer className="mx-auto max-w-7xl px-4 py-12 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
             <ShieldCheck className="w-4 h-4" />
             <span className="text-xs font-bold uppercase tracking-widest">End-to-End Encrypted Data Pipeline</span>
          </div>
          <p className="text-xs font-medium text-slate-400">
            © 2026 VINI AI. All scoring dimensions are evaluated via GPT-4o Agentic Judges.
          </p>
        </div>
      </footer>
    </main>
  );
}
