import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AISettings,
  Call,
  CallSettings,
  CallSummary,
  Contact,
  Conversation,
  Message,
  ServiceStatus,
  VoiceSettings,
} from '../types';
import {
  BackendCall,
  BackendContact,
  BackendSettings,
  ApiError,
  fetchHealth,
  fetchSettings,
  hangupCall as apiHangupCall,
  listCalls as apiListCalls,
  listContacts as apiListContacts,
  listConversations as apiListConversations,
  listMessages as apiListMessages,
  deleteConversation as apiDeleteConversation,
  createContact as apiCreateContact,
  deleteContact as apiDeleteContact,
  HealthResponse,
  saveSettings,
  sendChat as apiSendChat,
  startOutboundCall as apiStartOutboundCall,
  summarizeCall as apiSummarizeCall,
} from '../lib/api';
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_CALL_SETTINGS,
  DEFAULT_VOICE_SETTINGS,
  mapBackendSettings,
  mapCall,
  mapContact,
  mapConversationRow,
  mapMessage,
} from '../lib/mappers';
import { API_BASE_URL } from '../lib/api';
import { dateLabel, timeLabelSeconds } from '../lib/format';

export interface SystemConfigUi {
  aiServerUrl: string;
  wsUrl: string;
  apiKey: string;
  allowedOrigins: string;
  mockMode: boolean;
}

const DEFAULT_SYSTEM_CONFIG: SystemConfigUi = {
  aiServerUrl: API_BASE_URL || '/api',
  wsUrl: '',
  apiKey: '',
  allowedOrigins: '*',
  mockMode: false,
};

export const CONV_PLACEHOLDER_ID = 'conv-active';

function serviceRow(name: string, online: boolean, details: string, latency = 'Local'): ServiceStatus {
  return { name, status: online ? 'online' : 'offline', latency, details };
}

function mapHealth(health: HealthResponse): ServiceStatus[] {
  const sttOk = health.stt && health.stt.status !== 'disconnected' && health.stt.status !== 'not_configured';
  const ttsOk = health.tts && health.tts.status !== 'disconnected' && health.tts.status !== 'not_configured';

  return [
    serviceRow(
      'Ollama AI Engine',
      Boolean(health.ai?.available),
      health.ai
        ? `Local ${health.ai.provider} inference at ${health.ai.baseUrl} (${health.ai.status})`
        : 'Ollama not reachable — start the server (see docs).',
      'Real-time'
    ),
    serviceRow('Supabase Database', health.database.connected, `Postgres-backed persistence via ${health.database.provider}`, '< 1 ms'),
    serviceRow('Speech-to-Text (STT)', sttOk, health.stt?.details ?? '—', 'Real-time'),
    serviceRow('Text-to-Speech (TTS)', ttsOk, health.tts?.details ?? '—', 'Zero buffer'),
    serviceRow('Telephony Provider', health.telephony.configured, health.telephony.details, 'Live'),
    serviceRow('Voice Agent HTTP Backend', health.status === 'ok', `Express API server (uptime ${Math.floor(health.uptimeSeconds || 0)}s)`, 'Local'),
  ];
}

function newMsg(role: Message['role'], content: string): Message {
  return { id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content, timestamp: timeLabelSeconds(new Date().toISOString()) };
}

function blankConversation(id: string, title: string, messages: Message[] = []): Conversation {
  const now = new Date().toISOString();
  return {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    dateLabel: 'Today',
    messageCount: messages.length,
    duration: '00:00',
    type: 'web',
    status: 'active',
    messages,
  };
}

export interface AppData {
  // data
  conversations: Conversation[];
  currentConversation: Conversation;
  calls: Call[];
  activeLiveCall: Call | null;
  contacts: Contact[];
  aiSettings: AISettings;
  voiceSettings: VoiceSettings;
  callSettings: CallSettings;
  systemConfig: SystemConfigUi;
  services: ServiceStatus[];
  connectionStatus: 'Connected' | 'Connecting' | 'Disconnected' | 'Error';
  loading: boolean;

  // navigation
  selectConversation: (id: string) => void;

  // conversation actions
  deleteConversation: (id: string) => void;
  refreshConversations: () => Promise<void>;

  // voice / web chat
  handleSendMessage: (text: string) => Promise<string | undefined>;
  appendAiReply: (text: string) => Promise<void>;
  getConversationIdForChat: () => string | null;

  // telephony
  handleStartCall: (phoneNumber: string) => Promise<void>;
  handleEndCall: (callId: string, durationStr: string) => Promise<void>;
  handleLiveCallSendMessage: (text: string) => Promise<void>;

