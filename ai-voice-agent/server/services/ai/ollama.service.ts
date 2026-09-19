import { env } from '../../config/env';
import { ApiError } from '../../middleware/error';
import { logger } from '../../utils/logger';

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    parameter_size: string;
    quantization_level: string;
    family: string;
  };
}

export interface GenerateMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  stream?: boolean;
}

export interface GenerateResult {
  text: string;
  model: string;
  latencyMs: number;
  tokensPerSecond?: number;
  evalCount?: number;
}

interface OllamaGenerateResponse {
  model: string;
  response?: string;
  done?: boolean;
  eval_count?: number;
  total_duration?: number;
  error?: string;
  message?: { content: string };
  context?: number[];
}

const DEFAULT_TIMEOUT_MS = 30_000;
let availabilityCache = { available: false, checkedAt: 0 };

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError' ? 'Ollama request timed out.' : err instanceof Error ? err.message : 'Ollama connection failed.';
    throw new ApiError(err instanceof Error && err.name === 'AbortError' ? 504 : 503, 'ollama_unavailable', message);
  } finally {
    clearTimeout(timer);
  }
}

export const ollamaService = {
  baseUrl(): string {
    return env.ollamaBaseUrl;
  },

  configuredModel(): string {
    return env.ollamaModel;
  },

  /** Checks whether Ollama is reachable (cached briefly). */
  async isAvailable(force = false): Promise<boolean> {
    if (!force && Date.now() - availabilityCache.checkedAt < 5000) return availabilityCache.available;
    try {
      await fetchWithTimeout(`${env.ollamaBaseUrl}/api/tags`, { method: 'GET' }, 3000);
      availabilityCache = { available: true, checkedAt: Date.now() };
      return true;
    } catch {
      availabilityCache = { available: false, checkedAt: Date.now() };
      return false;
    }
  },

  /** Lists models actually installed in Ollama. */
  async listModels(): Promise<OllamaModel[]> {
    const res = await fetchWithTimeout(`${env.ollamaBaseUrl}/api/tags`, { method: 'GET' }, 5000);
    if (!res.ok) throw new ApiError(503, 'ollama_unavailable', 'Ollama returned an unsuccessful response.');
    const data = (await res.json()) as { models?: OllamaModel[] };
    const models = data.models ?? [];
    models.sort((a, b) => b.size - a.size);
    return models;
  },

  async modelCount(): Promise<number> {
    try {
      const models = await this.listModels();
      return models.length;
    } catch {
      return 0;
    }
  },

  /** Throws unless Ollama is running and has at least one model installed. */
  async ensureAvailable(): Promise<void> {
    const ok = await this.isAvailable();
    if (!ok) throw new ApiError(503, 'ollama_unavailable', 'Ollama unavailable. Start Ollama on ' + env.ollamaBaseUrl);
    const count = await this.modelCount();
    if (count === 0) throw new ApiError(503, 'ollama_no_model', 'Ollama has no models installed. Pull a model first. (OLLAMA MODEL NOT CONFIGURED)');
  },

  async resolveModel(preferred?: string): Promise<string> {
    if (preferred) return preferred;
    if (env.ollamaModel) return env.ollamaModel;
    const models = await this.listModels();
    if (models.length === 0) throw new ApiError(503, 'ollama_no_model', 'OLLAMA MODEL NOT CONFIGURED. Pull a model.');
    return models[0].name;
  },

  /**
   * Generates a response from the local Ollama model with context management.
   * The system prompt is always injected server-side and is never user-editable
   * through ordinary chat input.
   */
  async generate(messages: GenerateMessage[], options: GenerateOptions = {}): Promise<GenerateResult> {
    await this.ensureAvailable();
    const model = await this.resolveModel(env.ollamaModel || undefined);
    const startedAt = Date.now();

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 250,
      },
    };

    const res = await fetchWithTimeout(
      `${env.ollamaBaseUrl}/api/chat`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      options.timeoutMs ?? env.ollamaTimeoutMs
    );

    const latencyMs = Date.now() - startedAt;
    const data = (await res.json()) as OllamaGenerateResponse;
    if (!res.ok || data.error) {
      logger.error('ollama_error', { status: res.status, error: data.error });
      throw new ApiError(502, 'ollama_error', data.error || 'Ollama generation failed.');
    }

    const text = (data.message?.content ?? data.response ?? '').trim();
    if (!text) throw new ApiError(502, 'ollama_empty', 'Ollama returned an empty response.');

    const evalCount = data.eval_count ?? 0;
    return {
      text,
      model,
      latencyMs,
      tokensPerSecond: evalCount > 0 && latencyMs > 0 ? Math.round((evalCount / latencyMs) * 1000) : undefined,
      evalCount,
    };
  },

  /** Streams a chat completion. Yields incremental text chunks. */
  async generateStream(messages: GenerateMessage[], options: GenerateOptions = {}) {
    await this.ensureAvailable();
    const model = await this.resolveModel(env.ollamaModel || undefined);

    const body = {
      model,
      messages,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 250,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? env.ollamaTimeoutMs);
    const res = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok || !res.body) throw new ApiError(502, 'ollama_error', 'Ollama streaming failed.');
    const reader = res.body.getReader();

    return {
      model,
      async *[Symbol.asyncIterator]() {
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line) as OllamaGenerateResponse;
              if (chunk.error) throw new ApiError(502, 'ollama_error', chunk.error);
              if (chunk.message?.content) yield chunk.message.content;
            } catch (err) {
              if (err instanceof ApiError) throw err;
            }
          }
        }
      },
    };
  },

  /** Pulls a model, streaming progress deltas. Requires Ollama locally. */
  async pull(model: string) {
    await this.isAvailable(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    const res = await fetch(`${env.ollamaBaseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok || !res.body) throw new ApiError(502, 'ollama_error', `Failed to pull model ${model}.`);

    const reader = res.body.getReader();
    return {
      async *[Symbol.asyncIterator]() {
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line) as { status?: string; completed?: number; total?: number; error?: string };
              if (chunk.error) throw new ApiError(502, 'ollama_error', chunk.error);
              yield chunk;
            } catch (err) {
              if (err instanceof ApiError) throw err;
            }
          }
        }
      },
    };
  },

  async deleteModel(model: string): Promise<void> {
    const res = await fetchWithTimeout(
      `${env.ollamaBaseUrl}/api/delete`,
      { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) },
      10_000
    );
    if (!res.ok) throw new ApiError(502, 'ollama_error', `Failed to delete model ${model}.`);
  },
};