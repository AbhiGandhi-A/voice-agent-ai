import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Base URL for the backend API.
 * - Local dev: leave unset (same origin) or set `VITE_API_BASE_URL=http://localhost:3000`.
 * - Vercel production: set `VITE_API_BASE_URL=https://<public-backend-url>` at build time.
 * Never hardcode `localhost` in a production bundle — Vercel supplies this var.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? '').replace(/\/+$/, '');

let currentToken = '';

export function setApiToken(token: string | null): void {
  currentToken = token ?? '';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;

  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = data as { error?: string; code?: string } | null;
    throw new ApiError(res.status, err?.code ?? 'api_error', err?.error ?? `Request failed (${res.status}).`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** Syncs the API token with the Supabase session (call after every auth change). */
export async function refreshApiToken(): Promise<void> {
  if (!supabase) {
    setApiToken(null);
    return;
  }
  const { data } = await supabase.auth.getSession();
  setApiToken(data.session?.access_token ?? null);
}

// ─── Health & telemetry ────────────────────────────────────────────────
export interface HealthResponse {
  status: string;
  uptimeSeconds: number;
  database: { connected: boolean; provider: string };
  ai: { available: boolean; provider: string; baseUrl: string; status: string; model?: string };
  vision?: { available: boolean; provider: string; status: string; model: string; device: string };
  stt: { provider: string; status: string; details: string };
  tts: { provider: string; status: string; details: string };
  telephony: { configured: boolean; details: string };
}

export const fetchHealth = () => api.get<HealthResponse>('/health');

// ─── Vision ────────────────────────────────────────────────────────────
export interface VisionAnalysisResponse {
  faceDetected: boolean;
  faceCount: number;
  expression: string;
  confidence: number;
  landmarksDetected: boolean;
  timestamp: string;
  processingTimeMs: number;
  allExpressions?: Record<string, number>;
  available?: boolean;
}

export const sendVisionFrame = (image: string, cameraActive = true) =>
  api.post<VisionAnalysisResponse>('/vision/frame', { image, cameraActive });

export const fetchVisionStatus = () =>
  api.get<{ health: { status: string; available: boolean; model: string }; latestState: VisionAnalysisResponse }>('/vision/status');

export const notifyCameraState = (cameraActive: boolean) =>
  api.post<{ ok: boolean; cameraActive: boolean }>('/vision/camera-state', { cameraActive });


// ─── Auth / profile ────────────────────────────────────────────────────
export interface CurrentUser {
  id: string;
  email?: string;
  role: string;
  fullName: string | null;
}

export const fetchMe = () => api.get<{ user: CurrentUser; supabaseConfigured: boolean }>('/auth/me');

// ─── AI / Ollama ───────────────────────────────────────────────────────
export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest?: string;
  modified_at?: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

export interface ChatResult {
  reply: string;
  model: string;
  latencyMs: number;
  conversationId: string;
  messageId: string;
  source: string;
}

export const fetchAiStatus = () => api.get<{ available: boolean; model: string }>('/ai/status');
export const fetchModels = () => api.get<{ available: boolean; count: number; models: OllamaModel[] }>('/ai/models');
export const pullModel = (name: string) => api.post(`/ai/models/${encodeURIComponent(name)}/pull`);
export const deleteModel = (name: string) => api.delete(`/ai/models/${encodeURIComponent(name)}`);
export interface RuntimeContext {
  currentTime: string;
  timezone: string;
  localDateTime: string;
}

export const sendChat = (payload: { message: string; conversationId?: string; contactId?: string; runtimeContext?: RuntimeContext; language?: string }) => api.post<ChatResult>('/ai/chat', payload);

export interface MemoryRecord {
  id: string;
  userId: string;
  memory: string;
  category: string | null;
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export const listMemories = () => api.get<{ memories: MemoryRecord[] }>('/memories');
export const createMemory = (memory: { memory: string; category?: string; importance?: number }) => api.post<{ memory: MemoryRecord }>('/memories', memory);
export const updateMemory = (id: string, memory: Partial<{ memory: string; category: string; importance: number }>) => api.patch<{ memory: MemoryRecord }>(`/memories/${id}`, memory);
export const deleteMemory = (id: string) => api.delete<{ ok: boolean }>(`/memories/${id}`);

// ─── Contacts ──────────────────────────────────────────────────────────
export interface BackendContact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  lastCall: string | null;
  callCount: number;
}

export const listContacts = () => api.get<{ contacts: BackendContact[]; total: number }>('/contacts');
export const createContact = (c: { name: string; phone: string; email?: string; company?: string; notes?: string }) => api.post('/contacts', c);
export const updateContact = (id: string, c: Partial<{ name: string; phone: string; email: string; company: string; notes: string }>) => api.put(`/contacts/${id}`, c);
export const deleteContact = (id: string) => api.delete(`/contacts/${id}`);

// ─── Conversations ─────────────────────────────────────────────────────
export interface BackendConversation {
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

export interface BackendMessage {
  id: string;
  conversationId: string;
  sender: 'user' | 'assistant' | 'agent' | 'system';
  content: string;
  messageType: string;
  metadata: unknown;
  createdAt: string;
}

export const listConversations = () => api.get<{ conversations: BackendConversation[]; total: number }>('/conversations');
export const createConversation = () => api.post('/conversations', {});
export const getConversation = (id: string) => api.get<BackendConversation>(`/conversations/${id}`);
export const listMessages = (convId: string) => api.get<{ messages: BackendMessage[]; total: number }>(`/conversations/${convId}/messages`);
export const deleteConversation = (id: string) => api.delete(`/conversations/${id}`);

// ─── Calls ─────────────────────────────────────────────────────────────
export interface BackendCall {
  id: string;
  user_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  contact_name: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  status: string;
  ai_status: string;
  provider: string;
  provider_call_id: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export const listCalls = () => api.get<{ calls: BackendCall[]; total: number }>('/calls');
export const getCall = (id: string) => api.get<BackendCall & { messages: BackendMessage[] }>(`/calls/${id}`);
export const startOutboundCall = (phoneNumber: string, contactId?: string) => api.post<{ call: BackendCall }>('/calls/outbound', { phoneNumber, contactId });
export const hangupCall = (id: string) => api.post(`/calls/${id}/hangup`);
export const setCallStatus = (id: string, status: string) => api.patch(`/calls/${id}/status`, { status });
export const holdCall = (id: string, hold: boolean) => api.post(`/calls/${id}/hold`, { hold });
export const transferCall = (id: string, to: string) => api.post(`/calls/${id}/transfer`, { to });
export const summarizeCall = (id: string) => api.post<{ summary: unknown }>(`/calls/${id}/summary`);

// ─── Analytics ─────────────────────────────────────────────────────────
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

export const fetchAnalytics = () => api.get<CallAnalytics>('/analytics/calls');
export const fetchTrend = (bucket = 'day') => api.get<Array<{ label: string; count: number }>>(`/analytics/trend?bucket=${bucket}`);

// ─── Settings ──────────────────────────────────────────────────────────
export interface BackendSettings {
  ai: { model: string; temperature: number; maxTokens: number; systemPrompt: string; historyLimit: number };
  voice: { whisperModel: string; whisperLanguage: string; ttsEngine: string; ttsVoice: string; speakingSpeed: number; silenceThresholdMs: number; autoDetectVad: boolean; autoWake: boolean; cameraEnabled: boolean };
  call: { autoAnswer: boolean; aiGreeting: string; maxCallDurationMinutes: number; enableRecording: boolean; enableHumanTakeover: boolean; bargeInEnabled: boolean };
}

export const fetchSettings = () => api.get<{ settings: BackendSettings; defaults: BackendSettings }>('/settings');
export const saveSettings = (settings: BackendSettings) => api.put('/settings', { settings });

// ─── Telephony ─────────────────────────────────────────────────────────
export const fetchTelephonyStatus = () => api.get<{ provider: string; configured: boolean; details: string }>('/telephony/status');