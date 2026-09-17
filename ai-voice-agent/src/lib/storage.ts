import { Conversation, Call, Contact, AISettings, VoiceSettings, CallSettings, SystemConfig } from '../types';

const STORAGE_KEYS = {
  CONVERSATIONS: 'ai_voice_agent_conversations',
  CALLS: 'ai_voice_agent_calls',
  CONTACTS: 'ai_voice_agent_contacts',
  SETTINGS_AI: 'ai_voice_agent_settings_ai',
  SETTINGS_VOICE: 'ai_voice_agent_settings_voice',
  SETTINGS_CALL: 'ai_voice_agent_settings_call',
  SETTINGS_SYSTEM: 'ai_voice_agent_settings_system',
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 250,
  systemPrompt:
    'You are a friendly, natural, and concise voice AI assistant. Speak directly and conversationally as if talking on the phone. Keep responses clear and typically 1-3 sentences unless the user requests detailed explanations.',
  historyLimit: 20,
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  whisperModel: 'browser-native',
  whisperLanguage: 'en-US',
  ttsEngine: 'speechSynthesis',
  ttsVoice: 'Natural Default',
  speakingSpeed: 1.0,
  silenceThresholdMs: 900,
  autoDetectVad: true,
};

export const DEFAULT_CALL_SETTINGS: CallSettings = {
  autoAnswer: true,
  aiGreeting: 'Hello, thank you for calling. I am your AI assistant. How may I assist you today?',
  maxCallDurationMinutes: 15,
  enableRecording: true,
  enableHumanTakeover: true,
  bargeInEnabled: true,
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  aiServerUrl: '/api',
  wsUrl: '/ws/voice',
  apiKey: '',
  allowedOrigins: '*',
  mockMode: false,
};

export const StorageService = {
  getConversations(): Conversation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveConversations(conversations: Conversation[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch (e) {
      console.warn('Failed to persist conversations:', e);
    }
  },

  getCalls(): Call[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CALLS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCalls(calls: Call[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CALLS, JSON.stringify(calls));
    } catch (e) {
      console.warn('Failed to persist calls:', e);
    }
  },

  getContacts(): Contact[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONTACTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveContacts(contacts: Contact[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    } catch (e) {
      console.warn('Failed to persist contacts:', e);
    }
  },

  getAiSettings(): AISettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS_AI);
      return data ? { ...DEFAULT_AI_SETTINGS, ...JSON.parse(data) } : DEFAULT_AI_SETTINGS;
    } catch {
      return DEFAULT_AI_SETTINGS;
    }
  },

  saveAiSettings(settings: AISettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS_AI, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to persist AI settings:', e);
    }
  },

  getVoiceSettings(): VoiceSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS_VOICE);
      return data ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(data) } : DEFAULT_VOICE_SETTINGS;
    } catch {
      return DEFAULT_VOICE_SETTINGS;
    }
  },

  saveVoiceSettings(settings: VoiceSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS_VOICE, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to persist voice settings:', e);
    }
  },

  getCallSettings(): CallSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS_CALL);
      return data ? { ...DEFAULT_CALL_SETTINGS, ...JSON.parse(data) } : DEFAULT_CALL_SETTINGS;
    } catch {
      return DEFAULT_CALL_SETTINGS;
    }
  },

  saveCallSettings(settings: CallSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS_CALL, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to persist call settings:', e);
    }
  },

  getSystemConfig(): SystemConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS_SYSTEM);
      return data ? { ...DEFAULT_SYSTEM_CONFIG, ...JSON.parse(data) } : DEFAULT_SYSTEM_CONFIG;
    } catch {
      return DEFAULT_SYSTEM_CONFIG;
    }
  },

  saveSystemConfig(config: SystemConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS_SYSTEM, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to persist system config:', e);
    }
  },
};
