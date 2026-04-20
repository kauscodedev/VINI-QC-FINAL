'use client';

import { useEffect, useState } from 'react';
import { X, Clock, Building2, AlertCircle, AlertTriangle, User, Phone, MapPin, Car } from 'lucide-react';

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

interface DimScore {
  dimension: string;
  score: number | null;
  score_na?: boolean;
  reasoning?: string;
  weight?: number;
  bucket: string;
}

interface IssueItem {
  dimension: string;
  issue_type: string;
  severity: string;
  bucket?: string;
  turn_number?: number | null;
  evidence?: string | { text?: string } | null;
}

interface CallDetail {
  call: {
    agent_name?: string;
    agent_type?: string;
    call_start_time?: string;
    duration_ms?: number;
    call_type_raw?: string;
    ended_reason?: string;
  } | null;
  context: {
    dealership_name?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    customer_city?: string;
    customer_state?: string;
    interested_vehicle?: string;
    formatted_transcript?: string;
  } | null;
  classification: {
    call_type?: string;
    primary_intent?: string;
    reasoning?: string;
    model?: string;
  } | null;
  overall: {
    technical_overall_score?: number;
    behavioral_overall_score?: number;
    technical_recommendation?: string;
    behavioral_recommendation?: string;
    technical_critical_count?: number;
    technical_warning_count?: number;
    behavioral_critical_count?: number;
    behavioral_warning_count?: number;
  } | null;
  dimension_scores: DimScore[];
  issues: IssueItem[];
}

interface CallDetailDrawerProps {
  call: Call | null;
  onClose: () => void;
}

function scoreColor(score: number | null | undefined) {
  if (score == null) return 'text-slate-400';
  if (score >= 2.5) return 'text-emerald-500';
  if (score >= 1.7) return 'text-amber-500';
  return 'text-red-500';
}