  // contacts
  handleAddContact: (contact: { name: string; phone: string; email?: string; company?: string; notes?: string }) => Promise<void>;
  handleDeleteContact: (id: string) => Promise<void>;

  // settings
  onSaveAiSettings: (s: AISettings) => Promise<void>;
  onSaveVoiceSettings: (s: VoiceSettings) => Promise<void>;
  onSaveCallSettings: (s: CallSettings) => Promise<void>;

  // system
  onRefreshServices: () => Promise<void>;
}

export function useAppData(enabled = true): AppData {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string>(CONV_PLACEHOLDER_ID);
  const [placeholderMessages, setPlaceholderMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [activeLiveCall, setActiveLiveCall] = useState<Call | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [callSettings, setCallSettings] = useState<CallSettings>(DEFAULT_CALL_SETTINGS);
  const [systemConfig, setSystemConfig] = useState<SystemConfigUi>(DEFAULT_SYSTEM_CONFIG);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'Connected' | 'Connecting' | 'Disconnected' | 'Error'>('Connecting');
  const [loading, setLoading] = useState(true);
  const liveCallIdRef = useRef<string | null>(null);
  const sessionConvIdRef = useRef<string>(CONV_PLACEHOLDER_ID);

  const currentConversation: Conversation = (() => {
    if (currentConvId === CONV_PLACEHOLDER_ID) {
      return blankConversation(CONV_PLACEHOLDER_ID, 'Voice Conversation', placeholderMessages);
    }
    return conversations.find((c) => c.id === currentConvId) ?? blankConversation(currentConvId, 'Voice Conversation', []);
  })();

  // Reset all data when the hook is disabled (e.g. after sign-out) so a
  // different user never observes the previous session's state.
  useEffect(() => {
    if (enabled) return;
    setConversations([]);
    setCalls([]);
    setContacts([]);
    setServices([]);
    setPlaceholderMessages([]);
    sessionConvIdRef.current = CONV_PLACEHOLDER_ID;
    setCurrentConvId(CONV_PLACEHOLDER_ID);
    setConnectionStatus('Connecting');
    setLoading(true);
  }, [enabled]);

  // ── initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      try {
        const [convRes, callsRes, contactsRes, settingsRes, health] = await Promise.all([
          apiListConversations(),
          apiListCalls(),
          apiListContacts(),
          fetchSettings(),
          fetchHealth(),
        ]);
        if (!active) return;

        const convs = convRes.conversations.map(mapConversationRow);
        setConversations(convs);
        if (convs.length > 0 && sessionConvIdRef.current === CONV_PLACEHOLDER_ID) {
          sessionConvIdRef.current = convs[0].id;
          setCurrentConvId(convs[0].id);
        }
        setCalls(callsRes.calls.map(mapCall));
        setContacts(contactsRes.contacts.map(mapContact));
        const mapped = mapBackendSettings(settingsRes.settings);
        setAiSettings(mapped.ai);
        setVoiceSettings(mapped.voice);
        setCallSettings(mapped.call);
        setServices(mapHealth(health));
        setConnectionStatus(health.status === 'ok' ? 'Connected' : 'Error');
      } catch {
        if (active) setConnectionStatus('Disconnected');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  // Load messages when a real conversation is selected.
  useEffect(() => {
    if (!enabled || currentConvId === CONV_PLACEHOLDER_ID) return;
    let active = true;
    apiListMessages(currentConvId)
      .then((res) => {
        if (!active) return;
        const messages = res.messages.map(mapMessage);
        setConversations((prev) => prev.map((c) => (c.id === currentConvId ? { ...c, messages, messageCount: messages.length } : c)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [currentConvId, enabled]);

  // ── conversations ─────────────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    try {
      const res = await apiListConversations();
      const convs = res.conversations.map(mapConversationRow);
      setConversations((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        return convs.map((c) => byId.get(c.id) ?? c);
      });
    } catch {
      // keep current state on failure
    }
  }, []);

  const refreshCalls = useCallback(async () => {
    try {
      const res = await apiListCalls();
      setCalls(res.calls.map(mapCall));
    } catch {
      // keep current state on failure
    }
  }, []);

  const selectConversation = useCallback((id: string) => {
    sessionConvIdRef.current = id;
    setCurrentConvId(id);
    setPlaceholderMessages([]);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiDeleteConversation(id);
      } catch {
        // still clear locally so the UI stays responsive
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConvId === id) {
        sessionConvIdRef.current = CONV_PLACEHOLDER_ID;
        setCurrentConvId(CONV_PLACEHOLDER_ID);
        setPlaceholderMessages([]);
      }
    },
    [currentConvId]
  );

  // ── web chat ──────────────────────────────────────────────────────────
  function appendToSession(msg: Message): void {
    const targetId = sessionConvIdRef.current;
    if (targetId === CONV_PLACEHOLDER_ID) {
      setPlaceholderMessages((prev) => [...prev, msg]);
    } else {
      setConversations((prev) =>
        prev.map((c) => (c.id === targetId ? { ...c, messages: [...c.messages, msg], messageCount: c.messages.length + 1, updatedAt: new Date().toISOString() } : c))
      );
    }
  }

  const promotePlaceholderToServer = useCallback((serverId: string, title: string) => {
    if (sessionConvIdRef.current !== CONV_PLACEHOLDER_ID) return;
    setPlaceholderMessages((prev) => {
      if (prev.length > 0) {
        setConversations((existing) =>
          existing.some((c) => c.id === serverId)
            ? existing.map((c) => (c.id === serverId ? { ...c, messages: [...c.messages, ...prev] } : c))
            : [blankConversation(serverId, title, prev), ...existing]
        );
      }
      return [];
    });
    sessionConvIdRef.current = serverId;
  }, []);

  const handleSendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return undefined;

      appendToSession(newMsg('user', trimmed));

      try {
        const res = await apiSendChat({
          message: trimmed,
          conversationId: sessionConvIdRef.current === CONV_PLACEHOLDER_ID ? undefined : sessionConvIdRef.current,
        });
        if (res.conversationId) {
          promotePlaceholderToServer(res.conversationId, trimmed.slice(0, 40));
          sessionConvIdRef.current = res.conversationId;
        }
        appendToSession(newMsg('assistant', res.reply));
        void refreshConversations();
        return res.reply;
      } catch (err) {
        const msg =
          err instanceof ApiError && (err.code === 'ollama_unavailable' || err.status === 502 || err.status === 503)
            ? 'The AI service is not reachable right now. Start Ollama and try again.'
            : 'Could not reach the AI service. Check your connection and try again.';
        appendToSession(newMsg('system', msg));
        return undefined;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [promotePlaceholderToServer, refreshConversations]
  );

  const appendAiReply = useCallback(async (text: string) => {
    appendToSession(newMsg('assistant', text));
    void refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── telephony ─────────────────────────────────────────────────────────
  const handleStartCall = useCallback(
    async (phoneNumber: string) => {
      const greeting = callSettings.aiGreeting || 'Hello, how may I help you today?';
      const contact = contacts.find((c) => c.phone === phoneNumber);

      try {
        const result = await apiStartOutboundCall(phoneNumber, contact?.id);
        const dbCall = result.call as BackendCall;
        liveCallIdRef.current = dbCall.id;
        const namedContact = contacts.find((c) => c.phone === dbCall.phone_number);
        const live: Call = {
          ...mapCall(dbCall),
          contactName: namedContact?.name ?? dbCall.contact_name ?? `+${phoneNumber}`,
          messages: [newMsg('assistant', greeting)],
        };
        setActiveLiveCall(live);
        speak(greeting);
        setCalls((prev) => [live, ...prev]);
        void refreshCalls();
      } catch (err) {
        // No telephony credentials → local browser preview call (TTS only).
        const fallbackContact: Contact = contact ?? {
          id: `c-${Date.now()}`,
          name: `Caller ${phoneNumber}`,
          phone: phoneNumber,
          email: '',
          company: 'Direct Line',
          notes: '',
          lastCall: '',
          callCount: 0,
        };
        const newCall: Call = {
          id: `call-${Date.now()}`,
          phoneNumber,
          contactName: fallbackContact.name,
          status: 'connected',
          duration: '00:00',
          aiStatus: 'AI handled',
          startedAt: timeLabelSeconds(new Date().toISOString()),
          date: dateLabel(new Date().toISOString()),
          messages: [newMsg('assistant', greeting)],
        };
        liveCallIdRef.current = null;
        speak(greeting);
        setCalls((prev) => [newCall, ...prev]);
        setActiveLiveCall(newCall);
        console.warn(
          err instanceof ApiError && err.status === 503
            ? 'Telephony provider not configured — using local preview call.'
            : 'Outbound call failed; using local preview call.',
          err
        );
      }
    },
    [contacts, callSettings.aiGreeting]
  );

  const handleLiveCallSendMessage = useCallback(
    async (text: string) => {
      if (!activeLiveCall) return;
      const userMsg = newMsg('user', text);
      setActiveLiveCall({ ...activeLiveCall, messages: [...activeLiveCall.messages, userMsg] });

      try {
        const res = await apiSendChat({ message: text });
        const aiMsg = newMsg('assistant', res.reply);
        setActiveLiveCall((prev) => (prev ? { ...prev, messages: [...prev.messages, aiMsg] } : null));
        speak(res.reply);
      } catch {
        // server / voice manager reports unavailable state
      }
    },
    [activeLiveCall]
  );

  const handleEndCall = useCallback(
    async (callId: string, durationStr: string) => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();

      if (liveCallIdRef.current) {
        try {
          await apiHangupCall(liveCallIdRef.current);
          try {
            await apiSummarizeCall(liveCallIdRef.current);
          } catch {
            // summary unavailable (e.g. Ollama not running) — fine
          }
        } catch {
          // provider errors on hangup are non-fatal
        }
        liveCallIdRef.current = null;
      }

      const targetCall = calls.find((c) => c.id === callId) || activeLiveCall;
      const generatedSummary: CallSummary = targetCall
        ? {
            customer: targetCall.contactName || 'Caller',
            duration: durationStr,
            summary: `Call completed with ${targetCall.messages.length} exchanged dialogue turns.`,
            outcome: 'Resolved',
            aiActions: ['Voice call session logged to the system.'],
            customerIntent: 'Direct Call',
            followUpRequired: false,
          }
        : { customer: 'Caller', duration: durationStr, summary: 'Call concluded.', outcome: 'Resolved', aiActions: [], customerIntent: 'Direct Call', followUpRequired: false };

      setCalls((prev) => prev.map((c) => (c.id === callId ? { ...c, status: 'completed', duration: durationStr, summary: generatedSummary } : c)));
      setActiveLiveCall(null);
      void refreshCalls();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calls, activeLiveCall]
  );

  // ── contacts ──────────────────────────────────────────────────────────
  const handleAddContact = useCallback(async (c: { name: string; phone: string; email?: string; company?: string; notes?: string }) => {
    try {
      const saved = await apiCreateContact(c);
      setContacts((prev) => [mapContact(saved as unknown as BackendContact), ...prev]);
    } catch {
      setContacts((prev) => [
        { id: `cnt-${Date.now()}`, name: c.name, phone: c.phone, email: c.email ?? '', company: c.company ?? '', notes: c.notes ?? '', lastCall: '', callCount: 0 },
        ...prev,
      ]);
    }
  }, []);

  const handleDeleteContact = useCallback(async (id: string) => {
    try {
      await apiDeleteContact(id);
    } catch {
      // continue locally
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ── settings ──────────────────────────────────────────────────────────
  const onSaveAiSettings = useCallback(async (s: AISettings) => {
    setAiSettings(s);
    const current = await getPersistedSettings();
    await saveSettings({ ...current, ai: s });
  }, []);

  const onSaveVoiceSettings = useCallback(async (s: VoiceSettings) => {
    setVoiceSettings(s);
    const current = await getPersistedSettings();
    await saveSettings({ ...current, voice: s });
  }, []);

  const onSaveCallSettings = useCallback(async (s: CallSettings) => {
    setCallSettings(s);
    const current = await getPersistedSettings();
    await saveSettings({ ...current, call: s });
  }, []);

  const onRefreshServices = useCallback(async () => {
    setConnectionStatus('Connecting');
    try {
      const health = await fetchHealth();
      setServices(mapHealth(health));
      setConnectionStatus('Connected');
    } catch {
      setConnectionStatus('Disconnected');
    }
  }, []);

  return {
    conversations,
    currentConversation,
    calls,
    activeLiveCall,
    contacts,
    aiSettings,
    voiceSettings,
    callSettings,
    systemConfig,
    services,
    connectionStatus,
    loading,
    selectConversation,
    deleteConversation,
    refreshConversations,
    handleSendMessage,
    appendAiReply,
    getConversationIdForChat: () => (sessionConvIdRef.current === CONV_PLACEHOLDER_ID ? null : sessionConvIdRef.current),
    handleStartCall,
    handleEndCall,
    handleLiveCallSendMessage,
    handleAddContact,
    handleDeleteContact,
    onSaveAiSettings,
    onSaveVoiceSettings,
    onSaveCallSettings,
    onRefreshServices,
  };
}

// ── helpers ─────────────────────────────────────────────────────────────

async function getPersistedSettings(): Promise<BackendSettings> {
  try {
    const res = await fetchSettings();
    return res.settings;
  } catch {
    return { ai: DEFAULT_AI_SETTINGS, voice: DEFAULT_VOICE_SETTINGS, call: DEFAULT_CALL_SETTINGS };
  }
}

function speak(text: string): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utter);
  }
}