import { getAdminClient } from '../../db/supabase';
import { ApiError } from '../../middleware/error';

export interface CreateContactInput {
  userId: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  notes?: string;
}

export interface ContactRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  lastCall: string | null;
  callCount: number;
}

export const contactsService = {
  async create(input: CreateContactInput): Promise<ContactRecord> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    const { data, error } = await client
      .from('contacts')
      .insert({
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        company: input.company ?? null,
        notes: input.notes ?? null,
        created_by: input.userId,
      })
      .select('*')
      .single();

    if (error) throw new ApiError(500, 'db_error', 'Failed to create contact.');
    return this.toRecord(data);
  },

  async list(userId: string, params: { page: number; limit: number; search?: string }): Promise<{ total: number; contacts: ContactRecord[]; page: number; limit: number }> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    let query = client.from('contacts').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (params.search) {
      query = query.or(`name.ilike.%${params.search}%,phone.ilike.%${params.search}%,email.ilike.%${params.search}%,company.ilike.%${params.search}%`);
    }
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new ApiError(500, 'db_error', 'Failed to list contacts.');

    const contacts = (data ?? []).map((row) => this.toRecord(row));
    return { total: count ?? 0, contacts, page, limit };
  },

  async findById(id: string): Promise<ContactRecord> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { data, error } = await client.from('contacts').select('*').eq('id', id).maybeSingle();
    if (error || !data) throw new ApiError(404, 'not_found', 'Contact not found.');
    return this.toRecord(data);
  },

  async findByPhone(phone: string): Promise<ContactRecord | null> {
    const client = getAdminClient();
    if (!client) return null;
    const { data } = await client.from('contacts').select('*').eq('phone', phone).maybeSingle();
    return data ? this.toRecord(data) : null;
  },

  async update(id: string, patch: Partial<CreateContactInput>): Promise<ContactRecord> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { data, error } = await client.from('contacts').update(patch).eq('id', id).select('*').single();
    if (error) throw new ApiError(500, 'db_error', 'Failed to update contact.');
    return this.toRecord(data);
  },

  async delete(id: string): Promise<void> {
    const client = getAdminClient();
    if (!client) throw new ApiError(503, 'db_unavailable', 'Database connection failed.');
    const { error } = await client.from('contacts').delete().eq('id', id);
    if (error) throw new ApiError(500, 'db_error', 'Failed to delete contact.');
  },

  toRecord(row: Record<string, unknown>): ContactRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      phone: row.phone as string,
      email: (row.email as string) ?? null,
      company: (row.company as string) ?? null,
      notes: (row.notes as string) ?? null,
      lastCall: (row.updated_at as string) ?? null,
      callCount: 0,
    };
  },
};