import { describe, expect, it, vi } from 'vitest';
import { routeAiRequest } from '../server/services/ai/ai-router';

const input = (message: string, language = 'en') => ({
  message,
  language,
  systemPrompt: 'You are concise.',
  history: [],
});

describe('AI provider router', () => {
  it('uses Groq for normal tasks only', async () => {
    const groq = { generate: vi.fn().mockResolvedValue({ text: 'Hooks explained.', model: 'groq-model', latencyMs: 12 }) };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };

    const result = await routeAiRequest(input('Explain React hooks.'), { groq, search, ollama });

    expect(result.source).toBe('groq');
    expect(groq.generate).toHaveBeenCalledOnce();
    expect(search).not.toHaveBeenCalled();
    expect(ollama.generate).not.toHaveBeenCalled();
  });

  it('uses real search results as Ollama input for search tasks', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn().mockResolvedValue([{ title: 'React', url: 'https://react.dev', snippet: 'Current docs', source: 'Docs' }]);
    const ollama = { generate: vi.fn().mockResolvedValue({ text: 'React summary.', model: 'llama3.2:3b', latencyMs: 25 }) };

    const result = await routeAiRequest(input('Find the latest React version.'), { groq, search, ollama });

    expect(result.source).toBe('search_ollama');
    expect(search).toHaveBeenCalledOnce();
    expect(ollama.generate).toHaveBeenCalledOnce();
    expect(ollama.generate.mock.calls[0][0][0].content).toContain('https://react.dev');
    expect(groq.generate).not.toHaveBeenCalled();
  });

  it('uses the runtime clock without calling an AI provider', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };

    const result = await routeAiRequest({ ...input("What is today's date?"), runtimeContext: { currentTime: '2026-09-19T09:00:00.000Z', timezone: 'Asia/Kolkata' } }, { groq, search, ollama });

    expect(result.source).toBe('current_time');
    expect(result.text).toContain('September 19, 2026');
    expect(groq.generate).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(ollama.generate).not.toHaveBeenCalled();
  });

  it('routes Hindi date questions to the runtime clock', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn();
    const ollama = { generate: vi.fn() };

    const result = await routeAiRequest({ ...input('आज कौन सा दिन है?', 'hi'), runtimeContext: { currentTime: '2026-09-19T09:00:00.000Z', timezone: 'Asia/Kolkata' } }, { groq, search, ollama });

    expect(result.source).toBe('current_time');
    expect(groq.generate).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(ollama.generate).not.toHaveBeenCalled();
  });

  it('keeps search analysis in the active language', async () => {
    const groq = { generate: vi.fn() };
    const search = vi.fn().mockResolvedValue([{ title: 'AI News', url: 'https://example.com/news', snippet: 'News result', source: 'Example' }]);
    const ollama = { generate: vi.fn().mockResolvedValue({ text: 'समाचार का सारांश।', model: 'llama3.2:3b', latencyMs: 25 }) };

    await routeAiRequest(input("Find today's AI news and explain it in Hindi.", 'hi'), { groq, search, ollama });

    expect(ollama.generate.mock.calls[0][0][0].content).toContain('ACTIVE RESPONSE LANGUAGE: Hindi');
    expect(ollama.generate.mock.calls[0][0][0].content).toContain('https://example.com/news');
  });
});