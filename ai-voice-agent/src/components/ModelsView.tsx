import React, { useState } from 'react';
import { Boxes, Download, Check, Play, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useAiModels } from '../hooks/useAiModels';

export const ModelsView: React.FC = () => {
  const { rows, available, loading, error, refresh, testModel, pull, remove } = useAiModels();
  const [testModelResult, setTestModelResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [pullModelName, setPullModelName] = useState('');
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  const handleTest = async (modelName: string) => {
    setIsTesting(modelName);
    setTestModelResult(null);
    const result = await testModel(modelName);
    setIsTesting(null);
    setTestModelResult(result);
  };

  const handlePull = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = pullModelName.trim();
    if (!name || pulling) return;
    setPulling(name);
    setPullError(null);
    try {
      await pull(name);
      setPullModelName('');
      setPullError(null);
    } catch (err) {
      setPullError(err instanceof Error ? err.message : `Failed to pull ${name}`);
    } finally {
      setPulling(null);
      void refresh();
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await remove(name);
    } catch {
      // keep grid as-is if removal fails
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">AI & Voice Models</h2>
          <p className="text-xs text-slate-400 mt-1">
            Local quantized neural weights served by Ollama. No external subscriptions.
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
            disabled={Boolean(pulling)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
          >
            {pulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{pulling ? 'Pulling…' : 'Pull'}</span>
          </button>
        </form>
      </div>

      {!available && !loading && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{error ?? 'Ollama is not reachable. Start it on localhost:11434, then refresh the list.'}</span>
        </div>
      )}

      {pullError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{pullError}</span>
        </div>
      )}

      {pulling && (
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-indigo-300 font-medium">
            <span>Pulling {pulling} via Ollama…</span>
            <span className="animate-pulse">Downloading</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full animate-pulse"
              style={{ width: `${50 + Math.random() * 20}%` }}
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
        {rows.map((mod) => (
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRemove(mod.name)}
                  disabled={!available}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer disabled:opacity-40"
                  title="Remove model from disk"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleTest(mod.name)}
                  disabled={isTesting !== null || isTesting === mod.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                >
                  {isTesting === mod.name ? (
                    <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3 text-indigo-400" />
                  )}
                  <span>Test Inference</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {!loading && rows.length === 0 && (
          <div className="md:col-span-2 p-8 rounded-2xl bg-[#0c1222]/60 border border-dashed border-slate-800 flex flex-col items-center gap-2 text-center">
            <Boxes className="w-8 h-8 text-slate-600" />
            <p className="text-sm text-slate-400">
              {available ? 'No models installed yet. Pull one above to get started.' : 'Ollama is not reachable — start it and models will appear here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};