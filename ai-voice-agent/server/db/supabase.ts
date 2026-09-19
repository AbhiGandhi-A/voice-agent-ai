import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Server-side Supabase client. Uses the service role key for privileged
 * operations (telephony orchestration, summaries, recordings). The service
 * role key is kept strictly server-side; it is never exposed to the browser.
 */
let adminClient: SupabaseClient | null = null;
let adminClientInitAttempted = false;

export function getAdminClient(): SupabaseClient | null {
  if (adminClientInitAttempted) return adminClient;
  adminClientInitAttempted = true;

  if (!isSupabaseConfigured()) {
    logger.warn('Supabase not configured — database features disabled.');
    return null;
  }

  adminClient = createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}

export async function supabasePing(): Promise<boolean> {
  const client = getAdminClient();
  if (!client) return false;
  const { error } = await client.from('profiles').select('id').limit(1);
  return !error;
}

export interface VerifiedUser {
  id: string;
  email: string | undefined;
  role: string;
  fullName: string | null;
}

// Small TTL cache to avoid pounding the Supabase auth endpoint per request.
const userCache = new Map<string, { user: VerifiedUser; expiresAt: number }>();
const USER_CACHE_TTL_MS = 60_000;

export async function verifyUserToken(token: string): Promise<VerifiedUser | null> {
  const cached = userCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const client = getAdminClient();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;

    const { data: profile } = await client
      .from('profiles')
      .select('id, full_name, role, email')
      .eq('id', data.user.id)
      .maybeSingle();

    const user: VerifiedUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: profile?.role ?? 'agent',
      fullName: profile?.full_name ?? null,
    };
    userCache.set(token, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    return user;
  } catch (err) {
    logger.error('Failed to verify user token', { message: err instanceof Error ? err.message : 'unknown' });
    return null;
  }
}