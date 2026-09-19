import { getAdminClient } from '../../db/supabase';
import { ApiError } from '../../middleware/error';
import { logger } from '../../utils/logger';

export interface CreateConversationInput {
  userId: string;
  contactId?: string;
  type?: 'web' | 'phone';
  title?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  type: 'web' | 'phone';
  status: string;
  startedAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string | null;
  summary: string | null;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  sender: 'user' | 'assistant' | 'agent' | 'system';
  content: string;
  messageType: string;
  metadata: unknown;
  createdAt: string;
}

const MESSAGES_PER_PAGE = 50;

export const conversationsService = {
  async create(input: CreateConversationInput): Promise<Record<string, unknown>> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    const { data, error } = await client
      .from('conversations')
      .insert({
        user_id: input.userId,
        contact_id: input.contactId ?? null,
        type: input.type ?? 'web',
        title: input.title ?? 'New Conversation',
      })
      .select('*')
      .single();

    if (error) throw new ApiError(500, 'db_error', 'Failed to create conversation.');
    return data;
  },

  async list(userId: string, params: { page: number; limit: number; search?: string; type?: string; status?: string }): Promise<{ total: number; conversations: ConversationSummary[]; page: number; limit: number }> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    let query = client
      .from('conversations')
      .select('id, title, type, status, started_at, updated_at, summary, messages(message_count)', { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (params.type) query = query.eq('type', params.type);
    if (params.status) query = query.eq('status', params.status);
    if (params.search) query = query.ilike('title', `%${params.search}%`);
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new ApiError(500, 'db_error', 'Failed to list conversations.');

    const conversations: ConversationSummary[] = (data ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      type: row.type as 'web' | 'phone',
      status: row.status as string,
      startedAt: row.started_at as string,
      updatedAt: row.updated_at as string,
      messageCount: Array.isArray(row.messages) ? row.messages.length : 0,
      lastMessage: null,
      summary: (row.summary as string) ?? null,
    }));

    return { total: count ?? 0, conversations, page, limit };
  },

  async getById(conversationId: string): Promise<Record<string, unknown>> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { data, error } = await client.from('conversations').select('*').eq('id', conversationId).maybeSingle();
    if (error || !data) throw new ApiError(404, 'not_found', 'Conversation not found.');
    return data;
  },

  async listMessages(conversationId: string, params: { page?: number } = {}): Promise<{ messages: MessageRecord[]; total: number }> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const page = Math.max(1, params.page ?? 1);
    const offset = (page - 1) * MESSAGES_PER_PAGE;

    const { data, error, count } = await client
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + MESSAGES_PER_PAGE - 1);

    if (error) throw new ApiError(500, 'db_error', 'Failed to load messages.');
    return {
      messages: (data ?? []).map((row) => ({
        id: row.id as string,
        conversationId: row.conversation_id as string,
        sender: row.sender as MessageRecord['sender'],
        content: row.content as string,
        messageType: row.message_type as string,
        metadata: row.metadata ?? null,
        createdAt: row.created_at as string,
      })),
      total: count ?? 0,
    };
  },

  /** Recent context messages used as the LLM conversation history. */
  async recentMessagesForContext(conversationId: string, limit = 20): Promise<Array<{ role: 'user' | 'assistant' | 'system' | 'agent'; content: string }>> {
    const client = getAdminClient();
    if (!client) return [];
    const { data } = await client
      .from('messages')
      .select('sender, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? [])
      .map((row) => ({ role: row.sender as 'user' | 'assistant' | 'system' | 'agent', content: row.content as string }))
      .reverse();
  },

  async addMessage(conversationId: string, sender: MessageRecord['sender'], content: string, extra: { messageType?: string; metadata?: unknown } = {}): Promise<MessageRecord> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    const { data, error } = await client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender,
        content,
        message_type: extra.messageType ?? 'text',
        metadata: extra.metadata ?? {},
      })
      .select('*')
      .single();

    if (error) {
      logger.error('add_message_failed', { message: error.message });
      throw new ApiError(500, 'db_error', 'Failed to save message.');
    }

    await client.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    return {
      id: data.id as string,
      conversationId: data.conversation_id as string,
      sender: data.sender as MessageRecord['sender'],
      content: data.content as string,
      messageType: data.message_type as string,
      metadata: data.metadata ?? null,
      createdAt: data.created_at as string,
    };
  },

  async delete(conversationId: string): Promise<void> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { error } = await client.from('conversations').delete().eq('id', conversationId);
    if (error) throw new ApiError(500, 'db_error', 'Failed to delete conversation.');
  },

  async archive(conversationId: string): Promise<void> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { error } = await client.from('conversations').update({ status: 'archived' }).eq('id', conversationId);
    if (error) throw new ApiError(500, 'db_error', 'Failed to archive conversation.');
  },
};