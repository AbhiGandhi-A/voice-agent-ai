import React, { useState } from 'react';
import { Terminal, Copy, Check, BookOpen, ShieldCheck, CheckSquare, Phone, Server } from 'lucide-react';

export const HelpDocsView: React.FC = () => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const checklist = [
    'Complete dashboard UI matching visual reference (dark navy glassmorphic layout, waveform, mic hero)',
    'Zero paid APIs policy strictly enforced (Ollama + faster-whisper + Piper TTS)',
    'Real-time microphone capture with Web Audio API volume level & VAD',
    'Speech-to-text pipeline with streaming interim transcription',
    'Self-hosted LLM processing (llama3.2 / mistral / deepseek-r1)',
    'Text-to-speech audio streaming with sub-second turnaround',
    'Barge-in / speech interruption: instant AI stop when user starts speaking',
    'Natural continuous conversation turn-taking loop',
    'Persistent conversation history stored with transcripts & summaries',
    'Comprehensive Call Center Hub with inbound/outbound telephony oversight',
    'Interactive Phone Dialer with active call state simulation & keypad',
    'Supervisor Human Takeover mode with instant AI muting and control handoff',
    'Tool calling visualization (e.g., live order lookup, tracking status)',
    'Configurable system prompt, temperature, Whisper model, and Piper voice',
    'Real-time system diagnostics (Ollama, Whisper, Piper, Asterisk, SQLite)',
    'Browser SpeechRecognition with live interim transcription and authenticated Ollama chat',
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Documentation & Setup Guide</h2>
        <p className="text-xs text-slate-400 mt-1">
          Everything required to deploy, run, and scale your 100% self-hosted AI voice assistant and telephony agent.
        </p>
      </div>

      {/* 16-Point Verification Checklist */}
      <div className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-3">
          <CheckSquare className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">16-Point Implementation Checklist</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 rounded-xl bg-slate-900/40 border border-slate-800/50">
              <span className="w-4 h-4 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                ✓
              </span>
              <span className="text-slate-300 text-[11.5px] leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Ollama */}
      <div className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 backdrop-blur-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h3 className="text-sm font-bold text-white">Install & Run Ollama Locally</h3>
          </div>
          <button
            onClick={() => copyToClipboard('curl -fsSL https://ollama.com/install.sh | sh\nollama run llama3.2', 'ollama')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            {copiedCmd === 'ollama' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy Commands</span>
          </button>
        </div>
        <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
{`# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull & run recommended model (llama3.2 3B)
ollama run llama3.2`}
        </pre>
      </div>

      {/* Step 2: Node backend */}
      <div className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 backdrop-blur-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h3 className="text-sm font-bold text-white">Run the Node / Express Backend</h3>
          </div>
          <button
            onClick={() => copyToClipboard('npm install\nnpm run dev', 'python')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            {copiedCmd === 'python' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy Commands</span>
          </button>
        </div>
        <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
{`# Install dependencies
npm install

# Start the Node / Express backend on port 3000
npm run dev`}
        </pre>
      </div>

      {/* Step 3: Asterisk Telephony Integration */}
      <div className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 backdrop-blur-xl flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
            3
          </div>
          <h3 className="text-sm font-bold text-white">Asterisk 20+ SIP Trunk & AudioSocket Bridge</h3>
        </div>
        <p className="text-xs text-slate-400">
          In <code>/etc/asterisk/extensions.conf</code>, connect incoming calls to the Node media stream endpoint when telephony is configured:
        </p>
        <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto">
{`[from-pstn]
exten => _+91.,1,NoOp(Inbound AI Voice Call)
 same => n,Answer()
 same => n,AudioSocket(d9ef7dc5-2e70,127.0.0.1:9092)
 same => n,Hangup()`}
        </pre>
      </div>

      {/* Step 4: WebSocket Event Protocol */}
      <div className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 backdrop-blur-xl flex flex-col gap-3">
        <h3 className="text-sm font-bold text-white">Node Telephony Media WebSocket</h3>
        <div className="space-y-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            <span className="text-indigo-400 font-bold">Client → Server: </span>
            <code>{`{"type": "audio_chunk", "data": "<base64_pcm>"}`}</code>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            <span className="text-emerald-400 font-bold">Server → Client: </span>
            <code>{`{"type": "transcript", "role": "user", "text": "Hello", "isFinal": true}`}</code>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            <span className="text-purple-400 font-bold">Server → Client: </span>
            <code>{`{"type": "ai_audio_chunk", "audio": "<base64_wav_pcm>"}`}</code>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            <span className="text-rose-400 font-bold">Client → Server (Barge-in): </span>
            <code>{`{"type": "barge_in"}`}</code> (Immediately halts TTS playback and cancels ongoing LLM token generation)
          </div>
        </div>
      </div>
    </div>
  );
};
