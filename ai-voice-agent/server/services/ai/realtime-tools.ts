export interface RuntimeContext {
  currentTime?: string;
  timezone?: string;
  localDateTime?: string;
}

export interface CurrentTimeResult {
  iso: string;
  localDateTime: string;
  date: string;
  time: string;
  dayOfWeek: string;
  timezone: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const REALTIME_WORDS = /\b(latest|today|current|recent|news|price|live|now|this week|this month|2026)\b/i;
const TIME_WORDS = /\b(date|day|time|today|tomorrow|yesterday|what time|which date)\b/i;

export function getCurrentTime(timezone?: string, now = new Date()): CurrentTimeResult {
  const resolvedTimezone = timezone && isValidTimezone(timezone)
    ? timezone
    : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedTimezone,
    dateStyle: 'long',
    timeStyle: 'short',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Intl.DateTimeFormat('en-US', { timeZone: resolvedTimezone, dateStyle: 'long' }).format(now);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: resolvedTimezone, timeStyle: 'short' }).format(now);
  const dayOfWeek = new Intl.DateTimeFormat('en-US', { timeZone: resolvedTimezone, weekday: 'long' }).format(now);
  return {
    iso: now.toISOString(),
    localDateTime: `${values.weekday ? `${values.weekday}, ` : ''}${date} ${time}`,
    date,
    time,
    dayOfWeek,
    timezone: resolvedTimezone,
  };
}

export function selectRealtimeTool(message: string): 'current_time' | 'web_search' | null {
  if (TIME_WORDS.test(message)) return 'current_time';
  return REALTIME_WORDS.test(message) ? 'web_search' : null;
}

export function parseMemoryCommand(message: string): { action: 'remember' | 'forget'; text: string } | null {
  const remember = message.match(/^\s*(?:remember(?:\s+that|\s+this)?|don't forget(?:\s+that)?|save this)\s*[:,-]?\s*(.+)$/i);
  if (remember) return { action: 'remember', text: remember[1].trim() };
  const forget = message.match(/^\s*(?:forget(?:\s+that)?|delete that memory)\s*[:,-]?\s*(.+)$/i);
  if (forget) return { action: 'forget', text: forget[1].trim() };
  return null;
}

export async function webSearch(query: string): Promise<WebSearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Web search returned ${response.status}.`);
  const data = (await response.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    AbstractSource?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Name?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
  };
  const results: WebSearchResult[] = [];
  if (data.AbstractText && data.AbstractURL) {
    results.push({ title: data.AbstractSource || query, url: data.AbstractURL, snippet: data.AbstractText });
  }
  for (const topic of data.RelatedTopics ?? []) {
    const nested = topic.Topics ?? [topic];
    for (const item of nested) {
      if (item.Text && item.FirstURL) results.push({ title: item.Text.split(' - ')[0], url: item.FirstURL, snippet: item.Text });
      if (results.length >= 5) return results;
    }
  }
  return results;
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}
