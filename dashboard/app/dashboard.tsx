'use client';

import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, LayoutDashboard, ShieldCheck, Activity, AlertTriangle, PhoneCall } from 'lucide-react';
import { SummaryCards } from './components/SummaryCards';
import { TrackComparison } from './components/TrackComparison';
import { DimensionPerformance } from './components/DimensionPerformance';
import { IssueHeatmap } from './components/IssueHeatmap';
import { CapabilityGaps } from './components/CapabilityGaps';
import { RemediationInsights } from './components/RemediationInsights';
import { CallsTable } from './components/CallsTable';
import { GlobalFilterBar } from './components/GlobalFilterBar';

export interface FilterState {
  dealership: string;
  agent: string;
  call_type: string;
  tech_outcome: string;
  behav_outcome: string;
  primary_intent: string;
}

export type TabId = 'overview' | 'issues' | 'calllog';

interface IssueData {
  call_id: string;
  dimension: string;
  issue_type: string;
  severity: string;
  bucket: string;
}

interface CallData {
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

interface DashboardData {
  total_calls: number;
  pass_rate: number;
  average_technical_score: number;
  average_behavioral_score: number;
  unique_dealerships: number;
  critical_issue_count: number;
  recommendation_mix: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
  dimension_averages: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
  issues: IssueData[];
  issue_summary: {
    severity_counts: Record<string, number>;
    top_issue_types: Array<{ issue_type: string; count: number }>;
  };
  calls: CallData[];
  capability_gaps: Array<{
    id?: string;
    gap_type?: string;
    pattern?: string;
    affected_calls?: number;
    affected_call_ids?: string[];
    recommendation?: string;
    surfaced_at?: string;
  }>;
  remediation_insights: Array<{
    id?: string;
    gap_id?: string;
    root_cause_type?: string;
    analysis?: string;
    proposed_remediation?: string;
  }>;
  filter_options: {
    dealerships: string[];
    agents: string[];
    call_types: string[];
    primary_intents: string[];
  };
}

const EMPTY_FILTERS: FilterState = {
  dealership: '',
  agent: '',
  call_type: '',
  tech_outcome: '',
  behav_outcome: '',
  primary_intent: '',
};

const TABS = [
  { id: 'overview' as TabId, label: 'Overview', icon: LayoutDashboard },
  { id: 'issues' as TabId, label: 'Issues & Intelligence', icon: AlertTriangle },
  { id: 'calllog' as TabId, label: 'Call Log', icon: PhoneCall },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

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
      setLastRefreshed(new Date());
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

  // Filtered calls based on global filter state
  const filteredCalls = useMemo(() => {
    if (!data) return [];
    return data.calls.filter((call) => {
      if (filters.dealership && call.dealership_name !== filters.dealership) return false;
      if (filters.agent && call.agent_name !== filters.agent) return false;
      if (filters.call_type && call.call_type !== filters.call_type) return false;
      if (filters.tech_outcome && call.technical_recommendation !== filters.tech_outcome) return false;
      if (filters.behav_outcome && call.behavioral_recommendation !== filters.behav_outcome) return false;
      if (filters.primary_intent && call.primary_intent !== filters.primary_intent) return false;
      return true;
    });
  }, [data, filters]);

  const filteredCallIds = useMemo(() => new Set(filteredCalls.map((c) => c.call_id)), [filteredCalls]);

  const filteredIssues = useMemo(() => {
    if (!data) return [];
    return data.issues.filter((i) => filteredCallIds.has(i.call_id));
  }, [data, filteredCallIds]);

  // Recompute KPIs from filtered calls
  const filteredKPIs = useMemo(() => {
    const total = filteredCalls.length;
    if (total === 0) return { total: 0, passRate: 0, avgTech: 0, avgBehav: 0, avgQuality: 0, uniqueDealerships: 0, criticalIssues: 0 };
    const passCount = filteredCalls.filter(
      (c) =>
        (c.technical_recommendation === 'PASS' || c.technical_recommendation === 'PASS_WITH_ISSUES') &&
        (c.behavioral_recommendation === 'PASS' || c.behavioral_recommendation === 'PASS_WITH_ISSUES')
    ).length;
    const avgTech = filteredCalls.reduce((s, c) => s + (c.technical_overall_score ?? 0), 0) / total;
    const avgBehav = filteredCalls.reduce((s, c) => s + (c.behavioral_overall_score ?? 0), 0) / total;
    const uniqueDealerships = new Set(filteredCalls.map((c) => c.dealership_name).filter(Boolean)).size;
    const criticalIssues = filteredIssues.filter((i) => i.severity === 'critical').length;
    return {
      total,
      passRate: (passCount / total) * 100,
      avgTech,
      avgBehav,
      avgQuality: (avgTech + avgBehav) / 2,
      uniqueDealerships,
      criticalIssues,
    };
  }, [filteredCalls, filteredIssues]);

  // Recompute recommendation mix from filtered calls
  const filteredRecommendationMix = useMemo(() => {
    const mix = { technical: {} as Record<string, number>, behavioral: {} as Record<string, number> };
    for (const call of filteredCalls) {
      const tech = call.technical_recommendation ?? 'Unknown';
      const behav = call.behavioral_recommendation ?? 'Unknown';
      mix.technical[tech] = (mix.technical[tech] || 0) + 1;
      mix.behavioral[behav] = (mix.behavioral[behav] || 0) + 1;
    }
    return mix;
  }, [filteredCalls]);

  function navigate(tab: TabId, newFilters?: Partial<FilterState>) {
    if (newFilters) setFilters((prev) => ({ ...prev, ...newFilters }));
    setActiveTab(tab);
  }

  const isFiltered = Object.values(filters).some(Boolean);

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
          <p className="text-slate-500 text-sm mb-8 leading-relaxed italic">"{error}"</p>
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
      {/* Top Navigation */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-tight">
                VINI <span className="text-brand-600">QC</span>
              </h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                Neural Scoring Pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="hidden md:block text-xs text-slate-400">
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            {isFiltered && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={() => fetchDashboardData()}
              disabled={refreshing}
              className="group p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-brand-500 hover:text-brand-600 transition-all active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-600' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mx-auto max-w-7xl px-4 flex gap-1 pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.id === 'calllog' && isFiltered && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[9px] font-black">
                    {filteredCalls.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Filter Bar */}
      {data && (
        <GlobalFilterBar
          filters={filters}
          onChange={setFilters}
          options={data.filter_options}
          filteredCount={filteredCalls.length}
          totalCount={data.total_calls}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-6">
        {data && (
          <>
            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <SummaryCards
                  totalCalls={filteredKPIs.total}
                  passRate={filteredKPIs.passRate}
                  averageTechnicalScore={filteredKPIs.avgTech}
                  averageBehavioralScore={filteredKPIs.avgBehav}
                  avgQualityScore={filteredKPIs.avgQuality}
                  criticalIssueCount={filteredKPIs.criticalIssues}
                  uniqueDealerships={filteredKPIs.uniqueDealerships}
                  onNavigate={navigate}
                />
                <TrackComparison
                  recommendationMix={filteredRecommendationMix}
                  averageTechnicalScore={filteredKPIs.avgTech}
                  averageBehavioralScore={filteredKPIs.avgBehav}
                  onNavigate={navigate}
                />
                <DimensionPerformance dimensionAverages={data.dimension_averages} />
              </div>
            )}

            {/* Tab 2: Issues & Intelligence */}
            {activeTab === 'issues' && (
              <div className="space-y-6">
                <IssueHeatmap
                  issues={filteredIssues}
                  issueSummary={data.issue_summary}
                />
                <CapabilityGaps
                  gaps={data.capability_gaps}
                  remediationInsights={data.remediation_insights}
                />
                <RemediationInsights insights={data.remediation_insights} />
              </div>
            )}

            {/* Tab 3: Call Log */}
            {activeTab === 'calllog' && (
              <CallsTable calls={filteredCalls} />
            )}
          </>
        )}
      </div>

      <footer className="mx-auto max-w-7xl px-4 py-8 border-t border-slate-200 dark:border-slate-800 mt-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-40">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">End-to-End Encrypted Data Pipeline</span>
          </div>
          <p className="text-xs font-medium text-slate-400">
            © 2026 VINI AI · GPT-4o Agentic Judges · 12 Dimensions
          </p>
        </div>
      </footer>
    </main>
  );
}
