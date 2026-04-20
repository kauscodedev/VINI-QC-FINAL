import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseServer';

export async function GET(
  _request: Request,
  { params }: { params: { callId: string } }
) {
  const { callId } = params;
  if (!callId) {
    return NextResponse.json({ error: 'Missing callId' }, { status: 400 });
  }

  const [callRes, contextRes, classificationRes, overallRes, dimRes, issuesRes] = await Promise.all([
    supabase
      .from('calls')
      .select('call_id, agent_name, agent_type, call_start_time, duration_ms, call_type_raw, ended_reason')
      .eq('call_id', callId)
      .maybeSingle(),
    supabase
      .from('call_contexts')
      .select('dealership_name, customer_name, customer_phone, customer_email, customer_city, customer_state, interested_vehicle, formatted_transcript')
      .eq('call_id', callId)
      .maybeSingle(),
    supabase
      .from('call_classifications')
      .select('call_type, primary_intent, reasoning, model')
      .eq('call_id', callId)
      .maybeSingle(),
    supabase
      .from('call_overall_scores')
      .select('technical_overall_score, behavioral_overall_score, technical_recommendation, behavioral_recommendation, technical_critical_count, technical_warning_count, behavioral_critical_count, behavioral_warning_count, technical_calculation, behavioral_calculation')
      .eq('call_id', callId)
      .maybeSingle(),
    supabase
      .from('dimension_scores')
      .select('dimension, score, score_na, reasoning, weight, bucket')
      .eq('call_id', callId)
      .order('bucket', { ascending: true })
      .order('dimension'),
    supabase
      .from('issues')
      .select('dimension, issue_type, severity, turn_number, evidence, bucket')
      .eq('call_id', callId)
      .order('severity', { ascending: true }),
  ]);

  const errors = [callRes.error, contextRes.error, classificationRes.error, overallRes.error, dimRes.error, issuesRes.error].filter(Boolean);
  if (errors.length) {
    return NextResponse.json({ error: errors.map((e) => e?.message).join(' | ') }, { status: 500 });
  }

  return NextResponse.json({
    call: callRes.data ?? null,
    context: contextRes.data ?? null,
    classification: classificationRes.data ?? null,
    overall: overallRes.data ?? null,
    dimension_scores: dimRes.data ?? [],
    issues: issuesRes.data ?? [],
  });
}
