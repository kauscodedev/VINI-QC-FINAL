import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseServer";

type CallRow = {
  call_id: string;
  agent_name?: string | null;
  agent_type?: string | null;
  call_start_time?: string | null;
  duration_ms?: number | null;
  call_type_raw?: string | null;
};

type ContextRow = {
  call_id: string;
  dealership_name?: string | null;
};

type ClassificationRow = {
  call_id: string;
  call_type?: string | null;
  primary_intent?: string | null;
};

async function fetchData() {
  const [callsRes, contextsRes, classificationsRes, overallRes, dimRes, issuesRes, gapsRes, remediationRes] = await Promise.all([
    supabase.from("calls").select("call_id, agent_name, agent_type, call_start_time, duration_ms, call_type_raw"),
    supabase.from("call_contexts").select("call_id, dealership_name"),
    supabase.from("call_classifications").select("call_id, call_type, primary_intent"),
    supabase.from("call_overall_scores").select("*").order("scored_at", { ascending: false }),
    supabase.from("dimension_scores").select("dimension, score, bucket"),
    supabase.from("issues").select("severity, issue_type"),
    supabase.from("capability_gaps").select("gap_type, pattern, affected_calls, recommendation").order("surfaced_at", { ascending: false }).limit(4),
    supabase.from("remediation_insights").select("id, batch_id, root_cause, proposed_fix").limit(4),
  ]);

  const errors = [callsRes.error, contextsRes.error, classificationsRes.error, overallRes.error, dimRes.error, issuesRes.error, gapsRes.error, remediationRes.error].filter(Boolean);
  if (errors.length) {
    throw new Error(errors.map((err) => err?.message).join(" | "));
  }

  const callsById = new Map<string, CallRow>((callsRes.data ?? []).map((row) => [row.call_id, row]));
  const contextsById = new Map<string, ContextRow>((contextsRes.data ?? []).map((row) => [row.call_id, row]));
  const classificationsById = new Map<string, ClassificationRow>((classificationsRes.data ?? []).map((row) => [row.call_id, row]));
  const dimensions = dimRes.data ?? [];
  const issues = issuesRes.data ?? [];

  const totalCalls = overallRes.data?.length ?? 0;
  const averageTechnicalScore = totalCalls
    ? (overallRes.data!.reduce((sum, row) => sum + (row.technical_overall_score ?? 0), 0) / totalCalls)
    : 0;
  const averageBehavioralScore = totalCalls
    ? (overallRes.data!.reduce((sum, row) => sum + (row.behavioral_overall_score ?? 0), 0) / totalCalls)
    : 0;

  const uniqueDealerships = new Set((contextsRes.data ?? []).map((row) => row.dealership_name ?? "")).size;

  const recommendationMix = {
    technical: {} as Record<string, number>,
    behavioral: {} as Record<string, number>,
  };
  for (const row of overallRes.data ?? []) {
    const tech = row.technical_recommendation ?? "Unknown";
    const behav = row.behavioral_recommendation ?? "Unknown";
    recommendationMix.technical[tech] = (recommendationMix.technical[tech] || 0) + 1;
    recommendationMix.behavioral[behav] = (recommendationMix.behavioral[behav] || 0) + 1;
  }

  const dimensionAverages = {
    technical: {} as Record<string, number>,
    behavioral: {} as Record<string, number>,
  };
  const dimensionCounts = { technical: {} as Record<string, number>, behavioral: {} as Record<string, number> };

  for (const row of dimensions) {
    if (row.score == null) continue;
    const bucket = row.bucket as "technical" | "behavioral";
    dimensionAverages[bucket][row.dimension] = (dimensionAverages[bucket][row.dimension] || 0) + row.score;
    dimensionCounts[bucket][row.dimension] = (dimensionCounts[bucket][row.dimension] || 0) + 1;
  }

  for (const bucket of ["technical", "behavioral"] as const) {
    for (const dimension of Object.keys(dimensionAverages[bucket])) {
      dimensionAverages[bucket][dimension] =
        dimensionAverages[bucket][dimension] / dimensionCounts[bucket][dimension];
    }
  }

  const severityCounts: Record<string, number> = {};
  const issueTypes: Record<string, number> = {};
  for (const issue of issues) {
    severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
    issueTypes[issue.issue_type] = (issueTypes[issue.issue_type] || 0) + 1;
  }

  const topIssueTypes = Object.entries(issueTypes)
    .map(([issue_type, count]) => ({ issue_type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const calls = (overallRes.data ?? []).map((overall) => {
    const call = callsById.get(overall.call_id) as CallRow | undefined;
    const context = contextsById.get(overall.call_id) as ContextRow | undefined;
    const classification = classificationsById.get(overall.call_id) as ClassificationRow | undefined;
    return {
      call_id: overall.call_id,
      call_start_time: call?.call_start_time ?? null,
      agent_name: call?.agent_name ?? null,
      agent_type: call?.agent_type ?? null,
      dealership_name: context?.dealership_name ?? null,
      call_type: classification?.call_type ?? call?.call_type_raw ?? null,
      primary_intent: classification?.primary_intent ?? null,
      technical_overall_score: overall.technical_overall_score ?? null,
      behavioral_overall_score: overall.behavioral_overall_score ?? null,
      technical_recommendation: overall.technical_recommendation ?? null,
      behavioral_recommendation: overall.behavioral_recommendation ?? null,
    };
  });

  return {
    total_calls: totalCalls,
    average_technical_score: averageTechnicalScore,
    average_behavioral_score: averageBehavioralScore,
    unique_dealerships: uniqueDealerships,
    recommendation_mix: recommendationMix,
    dimension_averages: dimensionAverages,
    issue_summary: {
      severity_counts: severityCounts,
      top_issue_types: topIssueTypes,
    },
    calls,
    capability_gaps: gapsRes.data ?? [],
    remediation_insights: remediationRes.data ?? [],
  };
}

export async function GET() {
  try {
    const data = await fetchData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
