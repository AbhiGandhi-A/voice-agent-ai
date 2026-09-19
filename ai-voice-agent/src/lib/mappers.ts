import {
  AISettings,
  Call,
  CallSettings,
  Contact,
  Conversation,
  Message,
  VoiceSettings,
} from '../types';
import {
  BackendCall,
  BackendContact,
  BackendConversation,
  BackendMessage,
  BackendSettings,
} from './api';
import { dateLabel, formatDuration, timeLabel, timeLabelSeconds } from './format';

export const DEFAULT_AI_SETTINGS: AISettings = {
  model: '',
  temperature: 0.7,
  maxTokens: 250,
  systemPrompt:
    'You are a friendly, natural, and concise voice AI assistant. Speak directly and conversationally as if talking on the phone. Keep responses clear and typically 1-3 sentences unless the user requests detailed explanations.',
  historyLimit: 20,
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  whisperModel: 'browser-native',
  whisperLanguage: 'English',
  ttsEngine: 'speechSynthesis',
  ttsVoice: 'Natural Default',
  speakingSpeed: 1.0,
  silenceThresholdMs: 900,
  autoDetectVad: true,
  autoWake: false,
  cameraEnabled: false,
};

export const DEFAULT_CALL_SETTINGS: CallSettings = {
  autoAnswer: true,
  aiGreeting: 'Hello, thank you for calling. I am your AI assistant. How may I assist you today?',
  maxCallDurationMinutes: 15,
  enableRecording: true,
  enableHumanTakeover: true,
  bargeInEnabled: true,
};

export function mapMessage(m: BackendMessage): Message {
  return {
    id: m.id,
    role: m.sender === 'assistant' || m.sender === 'agent' ? 'assistant' : m.sender === 'system' ? 'system' : 'user',
    content: m.content,
    timestamp: timeLabelSeconds(m.createdAt),
  };
}

export function mapConversationRow(c: BackendConversation): Conversation {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.startedAt,
    updatedAt: c.updatedAt,
    dateLabel: dateLabel(c.updatedAt),
    messageCount: c.messageCount,
    duration: undefined,
    type: c.type,
    status: c.status === 'active' ? 'active' : c.status === 'archived' ? 'archived' : 'completed',
    messages: [],
    summary: c.summary ?? undefined,
  };
}

const CALL_STATUS_MAP: Record<string, Call['status']> = {
  ended: 'completed',
  completed: 'completed',
  failed: 'failed',
  missed: 'missed',
  ringing: 'connected',
  connecting: 'connected',
  connected: 'connected',
  ai_active: 'connected',
  human_active: 'connected',
  on_hold: 'connected',
  transferring: 'connected',
  idle: 'connected',
};

const AI_STATUS_MAP: Record<string, Call['aiStatus']> = {
  ai_handled: 'AI handled',
  human_takeover: 'Human takeover',
  transferred: 'Transferred',
};

export function mapCall(c: BackendCall): Call {
  return {
    id: c.id,
    phoneNumber: c.phone_number,
    contactName: c.contact_name ?? c.phone_number,
    status: CALL_STATUS_MAP[c.status] ?? 'missed',
    duration: formatDuration(c.duration_seconds),
    aiStatus: AI_STATUS_MAP[c.ai_status] ?? 'AI handled',
    startedAt: timeLabel(c.created_at),
    date: dateLabel(c.created_at),
    recordingUrl: c.recording_url ?? undefined,
    messages: [],
  };
}

export function mapContact(c: BackendContact): Contact {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? '',
    company: c.company ?? '',
    notes: c.notes ?? '',
    lastCall: c.lastCall ?? '',
    callCount: c.callCount ?? 0,
  };
}

export function mapBackendSettings(s: BackendSettings): { ai: AISettings; voice: VoiceSettings; call: CallSettings } {
  return {
    ai: { ...DEFAULT_AI_SETTINGS, ...s.ai },
    voice: { ...DEFAULT_VOICE_SETTINGS, ...s.voice },
    call: { ...DEFAULT_CALL_SETTINGS, ...s.call },
  };
}