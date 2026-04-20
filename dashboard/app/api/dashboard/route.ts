import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseServer";

async function fetchData() {
  const [callsRes, contextsRes, classificationsRes, overallRes, dimRes, issuesRes, gapsRes, remediationRes] = await Promise.all([
    supabase.from("calls").select("call_id, agent_name, agent_type, call_start_time, duration_ms, call_type_raw"),
    supabase.from("call_contexts").select("call_id, dealership_name"),
    supabase.from("call_classifications").select("call_id, call_type, primary_intent"),
    supabase.from("call_overall_scores").select("*").order("scored_at", { ascending: false }),
    supabase.from("dimension_scores").select("call_id, dimension, score, bucket"),
    supabase.from("issues").select("call_id, dimension, issue_type, severity, bucket"),
    supabase.from("capability_gaps").select("id, gap_type, pattern, affected_calls, recommendation, surfaced_at").order("surfaced_at", { ascending: false }),
    supabase.from("remediation_insights").select("id, gap_id, root_cause_type, analysis, proposed_remediation"),
  ]);

  const errors = [callsRes.error, contextsRes.error, classificationsRes.error, overallRes.error, dimRes.error, issuesRes.error, gapsRes.error, remediationRes.error].filter(Boolean);
  if (errors.length) {
    throw new Error(errors.map((err) => err?.message).join(" | "));
  }

  const callsById = new Map((callsRes.data ?? []).map((row) => [row.call_id, row]));
  const contextsById = new Map((contextsRes.data ?? []).map((row) => [row.call_id, row]));
  const classificationsById = new Map((classificationsRes.data ?? []).map((row) => [row.call_id, row]));
  const allIssues = issuesRes.data ?? [];

  const totalCalls = overallRes.data?.length ?? 0;

  const averageTechnicalScore = totalCalls
    ? overallRes.data!.reduce((sum, row) => sum + (row.technical_overall_score ?? 0), 0) / totalCalls
    : 0;
  const averageBehavioralScore = totalCalls
    ? overallRes.data!.reduce((sum, row) => sum + (row.behavioral_overall_score ?? 0), 0) / totalCalls
    : 0;

  const passCount = (overallRes.data ?? []).filter(
    (row) =>
      (row.technical_recommendation === "PASS" || row.technical_recommendation === "PASS_WITH_ISSUES") &&
      (row.behavioral_recommendation === "PASS" || row.behavioral_recommendation === "PASS_WITH_ISSUES")
  ).length;
  const passRate = totalCalls > 0 ? (passCount / totalCalls) * 100 : 0;

  const criticalIssueCount = allIssues.filter((i) => i.severity === "critical").length;

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

  for (const row of dimRes.data ?? []) {
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
  for (const issue of allIssues) {
    severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
    issueTypes[issue.issue_type] = (issueTypes[issue.issue_type] || 0) + 1;
  }

  const topIssueTypes = Object.entries(issueTypes)
    .map(([issue_type, count]) => ({ issue_type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const calls = (overallRes.data ?? []).map((overall) => {
    const call = callsById.get(overall.call_id);
    const context = contextsById.get(overall.call_id);
    const classification = classificationsById.get(overall.call_id);
    return {
      call_id: overall.call_id,
      call_start_time: call?.call_start_time ?? null,
      agent_name: call?.agent_name ?? null,
      agent_type: call?.agent_type ?? null,
      duration_ms: call?.duration_ms ?? null,
      dealership_name: context?.dealership_name ?? null,
      call_type: classification?.call_type ?? call?.call_type_raw ?? null,
      primary_intent: classification?.primary_intent ?? null,
      technical_overall_score: overall.technical_overall_score ?? null,
      behavioral_overall_score: overall.behavioral_overall_score ?? null,
      technical_recommendation: overall.technical_recommendation ?? null,
      behavioral_recommendation: overall.behavioral_recommendation ?? null,
    };
  });

  const capabilityGaps = (gapsRes.data ?? []).map((gap) => ({
    ...gap,
    affected_call_ids: Array.isArray(gap.affected_calls) ? (gap.affected_calls as string[]) : [],
    affected_calls: Array.isArray(gap.affected_calls) ? gap.affected_calls.length : 0,
  }));

  const filterOptions = {
    dealerships: [
      ...new Set((contextsRes.data ?? []).map((r) => r.dealership_name).filter(Boolean) as string[]),
    ].sort(),
    agents: [
      ...new Set((callsRes.data ?? []).map((r) => r.agent_name).filter(Boolean) as string[]),
    ].sort(),
    call_types: [
      ...new Set(
        [
          ...(callsRes.data ?? []).map((r) => r.call_type_raw),
          ...(classificationsRes.data ?? []).map((r) => r.call_type),
        ].filter(Boolean) as string[]
      ),
    ].sort(),
    primary_intents: [
      ...new Set((classificationsRes.data ?? []).map((r) => r.primary_intent).filter(Boolean) as string[]),
    ].sort(),
  };

  return {
    total_calls: totalCalls,
    pass_rate: passRate,
    average_technical_score: averageTechnicalScore,
    average_behavioral_score: averageBehavioralScore,
    unique_dealerships: uniqueDealerships,
    critical_issue_count: criticalIssueCount,
    recommendation_mix: recommendationMix,
    dimension_averages: dimensionAverages,
    issues: allIssues,
    issue_summary: {
      severity_counts: severityCounts,
      top_issue_types: topIssueTypes,
    },
    calls,
    capability_gaps: capabilityGaps,
    remediation_insights: remediationRes.data ?? [],
    filter_options: filterOptions,
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
