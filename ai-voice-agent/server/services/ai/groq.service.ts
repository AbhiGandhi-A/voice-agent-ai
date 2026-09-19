import { env } from '../../config/env';
import { ApiError } from '../../middleware/error';
import { logger } from '../../utils/logger';

export interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GroqResult {
  text: string;
  model: string;
  latencyMs: number;
}

interface GroqResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export const groqService = {
  configured(): boolean {
    return Boolean(env.groqApiKey);
  },

  model(): string {
    return env.groqModel;
  },

  async generate(messages: GroqMessage[], options: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {}): Promise<GroqResult> {
    if (!env.groqApiKey) {
      throw new ApiError(503, 'groq_not_configured', 'Groq is not configured. Set GROQ_API_KEY on the backend.');
    }

    const startedAt = Date.now();
    logger.info('[GROQ] request started', { model: env.groqModel });
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? env.groqTimeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.groqApiKey}`,
        },
        body: JSON.stringify({
          model: env.groqModel,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 250,
        }),
        signal: controller.signal,
      });
      const data = (await response.json()) as GroqResponse;
      if (!response.ok || data.error) {
        logger.error('[GROQ] error', { status: response.status, error: data.error?.message || 'request failed' });
        throw new ApiError(502, 'groq_error', data.error?.message || 'Groq generation failed.');
      }

      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        logger.error('[GROQ] error', { status: response.status, error: 'empty response' });
        throw new ApiError(502, 'groq_empty', 'Groq returned an empty response.');
      }

      const latencyMs = Date.now() - startedAt;
      logger.info('[GROQ] response received', { model: data.model || env.groqModel, latencyMs });
      return { text, model: data.model || env.groqModel, latencyMs };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('[GROQ] timeout', { timeoutMs });
        throw new ApiError(504, 'groq_timeout', 'Groq request timed out.');
      }
      logger.error('[GROQ] error', { message: error instanceof Error ? error.message : 'request failed' });
      throw new ApiError(503, 'groq_unavailable', 'Groq is unavailable right now.');
    } finally {
      clearTimeout(timer);
    }
  },
};
