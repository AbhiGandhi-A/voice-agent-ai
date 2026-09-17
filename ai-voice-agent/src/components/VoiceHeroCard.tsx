import React from 'react';
import { Mic, MicOff, Square, Settings, Sparkles } from 'lucide-react';
import { VoiceStatus } from '../types';

interface VoiceHeroCardProps {
  status: VoiceStatus;
  amplitude?: number;
  isMuted: boolean;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
}

export const VoiceHeroCard: React.FC<VoiceHeroCardProps> = ({
  status,
  amplitude = 0,
  isMuted,
  onToggleMic,
  onToggleMute,
  onStop,
  onOpenSettings,
}) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'listening':
        return {
          title: 'Listening...',
          sub: "Speak now, I'm listening",
          glowColor: 'from-cyan-500/30 to-blue-500/30',
          ringColor: 'border-cyan-400/80 shadow-[0_0_50px_rgba(56,189,248,0.45)]',
        };
      case 'thinking':
        return {
          title: 'Thinking...',
          sub: 'Processing your request',
          glowColor: 'from-purple-500/30 to-indigo-500/30',
          ringColor: 'border-purple-400/80 shadow-[0_0_50px_rgba(168,85,247,0.45)]',
        };
      case 'speaking':
        return {
          title: 'AI is speaking...',
          sub: 'You can interrupt me anytime',
          glowColor: 'from-indigo-500/30 to-cyan-500/30',
          ringColor: 'border-indigo-400/80 shadow-[0_0_50px_rgba(99,102,241,0.45)]',
        };
      case 'connecting':
        return {
          title: 'Connecting...',
          sub: 'Initializing local voice pipeline',
          glowColor: 'from-amber-500/20 to-indigo-500/20',
          ringColor: 'border-amber-400/70 shadow-[0_0_40px_rgba(251,191,36,0.3)]',
        };
      case 'error':
        return {
          title: 'Connection error',
          sub: 'Failed to access microphone or AI server',
          glowColor: 'from-rose-500/20 to-red-500/20',
          ringColor: 'border-rose-400/70 shadow-[0_0_40px_rgba(244,63,94,0.3)]',
        };
      default:
        return {
          title: 'Ready to start',
          sub: 'Click the microphone to begin talking',
          glowColor: 'from-indigo-500/20 to-purple-500/20',
          ringColor: 'border-indigo-400/50 shadow-[0_0_35px_rgba(99,102,241,0.25)]',
        };
    }
  };

  const statusInfo = getStatusDisplay();
  const isSessionActive = status === 'listening' || status === 'speaking' || status === 'thinking';

  return (
    <div
      id="voice-hero-card"
      className="relative rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 p-6 md:p-8 backdrop-blur-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center select-none min-h-[360px]"
    >
      {/* Background Neon Flowing Wave SVG graphic matching reference */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden flex items-center justify-center">
        <svg
          viewBox="0 0 1000 300"
          className="w-full h-full object-cover text-transparent"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="cyanWave" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="35%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="65%" stopColor="#3b82f6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="purpleWave" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0" />
              <stop offset="30%" stopColor="#a855f7" stopOpacity="0.85" />
              <stop offset="70%" stopColor="#ec4899" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M 0 150 Q 250 80 500 150 T 1000 150"
            fill="none"
            stroke="url(#cyanWave)"
            strokeWidth="2.5"
            className={isSessionActive ? 'animate-pulse' : ''}
          />
          <path
            d="M 0 150 Q 250 220 500 150 T 1000 150"
            fill="none"
            stroke="url(#purpleWave)"
            strokeWidth="2"
            opacity="0.8"
          />
          <path
            d="M 0 160 C 200 110, 350 200, 500 155 C 650 110, 800 190, 1000 160"
            fill="none"
            stroke="url(#cyanWave)"
            strokeWidth="1.5"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* Header text */}
      <div className="relative z-10 flex flex-col items-center mb-6">
        <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-200 to-cyan-300">
          AI Voice Agent
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-1 font-normal">
          Have a natural conversation with your AI assistant
        </p>
      </div>

      {/* Central Glowing Microphone */}
      <div className="relative z-10 my-4 flex items-center justify-center">
        {/* Outer pulsating aura */}
        {isSessionActive && (
          <div
            className={`absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr ${statusInfo.glowColor} blur-2xl transition-all duration-300 pointer-events-none`}
            style={{
              transform: `scale(${1 + amplitude * 0.4})`,
            }}
          />
        )}

        {/* Concentric rings */}
        <div
          className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 ${statusInfo.ringColor} p-1.5 flex items-center justify-center transition-all duration-300`}
        >
          {/* Subtle inner animated ring */}
          {status === 'listening' && (
            <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping opacity-30 pointer-events-none" />
          )}

          <button
            id="central-microphone-btn"
            onClick={onToggleMic}
            aria-label={isSessionActive ? 'Stop conversation' : 'Start conversation'}
            className="w-full h-full rounded-full bg-gradient-to-b from-[#111a36] to-[#0a0f24] hover:from-[#172348] hover:to-[#0f1738] flex items-center justify-center text-white transition-transform active:scale-95 cursor-pointer shadow-inner relative group"
          >
            {status === 'thinking' ? (
              <Sparkles className="w-10 h-10 text-purple-300 animate-spin" />
            ) : isMuted ? (
              <MicOff className="w-10 h-10 text-rose-400" />
            ) : (
              <Mic className="w-10 h-10 text-cyan-300 group-hover:text-white transition-colors" />
            )}
          </button>
        </div>
      </div>

      {/* Status label & Subtext */}
      <div className="relative z-10 flex flex-col items-center mt-2">
        <span className="text-lg sm:text-xl font-bold text-white tracking-tight">
          {statusInfo.title}
        </span>
        <span className="text-xs sm:text-[13px] text-slate-400 mt-0.5">
          {statusInfo.sub}
        </span>
      </div>

      {/* Control Buttons: Mute, Stop, Settings */}
      <div className="relative z-10 flex items-center justify-center gap-6 sm:gap-8 mt-7">
        {/* Mute Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            id="control-mute-btn"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
              isMuted
                ? 'bg-rose-950/60 border-rose-600/80 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <span className="text-[11px] text-slate-400 font-medium">
            {isMuted ? 'Unmute' : 'Mute'}
          </span>
        </div>

        {/* Stop Button (Prominent Red) */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            id="control-stop-btn"
            onClick={onStop}
            aria-label="Stop conversation"
            className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 border-2 border-rose-400/80 text-white flex items-center justify-center shadow-[0_0_22px_rgba(244,63,94,0.55)] transition-all cursor-pointer active:scale-95"
          >
            <Square className="w-4 h-4 fill-white" />
          </button>
          <span className="text-[11px] text-slate-400 font-medium">Stop</span>
        </div>

        {/* Settings Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            id="control-settings-btn"
            onClick={onOpenSettings}
            aria-label="Open voice settings"
            className="w-11 h-11 rounded-full bg-slate-900/80 border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600 flex items-center justify-center transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-slate-400 font-medium">Settings</span>
        </div>
      </div>
    </div>
  );
};
