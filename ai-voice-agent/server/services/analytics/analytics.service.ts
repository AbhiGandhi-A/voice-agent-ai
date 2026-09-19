import { getAdminClient } from '../../db/supabase';
import { ApiError } from '../../middleware/error';

export interface AnalyticsRange {
  from?: string;
  to?: string;
}

export interface CallAnalytics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  missedCalls: number;
  averageDurationSeconds: number;
  aiHandled: number;
  humanTakeover: number;
  escalations: number;
  resolvedCalls: number;
  followUps: number;
  totalDurationSeconds: number;
}

export interface CallRow {
  id: string;
  status: string;
  ai_status: string;
  duration_seconds: number;
  created_at: string;
}

export const analyticsService = {
  async callAnalytics(range: AnalyticsRange = {}): Promise<CallAnalytics> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    let query = client.from('calls').select('id, status, ai_status, duration_seconds, created_at');
    if (range.from) query = query.gte('created_at', range.from);
    if (range.to) query = query.lte('created_at', range.to);

    const { data, error } = await query;
    if (error) throw new ApiError(500, 'db_error', 'Failed to compute call analytics.');

    const calls = (data ?? []) as CallRow[];

    const summaryRows = await this.countSummaries(range);

    const completed = calls.filter((c) => c.status === 'ended');
    const failed = calls.filter((c) => c.status === 'failed');
    const missed = calls.filter((c) => c.status === 'failed' && c.ai_status === 'ai_handled');

    const totalDuration = completed.reduce((acc, c) => acc + (c.duration_seconds ?? 0), 0);

    return {
      totalCalls: calls.length,
      completedCalls: completed.length,
      failedCalls: failed.length,
      missedCalls: missed.length,
      averageDurationSeconds: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
      aiHandled: calls.filter((c) => c.ai_status === 'ai_handled').length,
      humanTakeover: calls.filter((c) => c.ai_status === 'human_takeover').length,
      escalations: summaryRows.escalations,
      resolvedCalls: summaryRows.resolved,
      followUps: summaryRows.followups,
      totalDurationSeconds: totalDuration,
    };
  },

  async callTrend(range: AnalyticsRange = {}, bucket = 'day'): Promise<Array<{ label: string; count: number }>> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    let query = client.from('calls').select('created_at').order('created_at', { ascending: false }).limit(500);
    if (range.from) query = query.gte('created_at', range.from);
    if (range.to) query = query.lte('created_at', range.to);

    const { data, error } = await query;
    if (error) throw new ApiError(500, 'db_error', 'Failed to compute call trend.');

    const counts = new Map<string, number>();
    const labels: string[] = [];

    for (const row of data ?? []) {
      const date = new Date(row.created_at as string);
      let label: string;
      if (bucket === 'hour') label = date.toISOString().slice(0, 13);
      else if (bucket === 'month') label = date.toISOString().slice(0, 7);
      else label = date.toISOString().slice(0, 10);
      counts.set(label, (counts.get(label) ?? 0) + 1);
      if (!labels.includes(label)) labels.push(label);
    }
    labels.sort();
    return labels.map((label) => ({ label, count: counts.get(label) ?? 0 }));
  },

  async countSummaries(range: AnalyticsRange = {}) {
    const client = getAdminClient();
    if (!client) return { escalations: 0, resolved: 0, followups: 0 };

    const { data, error } = await client
      .from('call_summaries')
      .select('outcome, escalation_required')
      .gte('created_at', range.from ?? '1970-01-01')
      .lte('created_at', range.to ?? '2999-12-31');

    if (error) return { escalations: 0, resolved: 0, followups: 0 };

    const rows = data ?? [];
    return {
      escalations: rows.filter((r) => r.escalation_required === true).length,
      resolved: rows.filter((r) => r.outcome === 'resolved').length,
      followups: rows.filter((r) => r.outcome === 'follow_up_needed').length,
    };
  },
};