import { FormEvent, useState } from 'react';
import { Mic, Lock, Mail, Loader2, AlertTriangle } from 'lucide-react';
import { supabaseConfigured } from '../lib/supabase';

interface AuthScreenProps {
  loading: boolean;
  onSignIn: (email: string, password: string) => Promise<{ error?: string }>;
  onSignUp: (email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
}

export const AuthScreen = ({ loading, onSignIn, onSignUp }: AuthScreenProps) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === 'signin') {
      const res = await onSignIn(email, password);
      if (res.error) setError(res.error);
    } else {
      const res = await onSignUp(email, password);
      if (res.error) setError(res.error);
      else if (res.needsConfirmation) setInfo('Account created — check your email to confirm, then sign in.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen font-sans flex bg-[#050811] text-slate-100 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 backdrop-blur-xl p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50"
            >
              <Mic className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">AI Voice Agent</h1>
              <p className="text-xs text-slate-400">Local LLM · STT · TTS call center</p>
            </div>
          </div>

          {!supabaseConfigured && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Supabase is not configured. Set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>, then run <code className="font-mono">npm run db:diag</code>.
              </span>
            </div>
          )}

          {info && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300">
              {info}
            </div>
          )}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs">Checking session…</span>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Email</span>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[#050811] border border-slate-800 rounded-xl focus-within:border-indigo-500 transition-colors">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none"
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Password</span>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[#050811] border border-slate-800 rounded-xl focus-within:border-indigo-500 transition-colors">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="mt-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow cursor-pointer transition-colors"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
              >
                {mode === 'signin' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-[11px] text-slate-600 mt-4">
          Powered by local Ollama models, Whisper STT, Piper/Kokoro TTS, and Supabase.
        </p>
      </div>
    </div>
  );
};

export const AuthLoadingScreen = () => (
  <div className="min-h-screen font-sans flex bg-[#050811] text-slate-400 items-center justify-center">
    <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
  </div>
);