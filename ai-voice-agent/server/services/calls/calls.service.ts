import { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '../../db/supabase';
import { ApiError } from '../../middleware/error';
import { logger } from '../../utils/logger';
import { canTransition, CallState, isTerminal } from './call-state-machine';

export interface CreateCallInput {
  userId: string;
  phoneNumber: string;
  contactId?: string;
  contactName?: string;
  direction?: 'inbound' | 'outbound';
  provider?: string;
  providerCallId?: string;
}

export interface ListCallsParams {
  page: number;
  limit: number;
  status?: string;
  direction?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface CallEventPayload {
  eventType: string;
  payload?: Record<string, unknown>;
}

const CALL_EVENT_TYPES = new Set([
  'call_created', 'call_ringing', 'call_answered', 'call_started',
  'ai_started', 'ai_stopped', 'transcript_partial', 'transcript_final',
  'agent_takeover', 'agent_message', 'hold', 'resume', 'transfer',
  'call_ended', 'call_failed',
]);

export const callsService = {
  async createCall(input: CreateCallInput): Promise<Record<string, unknown>> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed (Supabase not configured).');

    const { data, error } = await client
      .from('calls')
      .insert({
        user_id: input.userId,
        contact_id: input.contactId ?? null,
        contact_name: input.contactName ?? null,
        phone_number: input.phoneNumber,
        direction: input.direction ?? 'outbound',
        status: 'connecting',
        ai_status: 'ai_handled',
        provider: input.provider ?? 'none',
        provider_call_id: input.providerCallId ?? null,
      })
      .select('*')
      .single();

    if (error) {
      logger.error('create_call_failed', { message: error.message });
      throw new ApiError(500, 'db_error', 'Failed to create call record.');
    }

    await this.logEvent(client, data.id, { eventType: 'call_created', payload: { phoneNumber: input.phoneNumber } });
    return data;
  },

  async getCall(callId: string): Promise<Record<string, unknown>> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { data, error } = await client.from('calls').select('*').eq('id', callId).maybeSingle();
    if (error || !data) throw new ApiError(404, 'not_found', 'Call not found.');
    return data;
  },

  async getCallByProviderId(providerCallId: string): Promise<Record<string, unknown> | null> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { data, error } = await client.from('calls').select('*').eq('provider_call_id', providerCallId).maybeSingle();
    if (error || !data) return null;
    return data;
  },

  async list(params: ListCallsParams): Promise<{ total: number; calls: unknown[]; page: number; limit: number }> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    let query = client.from('calls').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (params.status) query = query.eq('status', params.status);
    if (params.direction) query = query.eq('direction', params.direction);
    if (params.from) query = query.gte('created_at', params.from);
    if (params.to) query = query.lte('created_at', params.to);
    if (params.search) {
      query = query.or(`phone_number.ilike.%${params.search}%,contact_name.ilike.%${params.search}%`);
    }
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      logger.error('list_calls_failed', { message: error.message });
      throw new ApiError(500, 'db_error', 'Failed to list calls.');
    }
    return { total: count ?? 0, calls: data ?? [], page, limit };
  },

  async listByUser(userId: string, params: ListCallsParams) {
    // Agents only see their own calls; supervisors/admins see all (RLS mirror).
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    let query = client.from('calls').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false });
    if (params.status) query = query.eq('status', params.status);
    if (params.direction) query = query.eq('direction', params.direction);
    if (params.search) query = query.or(`phone_number.ilike.%${params.search}%,contact_name.ilike.%${params.search}%`);
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new ApiError(500, 'db_error', 'Failed to list calls.');
    return { total: count ?? 0, calls: data ?? [], page, limit };
  },

  async updateCallStatus(callId: string, status: CallState, meta: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    const current = await this.getCall(callId);
    const currentStatus = current.status as CallState;

    if (!canTransition(currentStatus, status)) {
      logger.warn('invalid_call_transition', { callId, from: currentStatus, to: status });
      throw new ApiError(409, 'invalid_transition', `Cannot transition call from ${currentStatus} to ${status}.`);
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      ...meta,
    };

    if (status === 'connected' && currentStatus === 'ringing' && !current.answered_at) {
      patch.answered_at = new Date().toISOString();
    }
    if (status === 'ended' || status === 'failed') {
      patch.ended_at = new Date().toISOString();
      const started = new Date(current.started_at as string).getTime();
      const end = Date.now();
      if (Number.isFinite(started)) patch.duration_seconds = Math.max(0, Math.floor((end - started) / 1000));
    }

    const { data, error } = await client.from('calls').update(patch).eq('id', callId).select('*').single();
    if (error) {
      logger.error('update_call_failed', { message: error.message });
      throw new ApiError(500, 'db_error', 'Failed to update call.');
    }
    return data;
  },

  async updateCall(callId: string, patch: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { data, error } = await client.from('calls').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', callId).select('*').single();
    if (error) throw new ApiError(500, 'db_error', 'Failed to update call.');
    return data;
  },

  async logEvent(client: SupabaseClient | null, callId: string, event: CallEventPayload): Promise<void> {
    const c = client ?? getAdminClient();
    if (!c) {
      logger.warn('skip_event_log', { callId, eventType: event.eventType });
      return;
    }
    if (!CALL_EVENT_TYPES.has(event.eventType)) {
      throw new Error(`Unknown call event type: ${event.eventType}`);
    }
    const { error } = await c.from('call_events').insert({
      call_id: callId,
      event_type: event.eventType,
      payload: event.payload ?? {},
    });
    if (error) logger.error('log_event_failed', { message: error.message, callId, eventType: event.eventType });
  },

  async updateAiStatus(callId: string, aiStatus: 'ai_handled' | 'human_takeover' | 'transferred'): Promise<void> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { error } = await client.from('calls').update({ ai_status: aiStatus, updated_at: new Date().toISOString() }).eq('id', callId);
    if (error) throw new ApiError(500, 'db_error', 'Failed to update AI status.');
  },

  async isTerminal(callId: string): Promise<boolean> {
    const call = await this.getCall(callId);
    return isTerminal(call.status as CallState);
  },
};