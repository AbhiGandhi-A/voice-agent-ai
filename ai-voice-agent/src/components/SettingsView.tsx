import React, { useEffect, useRef, useState } from 'react';
import { Save, Sparkles, Volume2, PhoneCall, Server, Check, Trash2, Camera } from 'lucide-react';
import { AISettings, CallSettings, SystemConfig, VoiceSettings } from '../types';
import { deleteMemory, listMemories, MemoryRecord, updateMemory } from '../lib/api';
import { cameraErrorMessage, stopMediaStream } from '../lib/camera';

interface SettingsViewProps {
  aiSettings: AISettings;
  onSaveAiSettings: (settings: AISettings) => void;
  voiceSettings: VoiceSettings;
  onSaveVoiceSettings: (settings: VoiceSettings) => void;
  callSettings: CallSettings;
  onSaveCallSettings: (settings: CallSettings) => void;
  systemConfig: SystemConfig;
  onSaveSystemConfig: (config: SystemConfig) => void;
  cameraStream?: MediaStream | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  aiSettings,
  onSaveAiSettings,
  voiceSettings,
  onSaveVoiceSettings,
  callSettings,
  onSaveCallSettings,
  systemConfig,
  onSaveSystemConfig,
  cameraStream,
}) => {
  const [activeSection, setActiveSection] = useState<'ai' | 'voice' | 'call' | 'system'>('ai');
  const [ai, setAi] = useState<AISettings>(aiSettings);
  const [voice, setVoice] = useState<VoiceSettings>(voiceSettings);
  const [call, setCall] = useState<CallSettings>(callSettings);
  const [sys, setSys] = useState<SystemConfig>(systemConfig);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [memoryError, setMemoryError] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(voiceSettings.cameraEnabled);
  const [cameraError, setCameraError] = useState('');
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (activeSection !== 'system') return;
    listMemories()
      .then((response) => setMemories(response.memories))
      .catch(() => setMemoryError('Could not load memories.'));
  }, [activeSection]);

  useEffect(() => {
    setVoice(voiceSettings);
    setCameraEnabled(voiceSettings.cameraEnabled);
  }, [voiceSettings]);

  useEffect(() => {
    if (cameraEnabled && cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream || null;
      cameraVideoRef.current.play().catch(() => undefined);
    }
  }, [cameraEnabled, cameraStream]);

  const toggleCamera = (enabled: boolean) => {
    setCameraError('');
    setCameraEnabled(enabled);
    const updated = { ...voice, cameraEnabled: enabled };
    setVoice(updated);
    onSaveVoiceSettings(updated);
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await deleteMemory(id);
      setMemories((current) => current.filter((item) => item.id !== id));
    } catch {
      setMemoryError('Could not delete that memory.');
    }
  };

  const handleUpdateMemory = async (item: MemoryRecord) => {
    const memory = window.prompt('Update memory', item.memory)?.trim();
    if (!memory || memory === item.memory) return;
    try {
      const response = await updateMemory(item.id, { memory });
      setMemories((current) => current.map((entry) => (entry.id === item.id ? response.memory : entry)));
    } catch {
      setMemoryError('Could not update that memory.');
    }
  };

  const handleSaveAll = () => {
    onSaveAiSettings(ai);
    onSaveVoiceSettings(voice);
    onSaveCallSettings(call);
    onSaveSystemConfig(sys);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System & AI Settings</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure local open-source models, Piper neural speech voices, silence VAD, and Asterisk telephony rules.
          </p>
        </div>

        <button
          id="save-all-settings-btn"
          onClick={handleSaveAll}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-[0_0_16px_rgba(99,102,241,0.4)] transition-all cursor-pointer shrink-0"
        >
          {savedNotice ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
          <span>{savedNotice ? 'Settings Saved!' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800 w-fit">
        <button
          onClick={() => setActiveSection('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
            activeSection === 'ai' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Local AI (Ollama)</span>
        </button>
        <button
          onClick={() => setActiveSection('voice')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
            activeSection === 'voice' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Voice & Audio (Piper/Whisper)</span>
        </button>
        <button
          onClick={() => setActiveSection('call')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
            activeSection === 'call' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Call Center Rules</span>
        </button>
        <button
          onClick={() => setActiveSection('system')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
            activeSection === 'system' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>System & Endpoints</span>
        </button>
      </div>

      {/* Settings Form Container */}
      <div className="rounded-2xl bg-[#0c1222]/90 border border-slate-800/80 p-6 backdrop-blur-xl shadow-xl">
        {/* SECTION 1: AI SETTINGS */}
        {activeSection === 'ai' && (
          <div className="flex flex-col gap-5 text-xs text-slate-300">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Local Ollama LLM Settings</h3>
              <p className="text-[11.5px] text-slate-400 mt-0.5">
                Configure your self-hosted offline language model parameters. Zero API costs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">Active LLM Model</label>
                <input
                  type="text"
                  value={ai.model}
                  onChange={(e) => setAi({ ...ai, model: e.target.value })}
                  placeholder="e.g. llama3.2, mistral:7b, deepseek-r1:8b"
                  className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10.5px] text-slate-500">Configurable through OLLAMA_MODEL</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">
                  Temperature: <span className="text-indigo-400">{ai.temperature}</span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={1.2}
                  step={0.05}
                  value={ai.temperature}
                  onChange={(e) => setAi({ ...ai, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer mt-2"
                />
                <span className="text-[10.5px] text-slate-500">
                  Lower for deterministic answers, higher for creative conversational tone.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">Max Response Length (Tokens)</label>
                <input
                  type="number"
                  value={ai.maxTokens}
                  onChange={(e) => setAi({ ...ai, maxTokens: parseInt(e.target.value) || 250 })}
                  className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10.5px] text-slate-500">Keeps spoken voice responses concise.</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">Max Conversation Context Messages</label>
                <input
                  type="number"
                  value={ai.historyLimit}
                  onChange={(e) => setAi({ ...ai, historyLimit: parseInt(e.target.value) || 20 })}
                  className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10.5px] text-slate-500">
                  Controls rolling sliding window context (MAX_CONTEXT_MESSAGES=20).
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-semibold">Configurable System Prompt</label>
              <textarea
                rows={5}
                value={ai.systemPrompt}
                onChange={(e) => setAi({ ...ai, systemPrompt: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-200 text-xs leading-relaxed focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10.5px] text-slate-500">
                Instructs the AI to speak naturally, keep sentences concise, and handle interruptions.
              </span>
            </div>
          </div>
        )}

        {/* SECTION 2: VOICE SETTINGS */}
        {activeSection === 'voice' && (
          <div className="flex flex-col gap-5 text-xs text-slate-300">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Audio, Whisper STT & Piper TTS Settings</h3>
              <p className="text-[11.5px] text-slate-400 mt-0.5">
                Zero-cloud speech recognition and local neural voice synthesis parameters.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">faster-whisper Model</label>
                <select
                  value={voice.whisperModel}
                  onChange={(e) => setVoice({ ...voice, whisperModel: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="small">small (Fast & accurate for local CPUs)</option>
                  <option value="tiny">tiny (Ultra low latency)</option>
                  <option value="base">base</option>
                  <option value="medium">medium (Multilingual high precision)</option>
                  <option value="large-v3">large-v3 (Requires 6GB+ VRAM)</option>
                </select>
                <span className="text-[10.5px] text-slate-500">Loaded once in RAM to avoid re-downloads</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">Primary Speech Language</label>
                <select
                  value={voice.whisperLanguage}
                  onChange={(e) => setVoice({ ...voice, whisperLanguage: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Auto (Detect)">Auto (Detect)</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Gujarati">Gujarati</option>
                  <option value="Hinglish">Hinglish</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#080d19] border border-slate-800">
                <div className="flex items-center gap-3">
                  <Camera className="w-4 h-4 text-slate-400" />
                  <div>
                    <h4 className="font-semibold text-white">Camera / Webcam</h4>
                    <p className="text-[11px] text-slate-400">Local browser stream. Enables vision features.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cameraEnabled}
                  onChange={(event) => void toggleCamera(event.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  aria-label="Enable camera"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-[#080d19] border border-slate-800">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-slate-400" />
                  <div>
                    <h4 className="font-semibold text-white">Face Expression Analysis</h4>
                    <p className="text-[11px] text-slate-400">Local CPU facial emotion detection via Python service.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={voice.faceAnalysisEnabled && cameraEnabled}
                  disabled={!cameraEnabled}
                  onChange={(event) => setVoice({ ...voice, faceAnalysisEnabled: event.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer disabled:opacity-40"
                  aria-label="Enable Face Expression Analysis"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#080d19] border border-slate-800">
                <div>
                  <h4 className="font-semibold text-white">Auto Wake</h4>
                  <p className="text-[11px] text-slate-400">Listen locally for "Hey Robo" before starting a command.</p>
                </div>
                <input
                  type="checkbox"
                  checked={voice.autoWake}
                  onChange={(event) => setVoice({ ...voice, autoWake: event.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  aria-label="Enable Auto Wake"
                />
              </div>
            </div>

            {cameraEnabled && (
              <video ref={cameraVideoRef} autoPlay muted playsInline className="w-full max-w-md aspect-video rounded-xl bg-[#080d19] border border-slate-800 object-cover" />
            )}
            {cameraError && <p className="text-xs text-rose-300">{cameraError}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">Piper TTS Voice</label>
                <select
                  value={voice.ttsVoice}
                  onChange={(e) => setVoice({ ...voice, ttsVoice: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="en_US-amy">en_US-amy (Natural American English)</option>
                  <option value="en_US-lessac">en_US-lessac</option>
                  <option value="en_GB-alan">en_GB-alan (British English)</option>
                  <option value="hi_IN-roop">hi_IN-roop (Hindi Neural)</option>
                  <option value="gu_IN-shyam">gu_IN-shyam (Gujarati Neural)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">
                  Silence VAD Duration: <span className="text-emerald-400">{voice.silenceThresholdMs} ms</span>
                </label>
                <input
                  type="range"
                  min={400}
                  max={2000}
                  step={50}
                  value={voice.silenceThresholdMs}
                  onChange={(e) => setVoice({ ...voice, silenceThresholdMs: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer mt-2"
                />
                <span className="text-[10.5px] text-slate-500">
                  Configurable through SILENCE_DURATION_MS (default 900ms)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: CALL CENTER RULES */}
        {activeSection === 'call' && (
          <div className="flex flex-col gap-5 text-xs text-slate-300">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Call Center & Asterisk Telephony Rules</h3>
              <p className="text-[11.5px] text-slate-400 mt-0.5">
                Configure auto-answer, human takeover parameters, and call barge-in interruption.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#080d19] border border-slate-800">
                <div>
                  <h4 className="font-semibold text-white">Barge-in / Speech Interruption</h4>
                  <p className="text-[11px] text-slate-400">
                    Immediately stop AI audio when customer starts speaking.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={call.bargeInEnabled}
                  onChange={(e) => setCall({ ...call, bargeInEnabled: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-[#080d19] border border-slate-800">
                <div>
                  <h4 className="font-semibold text-white">Enable Human Takeover</h4>
                  <p className="text-[11px] text-slate-400">
                    Allow supervisor to seize control and mute AI instantly.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={call.enableHumanTakeover}
                  onChange={(e) => setCall({ ...call, enableHumanTakeover: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-semibold">Standard AI Phone Greeting</label>
              <input
                type="text"
                value={call.aiGreeting}
                onChange={(e) => setCall({ ...call, aiGreeting: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* SECTION 4: SYSTEM & ENDPOINTS */}
        {activeSection === 'system' && (
          <div className="flex flex-col gap-5 text-xs text-slate-300">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Server Endpoints & Environment Config</h3>
              <p className="text-[11.5px] text-slate-400 mt-0.5">
                Runtime API configuration and browser voice transport status.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">Backend API Base URL</label>
                <input
                  type="text"
                  value={sys.aiServerUrl}
                  readOnly
                  placeholder="/api"
                  className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-semibold">Browser Voice Transport</label>
                <input
                  type="text"
                  value={sys.wsUrl}
                  readOnly
                  placeholder="Browser SpeechRecognition (no WebSocket)"
                  className="px-3.5 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#080d19] border border-slate-800">
              <div>
                <h4 className="font-semibold text-white">Mock Mode</h4>
                <p className="text-[11px] text-slate-400">
                  Disabled. Voice uses browser SpeechRecognition, the authenticated Node API, Ollama, and browser speechSynthesis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSys({ ...sys, mockMode: false })}
                disabled
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  sys.mockMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Live Server Mode
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white">Persistent User Memory</h3>
                <p className="text-[11.5px] text-slate-400 mt-0.5">Memories are saved to your authenticated Supabase account only.</p>
              </div>
              {memoryError && <p className="text-xs text-rose-300">{memoryError}</p>}
              {memories.length === 0 ? (
                <p className="text-xs text-slate-500">No saved memories.</p>
              ) : memories.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#080d19] border border-slate-800">
                  <span className="text-xs text-slate-200">{item.memory}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => void handleUpdateMemory(item)} className="text-xs text-indigo-300 hover:text-white">Edit</button>
                    <button type="button" onClick={() => void handleDeleteMemory(item.id)} className="p-1 text-rose-400 hover:text-rose-300" title="Delete memory" aria-label="Delete memory">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
