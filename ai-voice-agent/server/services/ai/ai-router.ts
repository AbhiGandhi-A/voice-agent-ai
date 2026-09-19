import { ApiError } from '../../middleware/error';
import { logger } from '../../utils/logger';
import { buildLanguageSystemInstruction, normalizeAssistantLanguage } from '../../../src/lib/language';
import { getCurrentTime, selectRealtimeTool, webSearch, RuntimeContext, WebSearchResult } from './realtime-tools';
import { groqService } from './groq.service';
import { ollamaService } from './ollama.service';

export type AiIntent = 'normal' | 'search' | 'current_time';

export interface AiRouteInput {
  message: string;
  language: string;
  systemPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  runtimeContext?: RuntimeContext;
  temperature?: number;
  maxTokens?: number;
}

export interface AiRouteResult {
  text: string;
  model: string;
  latencyMs: number;
  source: 'groq' | 'search_ollama' | 'current_time';
}

export interface AiRouterDependencies {
  groq: Pick<typeof groqService, 'generate'>;
  ollama: Pick<typeof ollamaService, 'generate'>;
  search: typeof webSearch;
}

const defaultDependencies: AiRouterDependencies = {
  groq: groqService,
  ollama: ollamaService,
  search: webSearch,
};

export function classifyAiIntent(message: string): AiIntent {
  const realtime = selectRealtimeTool(message);
  if (realtime === 'current_time') return 'current_time';
  if (realtime === 'web_search') return 'search';
  return 'normal';
}

export async function routeAiRequest(input: AiRouteInput, dependencies: AiRouterDependencies = defaultDependencies): Promise<AiRouteResult> {
  const intent = classifyAiIntent(input.message);
  if (intent === 'current_time') return currentTimeResponse(input);
  if (intent === 'search') return searchWithOllama(input, dependencies);

  const result = await dependencies.groq.generate(
    [
      { role: 'system', content: input.systemPrompt },
      ...input.history,
      { role: 'user', content: input.message },
    ],
    { temperature: input.temperature, maxTokens: input.maxTokens },
  );
  return { text: result.text, model: result.model, latencyMs: result.latencyMs, source: 'groq' };
}

async function searchWithOllama(input: AiRouteInput, dependencies: AiRouterDependencies): Promise<AiRouteResult> {
  let results: WebSearchResult[];
  try {
    results = await dependencies.search(input.message);
  } catch (error) {
    logger.error('[SEARCH] error', { message: error instanceof Error ? error.message : 'search failed' });
    throw new ApiError(502, 'search_unavailable', "I couldn't retrieve current information right now, so I won't guess.");
  }
  if (results.length === 0) {
    throw new ApiError(502, 'search_empty', "I couldn't find current search results, so I won't guess.");
  }

  const resolvedLanguage = normalizeAssistantLanguage(input.language);
  const resultText = results.map((result, index) => `${index + 1}. ${result.title}\nURL: ${result.url}\nSource: ${result.source}\nSnippet: ${result.snippet}`).join('\n\n');
  const searchPrompt = `${buildLanguageSystemInstruction(resolvedLanguage)}
You are analyzing real web-search results.
Use ONLY the supplied search results for claims about current information.
Do not invent facts, URLs, sources, or search results.
Summarize the results accurately.
If the search results disagree, explain the disagreement.
Respond in the user's active language.
Preserve useful source URLs.

USER QUESTION:
${input.message}

REAL WEB-SEARCH RESULTS:
${resultText}`;

  logger.info('[OLLAMA] search-analysis started', { resultCount: results.length });
  let analysis;
  try {
    analysis = await dependencies.ollama.generate(
      [{ role: 'system', content: searchPrompt }, { role: 'user', content: input.message }],
      { temperature: input.temperature, maxTokens: input.maxTokens },
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[OLLAMA] search-analysis error', { message: error instanceof Error ? error.message : 'analysis failed' });
    throw new ApiError(502, 'ollama_search_analysis_failed', 'Search results were found, but Ollama could not analyze them.');
  }
  logger.info('[OLLAMA] response received', { latencyMs: analysis.latencyMs });

  const sources = results.map((result) => `- ${result.title}: ${result.url}`).join('\n');
  return {
    text: `${analysis.text}\n\nSources:\n${sources}`,
    model: analysis.model,
    latencyMs: analysis.latencyMs,
    source: 'search_ollama',
  };
}

function currentTimeResponse(input: AiRouteInput): AiRouteResult {
  const startedAt = Date.now();
  const current = getCurrentTime(input.runtimeContext?.timezone, input.runtimeContext?.currentTime ? new Date(input.runtimeContext.currentTime) : new Date());
  const language = normalizeAssistantLanguage(input.language);
  const text = language === 'hi'
    ? `आज ${current.dayOfWeek}, ${current.date} है और समय ${current.time} है।`
    : language === 'gu'
      ? `આજે ${current.dayOfWeek}, ${current.date} છે અને સમય ${current.time} છે.`
      : language === 'hinglish'
        ? `Aaj ${current.dayOfWeek}, ${current.date} hai aur time ${current.time} hai.`
        : `Today is ${current.dayOfWeek}, ${current.date}, and the time is ${current.time}.`;
  return { text, model: 'runtime-clock', latencyMs: Date.now() - startedAt, source: 'current_time' };
}
