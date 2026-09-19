import { getAdminClient } from '../../db/supabase';
import { ApiError } from '../../middleware/error';

export interface MemoryRecord {
  id: string;
  userId: string;
  memory: string;
  category: string | null;
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  memory: string;
  category?: string;
  importance?: number;
}

const SECRET_PATTERN = /(password|passcode|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|private[_ -]?key|credit card|cvv|social security|supabase_service_role)/i;

function requireClient() {
  const client = getAdminClient();
  if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
  return client;
}

function mapRow(row: Record<string, unknown>): MemoryRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    memory: row.memory as string,
    category: (row.category as string | null) ?? null,
    importance: Number(row.importance ?? 1),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function validateMemoryText(memory: string): string {
  const trimmed = memory.trim();
  if (!trimmed || trimmed.length > 2000) throw new ApiError(400, 'invalid_memory', 'Memory must be between 1 and 2000 characters.');
  if (SECRET_PATTERN.test(trimmed)) throw new ApiError(400, 'memory_secret_rejected', 'I cannot store passwords, tokens, keys, or financial credentials as memory.');
  return trimmed;
}

export const memoriesService = {
  async list(userId: string): Promise<MemoryRecord[]> {
    const { data, error } = await requireClient()
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw new ApiError(500, 'db_error', 'Failed to load memories.');
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  },

  async create(userId: string, input: CreateMemoryInput): Promise<MemoryRecord> {
    const memory = validateMemoryText(input.memory);
    const importance = Math.min(5, Math.max(1, Math.round(input.importance ?? 1)));
    const { data, error } = await requireClient()
      .from('memories')
      .insert({ user_id: userId, memory, category: input.category?.trim() || null, importance })
      .select('*')
      .single();
    if (error || !data) throw new ApiError(500, 'db_error', 'Failed to save memory.');
    return mapRow(data as Record<string, unknown>);
  },

  async update(userId: string, id: string, input: Partial<CreateMemoryInput>): Promise<MemoryRecord> {
    const patch: Record<string, unknown> = {};
    if (input.memory !== undefined) patch.memory = validateMemoryText(input.memory);
    if (input.category !== undefined) patch.category = input.category.trim() || null;
    if (input.importance !== undefined) patch.importance = Math.min(5, Math.max(1, Math.round(input.importance)));
    if (Object.keys(patch).length === 0) throw new ApiError(400, 'invalid_memory', 'No memory changes supplied.');
    const { data, error } = await requireClient()
      .from('memories')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    if (error) throw new ApiError(500, 'db_error', 'Failed to update memory.');
    if (!data) throw new ApiError(404, 'not_found', 'Memory not found.');
    return mapRow(data as Record<string, unknown>);
  },

  async remove(userId: string, id: string): Promise<void> {
    const { data, error } = await requireClient()
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');
    if (error) throw new ApiError(500, 'db_error', 'Failed to delete memory.');
    if (!data || data.length === 0) throw new ApiError(404, 'not_found', 'Memory not found.');
  },

  async relevant(userId: string, query: string, limit = 12, keywordOnly = false): Promise<MemoryRecord[]> {
    let memories: MemoryRecord[];
    try {
      memories = await this.list(userId);
    } catch {
      // Keep existing chat usable while a deployment is waiting for migration 0002.
      return [];
    }
    const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
    return memories
      .map((item, index) => {
        const haystack = item.memory.toLowerCase();
        const matches = terms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0);
        return { item, matches, score: matches * 10 + item.importance * 2 - index * 0.001 };
      })
      .filter(({ score, matches }) => score > 0 && (!keywordOnly || matches > 0))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);
  },
};

export { validateMemoryText };
