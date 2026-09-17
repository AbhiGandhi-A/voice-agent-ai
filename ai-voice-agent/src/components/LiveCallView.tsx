import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  Download,
  Bot,
  UserCheck,
  ChevronLeft,
  Wrench,
  PhoneForwarded,
  Send,
} from 'lucide-react';
import { Call, ControlMode } from '../types';

interface LiveCallViewProps {
  call: Call;
  onEndCall: (callId: string, durationStr: string) => void;
  onBack: () => void;
  onSendMessage?: (text: string) => void;
}

export const LiveCallView: React.FC<LiveCallViewProps> = ({
  call,
  onEndCall,
  onBack,
  onSendMessage,
}) => {
  const [controlMode, setControlMode] = useState<ControlMode>(
    call.aiStatus === 'Human takeover' ? 'human' : 'ai'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isRecording, setIsRecording] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [inputText, setInputText] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [call.messages]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTakeOver = () => {
    setControlMode((prev) => (prev === 'ai' ? 'human' : 'ai'));
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !onSendMessage) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Top Bar with Back and Main Call Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Back to Calls"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              <h2 className="text-xl font-bold text-white tracking-tight">Active Live Call</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                {formatTimer(seconds)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Connected with {call.contactName} ({call.phoneNumber})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
              controlMode === 'ai'
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                : 'bg-amber-950/80 text-amber-300 border-amber-800'
            }`}
          >
            {controlMode === 'ai' ? <Bot className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
            {controlMode === 'ai' ? 'AI Voice Agent in Control' : 'Human Agent Takeover Active'}
          </span>
        </div>
      </div>

      {/* Human Takeover Notice Banner */}
      {controlMode === 'human' && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-600/50 flex items-center justify-between text-xs text-amber-200 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Supervisor Mode:</strong> AI generation paused. You are communicating directly with caller.
            </span>
          </div>
          <button
            onClick={() => setControlMode('ai')}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all"
          >
            Hand Back to AI
          </button>
        </div>
      )}

      {/* Main Grid: Call Transcript & Live Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Customer ↔ AI Agent Transcript */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 p-5 backdrop-blur-xl shadow-lg flex flex-col gap-4 min-h-[480px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs">
                  TEL
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{call.contactName}</h3>
                  <span className="text-xs font-mono text-slate-400">{call.phoneNumber}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">Live Call Audio Channel</span>
              </div>
            </div>

            {/* Transcript Messages */}
            <div className="flex flex-col gap-3.5 flex-1 overflow-y-auto pr-1 max-h-[420px]">
              {call.messages.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Call started. AI assistant greeting connected...
                </div>
              ) : (
                call.messages.map((msg) => {
                  const isCustomer = msg.role === 'user';
                  return (
                    <div key={msg.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`font-semibold ${
                            isCustomer ? 'text-blue-400' : 'text-purple-400'
                          }`}
                        >
                          {isCustomer ? 'CALLER / YOU' : 'AI VOICE AGENT'}
                        </span>
                        <span className="text-slate-500 font-mono">{msg.timestamp}</span>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                          isCustomer
                            ? 'bg-[#0f172a] border-slate-800 text-slate-200'
                            : 'bg-[#121a30] border-indigo-900/40 text-slate-100 shadow'
                        }`}
                      >
                        <p>{msg.content}</p>

                        {/* Tool Call Box */}
                        {msg.toolCall && (
                          <div className="mt-3 p-2.5 rounded-xl bg-[#080d19] border border-indigo-800/50 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-indigo-400 text-[11px] font-semibold">
                              <div className="flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5" />
                                <span>Tool Execution</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 text-[10px] border border-indigo-800">
                                {msg.toolCall.status}
                              </span>
                            </div>
                            {msg.toolCall.result && (
                              <span className="text-[11px] font-mono text-emerald-300 pl-5">
                                {msg.toolCall.result}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Live Message Input for Caller Simulation / Human Operator */}
            {onSendMessage && (
              <form onSubmit={handleSend} className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={controlMode === 'human' ? 'Type as operator...' : 'Speak or type as caller into the call...'}
                  className="flex-1 bg-[#080d19] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer"
                  title="Send into live call"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Col: Call Overview, Recording & Controls */}
        <div className="flex flex-col gap-4">
          {/* Recording Card */}
          <div className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 p-4 backdrop-blur-xl shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-500'}`} />
                <span className="text-xs font-bold text-white">Call Recording</span>
              </div>
              <span className="text-xs font-mono text-slate-400">{formatTimer(seconds)}</span>
            </div>

            {/* Audio Waveform */}
            <div className="h-10 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-center gap-1 px-3">
              {[20, 45, 70, 90, 60, 30, 85, 95, 40, 60, 80, 50, 30, 75, 55, 35].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-gradient-to-t from-indigo-500 to-cyan-400 rounded-full animate-pulse"
                  style={{ height: `${Math.max(6, (h / 100) * 32)}px` }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setIsRecording(!isRecording)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 hover:text-white"
              >
                {isRecording ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isRecording ? 'Pause Recording' : 'Resume'}</span>
              </button>
            </div>
          </div>

          {/* Quick Caller Details */}
          <div className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 p-4 backdrop-blur-xl shadow-lg flex flex-col gap-2.5 text-xs">
            <span className="text-xs font-semibold text-white">Caller Details</span>
            <div className="flex justify-between text-slate-400">
              <span>Customer:</span>
              <span className="text-white font-medium">{call.contactName}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Phone Number:</span>
              <span className="text-white font-mono">{call.phoneNumber}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Call State:</span>
              <span className="text-emerald-400 font-medium">In Progress</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Started:</span>
              <span className="text-slate-300">{call.startedAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Call Controls */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/95 border border-slate-800 backdrop-blur-2xl shadow-2xl flex flex-wrap items-center justify-center sm:justify-between gap-4 sticky bottom-4 z-20">
        <div className="flex items-center gap-3">
          {/* Mute */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all ${
              isMuted
                ? 'bg-rose-950/60 border-rose-600 text-rose-300'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Hold */}
          <button
            onClick={() => setIsOnHold(!isOnHold)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all ${
              isOnHold
                ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Pause className="w-4 h-4" />
            <span>{isOnHold ? 'Unhold' : 'Hold'}</span>
          </button>

          {/* Take Over (Prominent) */}
          <button
            onClick={handleTakeOver}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-md ${
              controlMode === 'human'
                ? 'bg-amber-500 border-amber-400 text-slate-950'
                : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
            }`}
          >
            {controlMode === 'human' ? <Bot className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            <span>{controlMode === 'human' ? 'Return to AI' : 'Take Over Call'}</span>
          </button>
        </div>

        {/* End Call (Prominent Red) */}
        <button
          onClick={() => onEndCall(call.id, formatTimer(seconds))}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(244,63,94,0.5)] transition-all cursor-pointer active:scale-95"
        >
          <PhoneOff className="w-4 h-4 fill-white" />
          <span>End Call</span>
        </button>
      </div>
    </div>
  );
};
