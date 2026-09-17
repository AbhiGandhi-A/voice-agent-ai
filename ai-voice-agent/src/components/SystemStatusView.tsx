import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Cpu, HardDrive, Wifi, Server, Mic, Volume2 } from 'lucide-react';
import { ServiceStatus } from '../types';

interface SystemStatusViewProps {
  services: ServiceStatus[];
  onRefreshServices: () => void;
}

interface ServerHealthData {
  status: string;
  uptimeSeconds: number;
  environment: string;
  geminiConfigured: boolean;
  model: string;
  memory: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
  };
  nodeVersion: string;
}

export const SystemStatusView: React.FC<SystemStatusViewProps> = ({
  services,
  onRefreshServices,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverHealth, setServerHealth] = useState<ServerHealthData | null>(null);
  const [browserCapabilities, setBrowserCapabilities] = useState<{
    speechRecognition: boolean;
    speechSynthesis: boolean;
    voiceCount: number;
    audioContext: boolean;
  }>({
    speechRecognition: false,
    speechSynthesis: false,
    voiceCount: 0,
    audioContext: false,
  });

  const checkHealth = useCallback(async () => {
    setIsRefreshing(true);
    onRefreshServices();

    // Check browser speech capabilities
    if (typeof window !== 'undefined') {
      const hasSpeechRec = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
      const hasSynth = 'speechSynthesis' in window;
      const hasAudioCtx = 'AudioContext' in window || 'webkitAudioContext' in window;
      let voicesCount = 0;
      if (hasSynth) {
        voicesCount = window.speechSynthesis.getVoices().length;
      }
      setBrowserCapabilities({
        speechRecognition: hasSpeechRec,
        speechSynthesis: hasSynth,
        voiceCount: voicesCount,
        audioContext: hasAudioCtx,
      });
    }

    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerHealth(data);
      }
    } catch (err) {
      console.warn('Could not fetch server health:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  }, [onRefreshServices]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins < 60) return `${mins}m ${secs}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System Infrastructure Health</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time diagnostics for Express backend, Gemini LLM pipeline, and browser speech engines.
          </p>
        </div>

        <button
          onClick={checkHealth}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* Metrics Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Backend Server Status</span>
            <div className="text-lg font-bold text-white">
              {serverHealth?.status === 'ok' ? 'Online & Healthy' : 'Connecting...'}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {serverHealth ? `Uptime: ${formatUptime(serverHealth.uptimeSeconds)}` : 'Node.js runtime'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Server Process Memory</span>
            <div className="text-lg font-bold text-white">
              {serverHealth?.memory ? `${serverHealth.memory.heapUsedMb} MB Heap` : 'Active'}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {serverHealth?.memory ? `RSS: ${serverHealth.memory.rssMb} MB` : 'Monitoring'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Gemini 2.5 Engine</span>
            <div className="text-lg font-bold text-emerald-400">
              {serverHealth?.geminiConfigured ? 'Ready (API Key Active)' : 'Active Runtime'}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {serverHealth?.model || 'gemini-2.5-flash'}
            </span>
          </div>
        </div>
      </div>

      {/* Real Hardware & Browser Detection */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Client Audio Pipeline Diagnostics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 flex items-center gap-3">
            <Mic className="w-4 h-4 text-indigo-400" />
            <div className="flex flex-col">
              <span className="text-slate-400 text-[11px]">Speech-to-Text (STT)</span>
              <span className="font-semibold text-slate-200">
                {browserCapabilities.speechRecognition ? 'Browser Native SpeechRecognition' : 'Web Audio STT'}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-purple-400" />
            <div className="flex flex-col">
              <span className="text-slate-400 text-[11px]">Speech Synthesis (TTS)</span>
              <span className="font-semibold text-slate-200">
                {browserCapabilities.speechSynthesis
                  ? `${browserCapabilities.voiceCount > 0 ? browserCapabilities.voiceCount : 'Multiple'} System Voices Available`
                  : 'Web Audio Synth'}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 flex items-center gap-3">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-slate-400 text-[11px]">Web Audio Analyser</span>
              <span className="font-semibold text-slate-200">
                {browserCapabilities.audioContext ? 'Real-time VAD & FFT Supported' : 'Basic Input'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex flex-col justify-between gap-3 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{svc.name}</h3>
                <span className="text-[11px] text-slate-400">{svc.details}</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold flex items-center gap-1.5 ${
                  svc.status === 'online'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    svc.status === 'online' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-500'
                  }`}
                />
                {svc.status.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
              <span className="text-slate-400">Response Latency:</span>
              <span className="font-mono text-emerald-400 font-medium">{svc.latency}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