function recBadge(rec: string | null | undefined) {
  switch (rec) {
    case 'PASS': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'PASS_WITH_ISSUES': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'REVIEW': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'FAIL': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

function formatTime(ts: string | null | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number | null | undefined) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function cleanDim(name: string) {
  return name.replace(/^behavior_/, '').replace(/_/g, ' ');
}

function evidenceText(evidence: IssueItem['evidence']): string | null {
  if (!evidence) return null;
  if (typeof evidence === 'string') return evidence;
  if (typeof evidence === 'object' && evidence.text) return evidence.text;
  return null;
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600 text-xs">N/A</span>;
  const pct = ((score - 1) / 2) * 100;
  const color = score >= 2.5 ? '#10b981' : score >= 1.7 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-black w-8 text-right" style={{ color }}>{score.toFixed(2)}</span>
    </div>
  );
}

export function CallDetailDrawer({ call, onClose }: CallDetailDrawerProps) {
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!call) { setDetail(null); return; }
    setLoading(true);
    setDetail(null);
    setExpandedReasoning(null);
    setShowTranscript(false);
    fetch(`/api/calls/${call.call_id}`)
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [call]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const open = Boolean(call);
  const overall = detail?.overall;
  const context = detail?.context;
  const classification = detail?.classification;
  const technicalScores = detail?.dimension_scores?.filter((d) => d.bucket === 'technical') ?? [];
  const behavioralScores = detail?.dimension_scores?.filter((d) => d.bucket === 'behavioral') ?? [];
  const criticalIssues = detail?.issues?.filter((i) => i.severity === 'critical') ?? [];
  const warningIssues = detail?.issues?.filter((i) => i.severity === 'warning') ?? [];

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      <div className={`fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-slate-900 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800 shrink-0">
          <div>
            <p className="text-[10px] font-mono text-slate-500 mb-1 select-all">{call?.call_id}</p>
            <h2 className="text-base font-black text-white uppercase tracking-tight">Call Detail</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{call?.dealership_name ?? context?.dealership_name ?? '—'}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(call?.call_start_time ?? detail?.call?.call_start_time)}</span>
              <span>{formatDuration(call?.duration_ms ?? detail?.call?.duration_ms)}</span>
              {detail?.call?.ended_reason && (
                <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[9px] text-slate-400">{detail.call.ended_reason}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors mt-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Overall scores */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Technical', score: overall?.technical_overall_score ?? call?.technical_overall_score, rec: overall?.technical_recommendation ?? call?.technical_recommendation, critical: overall?.technical_critical_count, warning: overall?.technical_warning_count },
              { label: 'Behavioral', score: overall?.behavioral_overall_score ?? call?.behavioral_overall_score, rec: overall?.behavioral_recommendation ?? call?.behavioral_recommendation, critical: overall?.behavioral_critical_count, warning: overall?.behavioral_warning_count },
            ].map(({ label, score, rec, critical, warning }) => (
              <div key={label} className="rounded-2xl bg-slate-800 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                <p className={`text-2xl font-black mb-2 ${scoreColor(score)}`}>
                  {score?.toFixed(2) ?? 'N/A'}<span className="text-xs font-medium text-slate-500"> /3</span>
                </p>
                <span className={`inline-flex px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${recBadge(rec)}`}>
                  {rec?.replace(/_/g, ' ') ?? 'PENDING'}
                </span>
                {(critical != null || warning != null) && (
                  <div className="flex gap-2 mt-2">
                    {critical != null && <span className="text-[9px] text-red-400 font-bold">{critical}✕ crit</span>}
                    {warning != null && <span className="text-[9px] text-amber-400 font-bold">{warning}✕ warn</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Customer context */}
          {context && (context.customer_name || context.customer_phone || context.interested_vehicle) && (
            <div className="rounded-2xl bg-slate-800 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Customer</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {context.customer_name && (
                  <div className="flex items-center gap-1.5 text-slate-300"><User className="w-3 h-3 text-slate-500" />{context.customer_name}</div>
                )}
                {context.customer_phone && (
                  <div className="flex items-center gap-1.5 text-slate-300"><Phone className="w-3 h-3 text-slate-500" />{context.customer_phone}</div>
                )}
                {(context.customer_city || context.customer_state) && (
                  <div className="flex items-center gap-1.5 text-slate-300"><MapPin className="w-3 h-3 text-slate-500" />{[context.customer_city, context.customer_state].filter(Boolean).join(', ')}</div>
                )}
                {context.interested_vehicle && (
                  <div className="flex items-center gap-1.5 text-slate-300 col-span-2"><Car className="w-3 h-3 text-slate-500" />{context.interested_vehicle}</div>
                )}
              </div>
            </div>
          )}

          {/* Classification */}
          {classification && (
            <div className="rounded-2xl bg-slate-800 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Classification</p>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="px-2 py-1 bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 capitalize">
                  {classification.call_type?.replace(/_/g, ' ') ?? '—'}
                </span>
                <span className="px-2 py-1 bg-slate-700 rounded-lg text-xs font-semibold text-slate-200">
                  {classification.primary_intent ?? '—'}
                </span>
                {classification.model && (
                  <span className="px-2 py-1 bg-brand-900/40 rounded-lg text-[10px] font-mono text-brand-400">{classification.model}</span>
                )}
              </div>
              {classification.reasoning && (
                <p className="text-[11px] text-slate-400 leading-relaxed">{classification.reasoning}</p>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-brand-500" />
            </div>
          )}

          {/* Dimension scores */}
          {!loading && (technicalScores.length > 0 || behavioralScores.length > 0) && (
            <>
              {[
                { label: 'Technical Dimensions', scores: technicalScores, accent: 'text-brand-400' },
                { label: 'Behavioral Dimensions', scores: behavioralScores, accent: 'text-purple-400' },
              ].map(({ label, scores, accent }) => scores.length > 0 && (
                <div key={label}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${accent}`}>{label}</p>
                  <div className="space-y-1">
                    {scores.sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).map((dim) => (
                      <div key={dim.dimension}>
                        <button
                          onClick={() => setExpandedReasoning(expandedReasoning === dim.dimension ? null : dim.dimension)}
                          className="w-full flex items-center gap-3 py-1.5 hover:bg-slate-800 px-2 rounded-lg transition-colors group"
                        >
                          <span className="text-xs font-semibold text-slate-300 capitalize w-32 text-left shrink-0">{cleanDim(dim.dimension)}</span>
                          {dim.score_na ? (
                            <span className="text-xs text-slate-500 flex-1 text-left">N/A</span>
                          ) : (
                            <ScoreBar score={dim.score} />
                          )}
                          {dim.reasoning && (
                            <span className="text-[9px] text-slate-600 group-hover:text-slate-400 shrink-0">
                              {expandedReasoning === dim.dimension ? '▲' : '▼'}
                            </span>
                          )}
                        </button>
                        {expandedReasoning === dim.dimension && dim.reasoning && (
                          <div className="mx-2 mb-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">
                            <p className="text-xs text-slate-300 leading-relaxed">{dim.reasoning}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Issues */}
          {!loading && detail?.issues && detail.issues.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                Issues ({detail.issues.length})
              </p>
              <div className="space-y-2">
                {[...criticalIssues, ...warningIssues].map((issue, idx) => {
                  const ev = evidenceText(issue.evidence);
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-2.5 rounded-xl ${issue.severity === 'critical' ? 'bg-red-900/20 border border-red-800/40' : 'bg-amber-900/20 border border-amber-800/40'}`}
                    >
                      <div className="flex items-start gap-2">
                        {issue.severity === 'critical'
                          ? <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-black uppercase tracking-wider ${issue.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>{issue.severity}</span>
                            <span className="text-[10px] text-slate-400 font-mono capitalize">{cleanDim(issue.dimension)}</span>
                            {issue.turn_number != null && <span className="text-[9px] text-slate-600">Turn {issue.turn_number}</span>}
                          </div>
                          <p className="text-xs font-semibold text-slate-200 mt-0.5 capitalize">{issue.issue_type.replace(/_/g, ' ')}</p>
                          {ev && <p className="text-[11px] text-slate-400 mt-1 leading-relaxed italic">"{ev}"</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transcript */}
          {!loading && context?.formatted_transcript && (
            <div>
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className="text-xs font-bold text-brand-400 hover:text-brand-300 mb-2"
              >
                {showTranscript ? '▲ Hide transcript' : '▼ Show transcript'}
              </button>
              {showTranscript && (
                <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 max-h-64 overflow-y-auto">
                  <pre className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {context.formatted_transcript}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
