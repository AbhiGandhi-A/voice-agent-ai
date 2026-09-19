import dotenv from 'dotenv';

dotenv.config();

function required(name: string, opts: { optional?: boolean; defaultValue?: string } = {}): string {
  const value = process.env[name];
  if (value !== undefined && value !== '') return value;
  if (opts.optional || opts.defaultValue !== undefined) return opts.defaultValue ?? '';
  throw new Error(`Missing required environment variable: ${name}`);
}

function bool(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

function int(name: string, defaultValue: number): number {
  const value = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : defaultValue;
}

export const env = {
  nodeEnv: required('NODE_ENV', { defaultValue: 'development' }),
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  port: int('PORT', 3000),
  appUrl: required('APP_URL', { defaultValue: 'http://localhost:3000' }),
  corsOrigin: required('CORS_ORIGIN', { defaultValue: '*' }).split(',').map((s) => s.trim()).filter(Boolean),
  requestBodyLimitMb: int('REQUEST_BODY_LIMIT_MB', 1),

  supabaseUrl: required('SUPABASE_URL', { optional: true }),
  supabaseAnonKey: required('SUPABASE_ANON_KEY', { optional: true }),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', { optional: true }),

  ollamaBaseUrl: required('OLLAMA_BASE_URL', { defaultValue: 'http://127.0.0.1:11434' }),
  ollamaModel: required('OLLAMA_MODEL', { optional: true }),
  ollamaTimeoutMs: int('OLLAMA_TIMEOUT_MS', 30000),

  sttProvider: required('STT_PROVIDER', { defaultValue: 'browser' }),
  sttLanguage: required('STT_LANGUAGE', { defaultValue: 'en-US' }),
  sttApiKey: required('STT_API_KEY', { optional: true }),
  sttModel: required('STT_MODEL', { defaultValue: 'small' }),
  whisperServerUrl: required('WHISPER_SERVER_URL', { defaultValue: 'http://127.0.0.1:8000' }),

  ttsProvider: required('TTS_PROVIDER', { defaultValue: 'browser' }),
  ttsApiKey: required('TTS_API_KEY', { optional: true }),
  ttsVoice: required('TTS_VOICE', { defaultValue: 'en_US-amy' }),
  piperServerUrl: required('PIPER_SERVER_URL', { defaultValue: 'http://127.0.0.1:5000' }),

  telephonyProvider: required('TELEPHONY_PROVIDER', { defaultValue: 'none' }),
  telephonyAccountId: required('TELEPHONY_ACCOUNT_ID', { optional: true }),
  telephonyAuthToken: required('TELEPHONY_AUTH_TOKEN', { optional: true }),
  telephonyPhoneNumber: required('TELEPHONY_PHONE_NUMBER', { optional: true }),
  telephonyWebhookSecret: required('TELEPHONY_WEBHOOK_SECRET', { optional: true }),

  jwtSecret: required('JWT_SECRET', { defaultValue: 'dev-only-insecure-secret-change-me' }),
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceRoleKey);
}

export function isTelephonyConfigured(): boolean {
  return (
    env.telephonyProvider !== 'none' &&
    Boolean(env.telephonyAccountId && env.telephonyAuthToken && env.telephonyPhoneNumber)
  );
}

export type ServerEnv = typeof env;