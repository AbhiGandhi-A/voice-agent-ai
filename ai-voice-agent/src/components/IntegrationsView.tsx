import React from 'react';
import { Network, CheckCircle2, ShoppingBag, Database, PhoneCall, Cpu, Volume2, Shield } from 'lucide-react';

export const IntegrationsView: React.FC = () => {
  const integrations = [
    {
      title: 'Asterisk PBX / VoIP Trunk',
      category: 'Telephony',
      description: 'Bridges inbound/outbound phone lines directly to AI voice agents via SIP trunking and ARI/AGI.',
      status: 'Connected (SIP trunk 01)',
      icon: PhoneCall,
      enabled: true,
    },
    {
      title: 'Ollama Engine',
      category: 'Language AI',
      description: 'Local LLM server running on localhost:11434 with llama3.2, mistral, and streaming completions.',
      status: 'Active (v0.5.8)',
      icon: Cpu,
      enabled: true,
    },
    {
      title: 'Faster-Whisper STT',
      category: 'Voice-to-Text',
      description: 'CTranslate2-optimized neural speech recognition running offline on CPU/GPU.',
      status: 'Model loaded (small)',
      icon: Shield,
      enabled: true,
    },
    {
      title: 'Piper Neural TTS',
      category: 'Speech Synthesis',
      description: 'Sub-100ms local neural voice generation outputting 22kHz 16-bit PCM audio.',
      status: 'Active (en_US-amy)',
      icon: Volume2,
      enabled: true,
    },
    {
      title: 'Shopify Store Integration',
      category: 'Tool Calling / E-Commerce',
      description: 'Enables voice agent to query live order tracking, shipping updates, and refund status.',
      status: 'Configured (Production)',
      icon: ShoppingBag,
      enabled: true,
    },
    {
      title: 'SQLite Database',
      category: 'Data Storage',
      description: 'Stores conversation history, transcripts, audio recordings metadata, and caller contact directory.',
      status: 'Synchronized (voice_agent.db)',
      icon: Database,
      enabled: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Ecosystem & Integrations</h2>
        <p className="text-xs text-slate-400 mt-1">
          Seamlessly connect your self-hosted telephony stack to business systems and open-source models.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex flex-col justify-between gap-4 backdrop-blur-xl"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  Active
                </span>
              </div>

              <div>
                <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">
                  {item.category}
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">{item.title}</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono text-emerald-400">{item.status}</span>
                <button
                  onClick={() => alert(`Configuring ${item.title}`)}
                  className="text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Configure →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
