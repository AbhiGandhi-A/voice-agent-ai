import React, { useEffect, useState } from 'react';
import { Network, ShoppingBag, Database, PhoneCall, Cpu, Volume2, Shield, AlertTriangle } from 'lucide-react';
import { fetchHealth, HealthResponse } from '../lib/api';

export const IntegrationsView: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((h) => {
        if (active) setHealth(h);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const sttOk = health?.stt && health.stt.status !== 'disconnected' && health.stt.status !== 'not_configured';
  const ttsOk = health?.tts && health.tts.status !== 'disconnected' && health.tts.status !== 'not_configured';

  const integrations = [
    {
      title: 'Twilio / Telnyx Trunk',
      category: 'Telephony',
      description:
        'Bridges inbound/outbound phone lines directly to AI voice agents via provider webhooks and media streaming.',
      status: health
        ? health.telephony.configured
          ? `Configured (${health.telephony.provider})`
          : 'Not configured'
        : 'Checking…',
      icon: PhoneCall,
      enabled: Boolean(health?.telephony.configured),
      banner: health && !health.telephony.configured ? health.telephony.details || 'Set TELEPHONY_PROVIDER and credentials in .env.' : undefined,
    },
    {
      title: 'Ollama Engine',
      category: 'Language AI',
      description: 'Local LLM server running on localhost:11434 for chat, summaries, and tool calls.',
      status: health?.ai?.available
        ? `Active (${health.ai.model || 'model loaded'})`
        : 'Not reachable',
      icon: Cpu,
      enabled: Boolean(health?.ai?.available),
      banner: health && !health.ai?.available ? 'Start Ollama, then pull the configured model.' : undefined,
    },
    {
      title: 'Whisper STT',
      category: 'Voice-to-Text',
      description: 'Automatic speech recognition driven by local Whisper when configured.',
      status: health?.stt?.details ?? 'Checking…',
      icon: Shield,
      enabled: Boolean(sttOk),
    },
    {
      title: 'Piper / Kokoro TTS',
      category: 'Speech Synthesis',
      description: 'Neural speech synthesis served locally when configured.',
      status: health?.tts?.details ?? 'Checking…',
      icon: Volume2,
      enabled: Boolean(ttsOk),
    },
    {
      title: 'Shopify Store Integration',
      category: 'Tool Calling / E-Commerce',
      description: 'Define tool-calling routes (order tracking, shipping, refunds) before enabling this connector.',
      status: 'Not configured',
      icon: ShoppingBag,
      enabled: false,
    },
    {
      title: 'Supabase Database',
      category: 'Data Storage',
      description:
        'Postgres-backed persistence for conversations, transcripts, recording metadata, and the contact directory.',
      status: health
        ? health.database.connected
          ? 'Connected'
          : 'Not configured'
        : 'Checking…',
      icon: Database,
      enabled: Boolean(health?.database.connected),
      banner: !health?.database.connected ? 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.' : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Ecosystem & Integrations</h2>
        <p className="text-xs text-slate-400 mt-1">
          Connect your self-hosted voice stack to business systems and open-source models. Status is live from the server.
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
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                    item.enabled
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {item.enabled ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                  )}
                  {item.enabled ? 'Active' : 'Awaiting config'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">
                  {item.category}
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">{item.title}</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.description}</p>
              </div>

              {item.banner && (
                <div className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                  {item.banner}
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <span className={`font-mono ${item.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>{item.status}</span>
                <button
                  onClick={() => alert(`${item.title}: ${item.status}${item.banner ? ' — ' + item.banner : ''}`)}
                  className="text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Configure →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {loaded && !health && (
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Network className="w-3.5 h-3.5" />
          Could not reach the backend to check statuses. Start the server with `npm run dev`.
        </div>
      )}
    </div>
  );
};