import { ApiError } from '../../middleware/error';
import { logger } from '../../utils/logger';
import { buildLanguageSystemInstruction, normalizeAssistantLanguage } from '../../../src/lib/language';
import { getCurrentTime, selectRealtimeTool, webSearch, RuntimeContext, WebSearchResult, isFingerQuery } from './realtime-tools';
import { groqService } from './groq.service';
import { ollamaService } from './ollama.service';
import { visionService } from '../vision/vision.service';

export type AiIntent = 'normal' | 'search' | 'current_time' | 'vision';

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
  source: 'groq' | 'search_ollama' | 'current_time' | 'vision';
}

export interface AiRouterDependencies {
  groq: Pick<typeof groqService, 'generate'>;
  ollama: Pick<typeof ollamaService, 'generate'>;
  search: typeof webSearch;
  vision: Pick<typeof visionService, 'getLatestState' | 'checkHealth'>;
}

const defaultDependencies: AiRouterDependencies = {
  groq: groqService,
  ollama: ollamaService,
  search: webSearch,
  vision: visionService,
};

export function classifyAiIntent(message: string): AiIntent {
  const realtime = selectRealtimeTool(message);
  if (realtime === 'vision') return 'vision';
  if (realtime === 'current_time') return 'current_time';
  if (realtime === 'web_search') return 'search';
  return 'normal';
}

