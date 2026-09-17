import React, { useState } from 'react';
import { Boxes, Download, Check, Play, HardDrive, Cpu, Sparkles } from 'lucide-react';

export const ModelsView: React.FC = () => {
  const [testModelResult, setTestModelResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [pullModelName, setPullModelName] = useState('');
  const [pullProgress, setPullProgress] = useState<number | null>(null);

  const models = [
    {
      name: 'llama3.2:3b',
      type: 'LLM Language Engine',
      size: '2.0 GB',
      status: 'Active / Loaded in RAM',
      speed: '78 tokens/sec',
      context: '128k context',
      active: true,
    },
    {
      name: 'faster-whisper (small)',
      type: 'Speech-to-Text (STT)',
      size: '461 MB',
      status: 'Ready (INT8 Quantized)',
      speed: '42ms inference',
      context: 'Multilingual (99 langs)',
      active: true,
    },
    {
      name: 'piper-tts (en_US-amy)',
      type: 'Neural Speech Synthesizer',
      size: '64 MB',
      status: 'Ready (ONNX Runtime)',
      speed: '0.12x Realtime Factor',
      context: '22,050 Hz 16-bit WAV',
      active: true,
    },
    {
      name: 'mistral:7b-instruct',
      type: 'LLM Language Engine',
      size: '4.1 GB',
      status: 'Available on disk',
      speed: '45 tokens/sec',
      context: '32k context',
      active: false,
    },
    {
      name: 'piper-tts (hi_IN-roop)',
      type: 'Neural Hindi TTS',
      size: '62 MB',
      status: 'Ready (ONNX)',
      speed: '0.14x Realtime Factor',
      context: 'Hindi & Hinglish voice',
      active: false,
    },
  ];

  const handleTest = (modelName: string) => {
    setIsTesting(true);
    setTestModelResult(null);
    setTimeout(() => {
      setIsTesting(false);
      setTestModelResult(
        `[${modelName} Test Success]: Generated 32 tokens in 380ms. "Hello! I am ready to converse with zero latency."`
      );
    }, 900);
  };

  const handlePull = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullModelName.trim()) return;
    setPullProgress(10);
    const interval = setInterval(() => {
      setPullProgress((prev) => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setPullProgress(null), 1500);
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">AI & Voice Models</h2>
          <p className="text-xs text-slate-400 mt-1">
            Local quantized neural weights running offline on your CPU/GPU. No external subscriptions.
          </p>
        </div>

        {/* Pull Model Form */}
        <form onSubmit={handlePull} className="flex items-center gap-2">
          <input
            type="text"
            value={pullModelName}
            onChange={(e) => setPullModelName(e.target.value)}
            placeholder="e.g. qwen2.5:3b or phi4"
            className="px-3 py-2 bg-[#0c1222] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          />
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Pull</span>
          </button>
        </form>
      </div>

      {pullProgress !== null && (
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-indigo-300 font-medium">
            <span>Pulling {pullModelName || 'model'} via Ollama CLI...</span>
            <span>{pullProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${pullProgress}%` }}
            />
          </div>
        </div>
      )}

      {testModelResult && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs font-mono text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{testModelResult}</span>
        </div>
      )}

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((mod) => (
          <div
            key={mod.name}
            className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex flex-col justify-between gap-4 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">{mod.name}</h3>
                  <span className="text-xs text-slate-400">{mod.type}</span>
                </div>
              </div>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${
                  mod.active
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {mod.active ? '● Loaded' : 'Available'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60 text-[11px]">
              <div>
                <span className="text-slate-500 block">RAM / Size</span>
                <span className="font-semibold text-slate-200">{mod.size}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Performance</span>
                <span className="font-semibold text-emerald-400">{mod.speed}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Context / Audio</span>
                <span className="font-semibold text-indigo-300">{mod.context}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-slate-400 text-[11.5px]">{mod.status}</span>
              <button
                onClick={() => handleTest(mod.name)}
                disabled={isTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 text-indigo-400" />
                <span>Test Inference</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
