import { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { VoiceHeroCard } from './components/VoiceHeroCard';
import { LiveTranscript } from './components/LiveTranscript';
import { MessageInput } from './components/MessageInput';
import { LiveStatusCard } from './components/LiveStatusCard';
import { QuickSettingsCard } from './components/QuickSettingsCard';
import { RecentConversationsCard } from './components/RecentConversationsCard';
import { ConversationsView } from './components/ConversationsView';
import { CallsView } from './components/CallsView';
import { DialerView } from './components/DialerView';
import { LiveCallView } from './components/LiveCallView';
import { ContactsView } from './components/ContactsView';
import { SettingsView } from './components/SettingsView';
import { SystemStatusView } from './components/SystemStatusView';
import { ModelsView } from './components/ModelsView';
import { IntegrationsView } from './components/IntegrationsView';
import { HelpDocsView } from './components/HelpDocsView';
import { AuthScreen, AuthLoadingScreen } from './components/AuthScreen';

import { Call, VoiceStatus } from './types';
import { VoiceSessionManager } from './lib/voice-session';
import { supabase } from './lib/supabase';
import { useAppData } from './hooks/useAppData';
import { useAuth } from './hooks/useAuth';
import { AssistantLanguage, detectExplicitLanguageCommand, detectLanguageFromText, languageSettingLabel, normalizeAssistantLanguage } from './lib/language';

import { captureVideoFrame, stopMediaStream } from './lib/camera';

type ConnectionStatus = 'Connected' | 'Connecting' | 'Disconnected' | 'Error';

async function getSupabaseToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export default function App() {
  const auth = useAuth();
  const data = useAppData(auth.hasSession);

  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isDark, setIsDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [manualStatus, setManualStatus] = useState<ConnectionStatus | null>(null);

  // Voice Session State
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [amplitude, setAmplitude] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [liveInterimText, setLiveInterimText] = useState<string>('');
  const [activeLanguage, setActiveLanguage] = useState<AssistantLanguage>('en');
  const activeLanguageRef = useRef<AssistantLanguage>('en');

  // Camera & Vision Stream Management
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Live-call UI override so the original navigation behavior is preserved.
  const [activeCallUi, setActiveCallUi] = useState<Call | null>(null);

  const voiceManagerRef = useRef<VoiceSessionManager | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // ── Camera and Vision Sampling Loop (1 FPS when enabled) ─────────────
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let streamCancelled = false;

    const isCameraEnabled = Boolean(data.voiceSettings.cameraEnabled);
    const isFaceAnalysisEnabled = Boolean(data.voiceSettings.faceAnalysisEnabled);

    if (isCameraEnabled) {
      const isStreamActive =
        cameraStreamRef.current &&
        cameraStreamRef.current.getVideoTracks().some((t) => t.readyState === 'live');

      if (!isStreamActive && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: false })
          .then((stream) => {
            if (streamCancelled) {
              stopMediaStream(stream);
              return;
            }
            stopMediaStream(cameraStreamRef.current);
            cameraStreamRef.current = stream;
            if (cameraVideoRef.current) {
              cameraVideoRef.current.srcObject = stream;
              cameraVideoRef.current.play().catch(() => undefined);
            }
            void dataRef.current.updateCameraState(true);
          })
          .catch((err) => {
            console.warn('[CAMERA] getUserMedia failed:', err);
            void dataRef.current.updateCameraState(false);
          });
      } else if (isStreamActive && cameraVideoRef.current && !cameraVideoRef.current.srcObject) {
        cameraVideoRef.current.srcObject = cameraStreamRef.current;
        cameraVideoRef.current.play().catch(() => undefined);
        void dataRef.current.updateCameraState(true);
      }

      // Start 1 FPS sampling if face / hand analysis is enabled
      if (isFaceAnalysisEnabled) {
        intervalId = setInterval(() => {
          const vid = cameraVideoRef.current;
          if (!vid || !dataRef.current.voiceSettings.cameraEnabled || !dataRef.current.voiceSettings.faceAnalysisEnabled) {
            return;
          }
          const frame = captureVideoFrame(vid, 320, 240, 0.65);
          if (frame) {
            void dataRef.current.processVisionFrame(frame);
          }
        }, 1000);
      }
    } else {
      if (cameraStreamRef.current) {
        stopMediaStream(cameraStreamRef.current);
        cameraStreamRef.current = null;
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null;
      }
      void dataRef.current.updateCameraState(false);
    }

    return () => {
      streamCancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [data.voiceSettings.cameraEnabled, data.voiceSettings.faceAnalysisEnabled]);

  // Reflect backend-initiated live calls in the UI.
  useEffect(() => {
    if (data.activeLiveCall) setActiveCallUi(data.activeLiveCall);
  }, [data.activeLiveCall]);

  const connectionStatus: ConnectionStatus = manualStatus ?? data.connectionStatus;

  const updateConversationLanguage = useCallback(
    (message: string, source: 'user' | 'system' = 'user') => {
      const explicit = detectExplicitLanguageCommand(message);
      if (explicit) {
        const next = explicit;
        activeLanguageRef.current = next;
        setActiveLanguage(next);
        const label = languageSettingLabel(next);
        void data.onSaveVoiceSettings({ ...data.voiceSettings, whisperLanguage: label });
        return next;
      }

      if (source === 'user' && activeLanguageRef.current !== 'en') {
        return activeLanguageRef.current;
      }

      const detected = detectLanguageFromText(message);
      if (detected !== 'en' || activeLanguageRef.current === 'en') {
        activeLanguageRef.current = detected;
        setActiveLanguage(detected);
        const label = languageSettingLabel(detected);
        void data.onSaveVoiceSettings({ ...data.voiceSettings, whisperLanguage: label });
      }
      return activeLanguageRef.current;
    },
    [data]
  );

  // Initialize VoiceSessionManager once, keeping state/event handlers fresh via refs.
  useEffect(() => {
    const manager = new VoiceSessionManager(
      {
        aiModel: data.aiSettings.model,
        whisperModel: data.voiceSettings.whisperModel,
        whisperLanguage: data.voiceSettings.whisperLanguage,
        ttsVoice: data.voiceSettings.ttsVoice,
        silenceThresholdMs: data.voiceSettings.silenceThresholdMs,
        autoWake: data.voiceSettings.autoWake,
        systemPrompt: data.aiSettings.systemPrompt,
        getAuthToken: getSupabaseToken,
        chatEndpoint: '/api/ai/chat',
        getConversationId: () => dataRef.current.getConversationIdForChat(),
      },
      (event) => {
        if (event.type === 'status' && event.status) {
          setVoiceStatus(event.status);
        } else if (event.type === 'user_transcript' && event.text) {
          setLiveInterimText(event.text);
        } else if (event.type === 'transcript_final' && event.text) {
          setLiveInterimText('');
          const nextLanguage = updateConversationLanguage(event.text, 'user');
          void dataRef.current.handleSendMessage(event.text, nextLanguage).then((reply) => {
            if (reply) {
              voiceManagerRef.current?.speakText(reply, false);
            } else {
              voiceManagerRef.current?.resumeListening();
            }
          });
        } else if (event.type === 'ai_text' && event.text) {
          setLiveInterimText('');
          void dataRef.current.appendAiReply(event.text);
        }
      }
    );

    manager.setHistoryProvider(() => dataRef.current.currentConversation.messages);
    manager.setAmplitudeListener(setAmplitude);

    voiceManagerRef.current = manager;

    return () => {
      manager.stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep voice manager config in sync with saved settings without restarting the session.
  useEffect(() => {
    voiceManagerRef.current?.updateConfig({
      aiModel: data.aiSettings.model,
      whisperModel: data.voiceSettings.whisperModel,
      whisperLanguage: data.voiceSettings.whisperLanguage,
      ttsVoice: data.voiceSettings.ttsVoice,
      silenceThresholdMs: data.voiceSettings.silenceThresholdMs,
      autoWake: data.voiceSettings.autoWake,
      systemPrompt: data.aiSettings.systemPrompt,
    });
  }, [
    data.aiSettings.model,
    data.aiSettings.systemPrompt,
    data.voiceSettings.whisperModel,
    data.voiceSettings.whisperLanguage,
    data.voiceSettings.ttsVoice,
    data.voiceSettings.silenceThresholdMs,
    data.voiceSettings.autoWake,
  ]);

  // Handlers for Voice
  const handleToggleMic = async () => {
    if (voiceStatus === 'idle' || voiceStatus === 'error') {
      await voiceManagerRef.current?.startSession();
    } else {
      voiceManagerRef.current?.stopSession();
    }
  };

  const handleToggleMute = () => {
    if (voiceManagerRef.current) {
      const muted = voiceManagerRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const handleStopSession = () => {
    voiceManagerRef.current?.stopSession();
    setLiveInterimText('');
  };

  const handleSendMessage = async (text: string) => {
    const nextLanguage = updateConversationLanguage(text, 'user');
    await data.handleSendMessage(text, nextLanguage);
  };

  const handlePlayMessage = (text: string) => {
    if (voiceManagerRef.current) {
      voiceManagerRef.current.speakText(text);
    }
  };

  const handleStartCall = async (phoneNumber: string) => {
    setActiveCallUi(null);
    await data.handleStartCall(phoneNumber);
  };

  const handleLiveCallSendMessage = async (text: string) => {
    await data.handleLiveCallSendMessage(text);
  };

  const handleEndCall = async (callId: string, durationStr: string) => {
    await data.handleEndCall(callId, durationStr);
    setActiveCallUi(null);
    setCurrentTab('calls');
  };

  const handleRefreshServices = useCallback(() => {
    setManualStatus(null);
    void data.onRefreshServices();
  }, [data.onRefreshServices]);

  // ── Auth gate ──────────────────────────────────────────────────────────
  if (auth.loading) {
    return <AuthLoadingScreen />;
  }

  if (!auth.hasSession) {
    return (
      <AuthScreen
        loading={false}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
      />
    );
  }

  return (
    <div
      className={`min-h-screen font-sans flex text-slate-100 ${
        isDark ? 'bg-[#050811]' : 'bg-slate-900'
      }`}
    >
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setActiveCallUi(null);
        }}
        isDark={isDark}
        onToggleDark={() => setIsDark(!isDark)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TopHeader
          connectionStatus={connectionStatus}
          onChangeConnectionStatus={setManualStatus}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />

        {/* Dynamic Views */}
        <main className="flex-1 flex flex-col">
          {/* 1. Live Call Override (If active) */}
          {activeCallUi ? (
            <LiveCallView
              call={activeCallUi}
              onEndCall={handleEndCall}
              onBack={() => setActiveCallUi(null)}
              onSendMessage={handleLiveCallSendMessage}
            />
          ) : (
            <>
              {/* TAB: Home (The Main Voice Dashboard) */}
              {currentTab === 'home' && (
                <div className="p-3 sm:p-4 lg:p-5 max-w-[1600px] mx-auto w-full">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-start">
                    {/* Left 2 Cols: Hero Voice Card + Live Transcript + Input */}
                    <div className="lg:col-span-2 flex flex-col gap-3.5">
                      {/* Voice Hero Card */}
                      <VoiceHeroCard
                        status={voiceStatus}
                        amplitude={amplitude}
                        isMuted={isMuted}
                        onToggleMic={handleToggleMic}
                        onToggleMute={handleToggleMute}
                        onStop={handleStopSession}
                        onOpenSettings={() => setCurrentTab('settings')}
                      />

                      {/* Live Conversation Transcript */}
                      <div className="flex flex-col gap-2">
                        <LiveTranscript
                          messages={data.currentConversation.messages}
                          onPlayMessage={handlePlayMessage}
                          onResetChat={() => void data.resetChat()}
                          liveInterimText={liveInterimText}
                          isThinking={voiceStatus === 'thinking'}
                        />

                        {/* Message Input with send & voice addon */}
                        <MessageInput
                          onSendMessage={handleSendMessage}
                          onVoiceClick={handleToggleMic}
                          disabled={voiceStatus === 'thinking'}
                        />
                      </div>
                    </div>

                    {/* Right 1 Col: Live Status + Quick Settings + Recent Conversations */}
                    <div className="flex flex-col gap-3.5">
                      <LiveStatusCard
                        voiceStatus={voiceStatus}
                        amplitude={amplitude}
                        aiModel={data.aiSettings.model}
                        ttsVoice={data.voiceSettings.ttsVoice}
                        cameraEnabled={data.voiceSettings.cameraEnabled}
                        visionState={data.visionState}
                      />

                      <QuickSettingsCard
                        aiModel={data.aiSettings.model}
                        onChangeAiModel={(m) => void data.onSaveAiSettings({ ...data.aiSettings, model: m })}
                        whisperModel={data.voiceSettings.whisperModel}
                        onChangeWhisperModel={(w) =>
                          void data.onSaveVoiceSettings({ ...data.voiceSettings, whisperModel: w })
                        }
                        ttsVoice={data.voiceSettings.ttsVoice}
                        onChangeTtsVoice={(v) =>
                          void data.onSaveVoiceSettings({ ...data.voiceSettings, ttsVoice: v })
                        }
                        language={data.voiceSettings.whisperLanguage}
                        onChangeLanguage={(l) =>
                          void data.onSaveVoiceSettings({ ...data.voiceSettings, whisperLanguage: l })
                        }
                        onViewAll={() => setCurrentTab('settings')}
                      />

                      <RecentConversationsCard
                        conversations={data.conversations}
                        onSelectConversation={(c) => {
                          data.selectConversation(c.id);
                        }}
                        onViewAll={() => setCurrentTab('conversations')}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Conversations */}
              {currentTab === 'conversations' && (
                <ConversationsView
                  conversations={data.conversations}
                  onDeleteConversation={(id) => {
                    void data.deleteConversation(id);
                  }}
                  onPlayMessage={handlePlayMessage}
                />
              )}

              {/* TAB: Calls */}
              {currentTab === 'calls' && (
                <CallsView
                  calls={data.calls}
                  onOpenLiveCall={(c) => setActiveCallUi(c)}
                  onOpenDialer={() => setCurrentTab('dialer')}
                />
              )}

              {/* TAB: Dialer */}
              {currentTab === 'dialer' && (
                <DialerView onStartCall={handleStartCall} recentCalls={data.calls} />
              )}

              {/* TAB: Contacts */}
              {currentTab === 'contacts' && (
                <ContactsView
                  contacts={data.contacts}
                  onAddContact={(newContact) => {
                    void data.handleAddContact(newContact);
                  }}
                  onDeleteContact={(id) => {
                    void data.handleDeleteContact(id);
                  }}
                  onCallContact={(phone) => {
                    void handleStartCall(phone);
                  }}
                />
              )}

              {/* TAB: Settings */}
              {currentTab === 'settings' && (
                <SettingsView
                  aiSettings={data.aiSettings}
                  onSaveAiSettings={(s) => void data.onSaveAiSettings(s)}
                  voiceSettings={data.voiceSettings}
                  onSaveVoiceSettings={(s) => void data.onSaveVoiceSettings(s)}
                  callSettings={data.callSettings}
                  onSaveCallSettings={(s) => void data.onSaveCallSettings(s)}
                  systemConfig={data.systemConfig}
                  onSaveSystemConfig={() => undefined}
                  cameraStream={cameraStreamRef.current}
                />
              )}

              {/* TAB: System Status */}
              {currentTab === 'system-status' && (
                <SystemStatusView
                  services={data.services}
                  onRefreshServices={handleRefreshServices}
                />
              )}

              {/* TAB: Models */}
              {currentTab === 'models' && <ModelsView />}

              {/* TAB: Integrations */}
              {currentTab === 'integrations' && <IntegrationsView />}

              {/* TAB: Help & Docs */}
              {currentTab === 'help' && <HelpDocsView />}
            </>
          )}
        </main>
      </div>

      {/* Offscreen video element for local webcam frame capture & vision analysis */}
      <video
        ref={cameraVideoRef}
        autoPlay
        muted
        playsInline
        className="fixed -top-[9999px] -left-[9999px] w-[320px] h-[240px] opacity-0 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}