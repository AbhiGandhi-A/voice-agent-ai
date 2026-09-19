import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

/**
 * Browser-side Supabase client. Used for authentication and realtime
 * subscriptions only. All CRUD goes through the Node API which validates the
 * session token server-side (the service role key never reaches the browser).
 */
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

export const supabaseConfigured = Boolean(supabase);

export async function isSupabaseReady(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.access_token);
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

export async function signUp(email: string, password: string, emailRedirectTo?: string): Promise<{ error?: string; needsConfirmation?: boolean }> {
  if (!supabase) return { error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Deliver the confirmation back to THIS app (not the bare Supabase Site
      // URL). supabase-js then auto-confirms and signs the user in via the
      // `#access_token` fragment (detectSessionInUrl). This must match a URL in
      // Supabase Dashboard > Auth > URL Configuration > Redirect URLs.
      emailRedirectTo: emailRedirectTo ?? authRedirectUrl(),
    },
  });
  if (error) return { error: error.message };
  const needsConfirmation = !data.session;
  return { needsConfirmation };
}

/**
 * The URL the email confirmation link redirects to. Defaults to wherever the
 * user is running the app right now, so the flow works on localhost and on a
 * hosted deployment alike. Override for a fixed public app URL.
 */
export function authRedirectUrl(): string {
  const configured = (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)?.trim();
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}/`;
  return '';
}

export async function signOutUser(): Promise<void> {
  await supabase?.auth.signOut();
}

export function onAuthStateChange(callback: (hasSession: boolean) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(Boolean(session));
  });
  return () => data.subscription.unsubscribe();
}