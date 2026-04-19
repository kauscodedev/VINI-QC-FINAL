'use client';

import { useEffect, useState } from 'react';
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
  calls: Array<{
    call_id: string;
    call_start_time?: string;
    agent_name?: string;
    agent_type?: string;
    dealership_name?: string;
    call_type?: string;
    primary_intent?: string;
    technical_overall_score?: number;
    behavioral_overall_score?: number;
    technical_recommendation?: string;
    behavioral_recommendation?: string;
  }>;
  capability_gaps: Array<{
    gap_type?: string;
    pattern?: string;
    affected_calls?: number;
    recommendation?: string;
    surfaced_at?: string;
  }>;
  remediation_insights: Array<{
    id?: string;
    batch_id?: string;
    root_cause?: string;
    proposed_fix?: string;
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          throw new Error(`API error: ${res.statusText}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch dashboard data'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
            Error Loading Dashboard
          </h2>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <main className="w-full bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            QC Scoring Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Executive summary of technical and behavioral call quality
          </p>
        </div>

        <SummaryCards
          totalCalls={data.total_calls}
          averageTechnicalScore={data.average_technical_score}
          averageBehavioralScore={data.average_behavioral_score}
          uniqueDealerships={data.unique_dealerships}
        />

        <TrackComparison
          recommendationMix={data.recommendation_mix}
        />

        <DimensionPerformance
          dimensionAverages={data.dimension_averages}
        />

        <IssueHeatmap issueSummary={data.issue_summary} />

        <CapabilityGaps gaps={data.capability_gaps} />

        <RemediationInsights insights={data.remediation_insights} />

        <CallsTable calls={data.calls} />
      </div>
    </main>
  );
}
