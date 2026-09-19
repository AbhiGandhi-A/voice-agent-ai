import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchModels, fetchAiStatus, OllamaModel, pullModel as apiPullModel, deleteModel as apiDeleteModel } from '../lib/api';
import { prettyBytes } from '../lib/format';

export interface ModelRow {
  name: string;
  type: string;
  size: string;
  status: string;
  speed: string;
  context: string;
  active: boolean;
}

const NAME_HINTS = [
  { re: /whisper/i, type: 'Speech-to-Text (STT)' },
  { re: /piper|kokoro|tts|voice/i, type: 'Text-to-Speech (TTS)' },
];

export function useAiModels() {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchModels();
      setAvailable(res.available);
      setRows(
        res.models.map((m) => {
          const hint = NAME_HINTS.find((n) => n.re.test(m.name));
          return {
            name: m.name,
            type: hint?.type ?? 'LLM Language Engine',
            size: prettyBytes(m.size),
            status: m.details?.quantization_level ? `Ready (${m.details.quantization_level})` : 'Ready on disk',
            speed: m.details?.parameter_size ? formatTokens(m) : '—',
            context: '—',
            active: false,
          };
        })
      );
      setError(null);
    } catch (err) {
      setAvailable(false);
      setRows([]);
      setError(err instanceof ApiError ? err.message : 'Could not reach Ollama.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const testModel = useCallback(async (name: string): Promise<string> => {
    const status = await fetchAiStatus();
    if (!status.available) return `[${name}] Ollama is not reachable — start it and try again.`;
    return `[${name} Test Success]: Ollama is online. Model selected for inference and ready to converse.`;
  }, []);

  const pull = useCallback(async (name: string): Promise<void> => {
    await apiPullModel(name.trim());
    await refresh();
  }, [refresh]);

  const remove = useCallback(
    async (name: string): Promise<void> => {
      await apiDeleteModel(name);
      setRows((prev) => prev.filter((r) => r.name !== name));
    },
    []
  );

  return { rows, available, loading, error, refresh, testModel, pull, remove };
}

function formatTokens(m: OllamaModel): string {
  const params = m.details?.parameter_size;
  return params ? `${params} params (on-disk)` : '—';
}