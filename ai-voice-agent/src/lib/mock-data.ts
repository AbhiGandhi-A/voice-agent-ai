import {
  Call,
  Contact,
  Conversation,
  Message,
  ServiceStatus,
  AISettings,
  VoiceSettings,
  CallSettings,
  SystemConfig,
} from '../types';

export const INITIAL_MESSAGES: Message[] = [];

export const INITIAL_CONVERSATIONS: Conversation[] = [];

export const INITIAL_CALLS: Call[] = [];

export const INITIAL_CONTACTS: Contact[] = [];

export const INITIAL_SERVICES: ServiceStatus[] = [
  {
    name: 'Gemini AI Engine',
    status: 'online',
    details: 'Server-side gemini-2.5-flash conversational inference via @google/genai',
    latency: 'Real-time',
  },
  {
    name: 'Web Speech API (STT)',
    status: 'online',
    details: 'Browser native SpeechRecognition streaming speech-to-text',
    latency: 'Sub-30ms',
  },
  {
    name: 'Neural Speech Synthesis (TTS)',
    status: 'online',
    details: 'Hardware-accelerated SpeechSynthesis voice output engine',
    latency: 'Zero buffer',
  },
  {
    name: 'Web Audio API Analyser',
    status: 'online',
    details: 'Real-time microphone input level analyzer and VAD processor',
    latency: 'Real-time',
  },
  {
    name: 'Local Storage Persistence',
    status: 'online',
    details: 'Browser persistent database for conversations, contacts, and calls',
    latency: '< 1 ms',
  },
  {
    name: 'Voice Agent HTTP Backend',
    status: 'online',
    details: 'Express API router (/api/chat, /api/health, /api/summarize)',
    latency: 'Local',
  },
];

export const INITIAL_SETTINGS: {
  ai: AISettings;
  voice: VoiceSettings;
  call: CallSettings;
  system: SystemConfig;
} = {
  ai: {
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 250,
    systemPrompt:
      'You are a friendly, natural, and concise voice AI assistant. Speak directly and conversationally as if talking on the phone. Keep responses to 1-3 sentences unless asked for detail. Support the user with queries, scheduling, and business workflows.',
    historyLimit: 20,
  },
  voice: {
    whisperModel: 'browser-native',
    whisperLanguage: 'en-US',
    ttsEngine: 'speechSynthesis',
    ttsVoice: 'Natural Default',
    speakingSpeed: 1.0,
    silenceThresholdMs: 900,
    autoDetectVad: true,
  },
  call: {
    autoAnswer: true,
    aiGreeting: 'Hello, thank you for calling. I am your AI assistant. How may I assist you today?',
    maxCallDurationMinutes: 15,
    enableRecording: true,
    enableHumanTakeover: true,
    bargeInEnabled: true,
  },
  system: {
    aiServerUrl: '/api',
    wsUrl: '/ws/voice',
    apiKey: '',
    allowedOrigins: '*',
    mockMode: false,
  },
};