export async function routeAiRequest(input: AiRouteInput, dependencies: Partial<AiRouterDependencies> = defaultDependencies): Promise<AiRouteResult> {
  const deps: AiRouterDependencies = { ...defaultDependencies, ...dependencies };
  logger.info('[AI ROUTER] request received', { messageLength: input.message.length });
  const intent = classifyAiIntent(input.message);
  logger.info('[AI ROUTER] intent = ' + (intent === 'current_time' ? 'datetime' : intent));
  if (intent === 'vision') {
    logger.info('[AI ROUTER] provider = local-python-vision');
    logger.info('[AI ROUTER] executing provider = local-python-vision');
    return visionResponse(input, deps);
  }
  if (intent === 'current_time') {
    logger.info('[AI ROUTER] provider = runtime-clock');
    logger.info('[AI ROUTER] executing provider = runtime-clock');
    return currentTimeResponse(input);
  }
  if (intent === 'search') {
    logger.info('[AI ROUTER] provider = web-search -> ollama-analysis');
    return searchWithOllama(input, deps);
  }

  logger.info('[AI ROUTER] provider = groq');
  logger.info('[AI ROUTER] executing provider = groq');
  const result = await deps.groq.generate(
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
  logger.info('[AI ROUTER] executing provider = web-search');
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
  logger.info('[AI ROUTER] executing provider = ollama-analysis');
  let analysis;
  try {
    analysis = await dependencies.ollama.generate(
      [{ role: 'system', content: searchPrompt }, { role: 'user', content: input.message }],
      { temperature: input.temperature, maxTokens: input.maxTokens, timeoutMs: 60_000 },
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

async function visionResponse(input: AiRouteInput, dependencies: AiRouterDependencies): Promise<AiRouteResult> {
  const startedAt = Date.now();
  const visionState = dependencies.vision.getLatestState();
  const health = await dependencies.vision.checkHealth().catch(() => ({ available: false, status: 'offline' as const, provider: 'local-python', model: '', device: 'cpu' }));
  const language = normalizeAssistantLanguage(input.language);
  const fingerQuery = isFingerQuery(input.message);

  // 1. Camera is OFF
  if (!visionState.cameraActive) {
    let text = 'The camera is currently turned off, so I cannot see you right now. Please enable the camera in Settings to turn on vision.';
    if (fingerQuery) {
      text = language === 'hi'
        ? 'अभी कैमरा बंद है, इसलिए मैं आपकी उंगलियों को नहीं देख सकता।'
        : language === 'gu'
          ? 'હમણાં કેમેરો બંધ છે, તેથી હું તમારી આંગળીઓ જોઈ શકતો નથી.'
          : language === 'hinglish'
            ? 'Abhi camera band hai, isliye main aapki fingers detect nahi kar sakta.'
            : "The camera is currently off, so I can't detect your fingers.";
    } else {
      text = language === 'hi'
        ? 'अभी कैमरा बंद है, इसलिए मैं आपको नहीं देख सकता। विज़न चालू करने के लिए सेटिंग्स में कैमरा ऑन करें।'
        : language === 'gu'
          ? 'હમણાં કેમેરો બંધ છે, તેથી હું તમને જોઈ શકતો નથી. વિઝન શરૂ કરવા માટે સેટિંગ્સમાં કેમેરો ચાલુ કરો.'
          : language === 'hinglish'
            ? 'Abhi camera band hai, isliye main aapko nahi dekh sakta. Vision enable karne ke liye Settings mein camera on karein.'
            : 'The camera is currently turned off, so I cannot see you right now. Please enable the camera in Settings to turn on vision.';
    }

    return { text, model: 'local-vision-router', latencyMs: Date.now() - startedAt, source: 'vision' };
  }

  // 2. Vision Service is Offline
  if (!health.available && !visionState.serviceAvailable) {
    const text = language === 'hi'
      ? 'कैमरा चालू है, लेकिन लोकल विज़न सेवा अभी उपलब्ध नहीं है।'
      : language === 'gu'
        ? 'કેમેરો ચાલુ છે, પરંતુ લોકલ વિઝન સેવા અત્યારે ઉપલબ્ધ નથી.'
        : language === 'hinglish'
          ? 'Camera on hai, lekin local vision service abhi offline hai.'
          : 'The camera is on, but the local vision analysis service is currently offline.';

    return { text, model: 'local-vision-router', latencyMs: Date.now() - startedAt, source: 'vision' };
  }

  // 2.5 Stale Vision Result Protection (older than 10 seconds)
  const isStale = visionState.lastUpdated > 0 && (Date.now() - visionState.lastUpdated) > 10000;
  if (isStale) {
    const text = language === 'hi'
      ? 'कैमरा चालू है, लेकिन मुझे हाल ही का विज़न डेटा प्राप्त नहीं हो रहा है।'
      : language === 'gu'
        ? 'કેમેરો ચાલુ છે, પરંતુ મને તાજો વિઝન ડેટા મળી રહ્યો નથી.'
        : language === 'hinglish'
          ? 'Camera on hai, lekin latest vision data available nahi hai.'
          : 'The camera is on, but the latest visual data is currently unavailable or stale.';

    return { text, model: 'local-vision-router', latencyMs: Date.now() - startedAt, source: 'vision' };
  }

  // 3. Camera is ON, but no face detected
  // ─── 3. Finger Counting Branch ─────────────────────────────────────────
  if (fingerQuery) {
    if (!visionState.handDetected || (visionState.handCount ?? 0) === 0) {
      const text = language === 'hi'
        ? 'मुझे वर्तमान कैमरा फ्रेम में कोई हाथ दिखाई नहीं दे रहा है।'
        : language === 'gu'
          ? 'મને વર્તમાન કેમેરા ફ્રેમમાં કોઈ હાથ દેખાતો નથી.'
          : language === 'hinglish'
            ? 'Mujhe current camera frame mein koi hand detect nahi ho raha hai.'
            : "I don't detect a visible hand in the current camera frame.";

      return { text, model: 'local-python-vision', latencyMs: Date.now() - startedAt, source: 'vision' };
    }

    const handCount = visionState.handCount || 1;
    const fingerCount = visionState.fingerCount || 0;

    let text = '';
    if (handCount > 1) {
      text = language === 'hi'
        ? `मैं दोनों हाथों में कुल ${fingerCount} उंगलियां देख पा रहा हूँ।`
        : language === 'gu'
          ? `હું બંને હાથમાં કુલ ${fingerCount} આંગળીઓ જોઈ શકું છું.`
          : language === 'hinglish'
            ? `Main dono haathon mein total ${fingerCount} fingers detect kar raha hoon.`
            : `I can detect ${fingerCount} visible fingers across both hands.`;
    } else {
      text = language === 'hi'
        ? `मैं ${fingerCount} उंगली/उंगलियां देख पा रहा हूँ।`
        : language === 'gu'
          ? `હું ${fingerCount} આંગળીઓ જોઈ શકું છું.`
          : language === 'hinglish'
            ? `Main ${fingerCount} finger${fingerCount === 1 ? '' : 's'} detect kar raha hoon.`
            : `I can detect ${fingerCount} visible finger${fingerCount === 1 ? '' : 's'}.`;
    }

    return { text, model: 'local-python-vision', latencyMs: Date.now() - startedAt, source: 'vision' };
  }

  // ─── 4. Face & Expression Branch ───────────────────────────────────────
  if (!visionState.faceDetected || visionState.faceCount === 0) {
    const text = language === 'hi'
      ? 'कैमरा चालू है, लेकिन मुझे अभी फ्रेम में कोई चेहरा दिखाई नहीं दे रहा है।'
      : language === 'gu'
        ? 'કેમેરો ચાલુ છે, પરંતુ મને અત્યારે ફ્રેમમાં કોઈ ચહેરો દેખાતો નથી.'
        : language === 'hinglish'
          ? 'Camera on hai, lekin mujhe frame mein koi face detect nahi ho raha hai.'
          : 'The camera is on, but I do not detect any face in the frame right now.';

    return { text, model: 'local-vision-router', latencyMs: Date.now() - startedAt, source: 'vision' };
  }

  // 4. Camera is ON and face is detected
  const expr = visionState.expression || 'neutral';
  const confPct = Math.round((visionState.confidence || 0) * 100);

  const text = language === 'hi'
    ? `हाँ, कैमरा चालू है और मैं आपको देख सकता हूँ। आपके चेहरे के भावों के आधार पर आपका expression ${expr}${confPct > 0 ? ` (${confPct}% विश्वास)` : ''} जैसा detect हुआ है।`
    : language === 'gu'
      ? `હા, કેમેરો ચાલુ છે અને હું તમને જોઈ શકું છું. તમારા ચહેરાના હાવભાવના આધારે તમારો expression ${expr}${confPct > 0 ? ` (${confPct}% વિશ્વાસ)` : ''} જેવો detect થયો છે.`
      : language === 'hinglish'
        ? `Haan, camera on hai aur main aapko dekh sakta hoon. Aapke chehre ke haav-bhaav ke mutabiq aapka expression ${expr}${confPct > 0 ? ` (${confPct}% confidence)` : ''} detect hua hai.`
        : `Yes, the camera is on and I can see you. Based on the vision model, your facial expression is detected as ${expr}${confPct > 0 ? ` (${confPct}% confidence)` : ''}.`;

  return { text, model: 'local-python-vision', latencyMs: Date.now() - startedAt, source: 'vision' };
}

