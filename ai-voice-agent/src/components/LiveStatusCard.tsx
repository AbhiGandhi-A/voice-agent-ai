import React from 'react';
import { Mic, Activity, Cpu, Sparkles, Volume2, Camera, Smile } from 'lucide-react';
import { VisionState, VoiceStatus } from '../types';

interface LiveStatusCardProps {
  voiceStatus: VoiceStatus;
  amplitude?: number;
  aiModel: string;
  ttsVoice: string;
  cameraEnabled?: boolean;
  visionState?: VisionState;
}

export const LiveStatusCard: React.FC<LiveStatusCardProps> = ({
  voiceStatus,
  amplitude = 0,
  aiModel,
  ttsVoice,
  cameraEnabled = false,
  visionState,
}) => {
  const isListening = voiceStatus === 'listening';
  const isSpeaking = voiceStatus === 'speaking';
  const isThinking = voiceStatus === 'thinking';
  const isActive = isListening || isSpeaking || isThinking;

  // Number of equalizer bars for the green waveform in screenshot
  const bars = [16, 28, 42, 60, 48, 80, 52, 95, 70, 85, 45, 65, 35, 50, 25, 18];

  const visionStatusLabel = !cameraEnabled
    ? 'Disabled'
    : visionState?.available
      ? 'Ready'
      : 'Offline';

  return (
    <div
      id="live-status-card"
      className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 p-3.5 backdrop-blur-xl shadow-lg flex flex-col gap-2.5"
    >
      <h3 className="text-sm font-semibold text-white tracking-tight">Live Status</h3>

      {/* Primary Status Banner matching screenshot */}
      <div className="rounded-xl bg-[#090f1d] border border-slate-800/90 p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isActive
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-xs font-semibold text-white capitalize">
              {voiceStatus === 'idle' ? 'Ready' : voiceStatus}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {isActive ? 'Microphone active' : 'Standby'}
          </span>
        </div>

        {/* Animated Green Waveform Equalizer */}
        <div className="h-5 flex items-center justify-center gap-1 px-1 overflow-hidden">
          {bars.map((height, idx) => {
            const dynamicScale = isActive
              ? Math.max(0.2, (height / 100) * (0.4 + amplitude * 1.8))
              : 0.15;
            return (
              <div
                key={idx}
                className="w-1 bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-full transition-all duration-150"
                style={{
                  height: `${Math.min(20, Math.max(3, dynamicScale * 20))}px`,
                  opacity: isActive ? 0.9 : 0.25,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Metrics List */}
      <div className="flex flex-col divide-y divide-slate-800/60 text-xs">
        {/* Microphone */}
        <div className="flex items-center justify-between py-2 text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <Mic className="w-3.5 h-3.5" />
            <span>Microphone</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            <span className="text-emerald-400">Active</span>
          </div>
        </div>

        {/* Camera */}
        <div className="flex items-center justify-between py-2 text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                cameraEnabled ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-500'
              }`}
            />
            <span className={cameraEnabled ? 'text-emerald-400' : 'text-slate-400'}>
              {cameraEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* Local Python Vision Service */}
        <div className="flex items-center justify-between py-2 text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-3.5 h-3.5" />
            <span>Vision (Local Python)</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                visionStatusLabel === 'Ready'
                  ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                  : visionStatusLabel === 'Offline'
                    ? 'bg-rose-500'
                    : 'bg-slate-500'
              }`}
            />
            <span
              className={
                visionStatusLabel === 'Ready'
                  ? 'text-emerald-400'
                  : visionStatusLabel === 'Offline'
                    ? 'text-rose-400'
                    : 'text-slate-400'
              }
            >
              {visionStatusLabel}
            </span>
          </div>
        </div>

        {/* Face & Expression (when camera active) */}
        {cameraEnabled && (
          <>
            <div className="flex items-center justify-between py-2 text-slate-300">
              <div className="flex items-center gap-2 text-slate-400">
                <Smile className="w-3.5 h-3.5" />
                <span>Face Detection</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    visionState?.faceDetected
                      ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                      : 'bg-amber-500'
                  }`}
                />
                <span className={visionState?.faceDetected ? 'text-emerald-400' : 'text-amber-300'}>
                  {visionState?.faceDetected
                    ? `Detected (${visionState.faceCount})`
                    : 'Not detected'}
                </span>
              </div>
            </div>

            {visionState?.faceDetected && visionState.expression !== 'none' && (
              <div className="flex items-center justify-between py-2 text-slate-300">
                <div className="flex items-center gap-2 text-slate-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Expression</span>
                </div>
                <span className="text-slate-200 font-medium capitalize">
                  {visionState.expression}
                  {visionState.confidence > 0 && ` (${Math.round(visionState.confidence * 100)}%)`}
                </span>
              </div>
            )}
          </>
        )}

        {/* Voice Activity */}
        <div className="flex items-center justify-between py-2 text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <Activity className="w-3.5 h-3.5" />
            <span>Voice Activity</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                amplitude > 0.1 || isListening
                  ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                  : 'bg-slate-500'
              }`}
            />
            <span className={amplitude > 0.1 || isListening ? 'text-emerald-400' : 'text-slate-400'}>
              {amplitude > 0.1 || isListening ? 'Detected' : 'Silent'}
            </span>
          </div>
        </div>

        {/* AI Model */}
        <div className="flex items-center justify-between py-2 text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Model</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span className="text-slate-200">{aiModel || 'Groq & Ollama'}</span>
          </div>
        </div>

        {/* Text-to-Speech */}
        <div className="flex items-center justify-between py-2 text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Text-to-Speech</span>
          </div>
          <span className="text-slate-200 font-medium">{ttsVoice}</span>
        </div>
      </div>
    </div>
  );
};

