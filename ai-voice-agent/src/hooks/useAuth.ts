import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChange, signIn as supabaseSignIn, signOutUser, signUp as supabaseSignUp, supabase } from '../lib/supabase';
import { refreshApiToken } from '../lib/api';

export interface AuthUser {
  id: string;
  email?: string;
  role: string;
  fullName: string | null;
}

export interface AuthState {
  loading: boolean;
  hasSession: boolean;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;

    const sync = async () => {
      if (!supabase) {
        if (active) {
          setHasSession(false);
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const session = data.session;
      setHasSession(Boolean(session));
      await refreshApiToken();

      if (session) {
        try {
          const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${session.access_token}` } });
          if (res.ok) {
            const body = (await res.json()) as { user: AuthUser };
            setUser(body.user);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    void sync();

    const unsubscribe = onAuthStateChange(() => {
      void sync();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await supabaseSignIn(email.trim(), password);
    if (!result.error) await refreshApiToken();
    return result;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    return await supabaseSignUp(email.trim(), password);
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    await refreshApiToken();
    setUser(null);
    setHasSession(false);
  }, []);

  return { loading, hasSession, user, signIn, signUp, signOut };
}