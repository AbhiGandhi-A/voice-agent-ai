export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'thinking'
  | 'speaking'
  | 'ended'
  | 'error';

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connected'
  | 'on_hold'
  | 'ended'
  | 'missed';

export type ControlMode = 'ai' | 'human';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  audioUrl?: string;
  duration?: number;
  toolCall?: {
    name: string;
    status: 'calling' | 'completed' | 'failed';
    args?: Record<string, unknown>;
    result?: string;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  dateLabel: string;
  messageCount: number;
  duration?: string;
  type: 'web' | 'phone';
  status: 'completed' | 'active' | 'archived';
  messages: Message[];
  summary?: string;
}

export interface Call {
  id: string;
  phoneNumber: string;
  contactName: string;
  status: 'completed' | 'connected' | 'missed' | 'failed';
  duration: string;
  aiStatus: 'AI handled' | 'Human takeover' | 'Transferred';
  startedAt: string;
  date: string;
  recordingUrl?: string;
  summary?: CallSummary;
  messages: Message[];
}

export interface CallSummary {
  customer: string;
  duration: string;
  summary: string;
  outcome: 'Resolved' | 'Escalated' | 'Follow-up Needed';
  aiActions: string[];
  customerIntent: string;
  followUpRequired: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
  lastCall: string;
  callCount: number;
}

export interface AISettings {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  historyLimit: number;
}

export interface VoiceSettings {
  whisperModel: string;
  whisperLanguage: string;
  ttsEngine: string;
  ttsVoice: string;
  speakingSpeed: number;
  silenceThresholdMs: number;
  autoDetectVad: boolean;
  autoWake: boolean;
  cameraEnabled: boolean;
  faceAnalysisEnabled: boolean;
}

export interface VisionState {
  available: boolean;
  cameraActive: boolean;
  faceDetected: boolean;
  faceCount: number;
  expression: string;
  confidence: number;
  landmarksDetected: boolean;
  handDetected?: boolean;
  handCount?: number;
  fingerCount?: number;
  fingers?: Record<string, boolean>;
  hands?: Array<{ handIndex: number; fingerCount: number; fingers: Record<string, boolean>; confidence: number }>;
  fingerConfidence?: number;
  timestamp?: string;
  processingTimeMs?: number;
}

export interface CallSettings {
  autoAnswer: boolean;
  aiGreeting: string;
  maxCallDurationMinutes: number;
  enableRecording: boolean;
  enableHumanTakeover: boolean;
  bargeInEnabled: boolean;
}

export interface SystemConfig {
  aiServerUrl: string;
  wsUrl: string;
  apiKey: string;
  allowedOrigins: string;
  mockMode: boolean;
}

export interface ServiceHealth {
  name: string;
  status: 'connected' | 'ready' | 'disconnected' | 'error' | 'not_configured';
  latencyMs?: number;
  version?: string;
  details: string;
}

export interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  latency: string;
  details: string;
}

