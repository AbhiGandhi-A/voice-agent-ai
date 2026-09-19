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
  source: string;
}

const SEARCH_INTENT = /\b(find|search|look up|lookup|research|google|web search|search the web|retrieve|latest|recent|news|current price|current ceo|best .{0,30}(?:courses|hotels|restaurants|products)|what happened today)\b/i;
const CURRENT_TIME_INTENT = /\b(what(?:'s| is)?\s+(?:the\s+)?(?:date|day|time)|which date|what day|what time|today(?:'s| is the)? date|tomorrow(?:'s| is the)? date|yesterday(?:'s| was the)? date)\b|(?:आज|તારીખ|દિવસ|સમય).*(?:कौन|क्या|છે|શું|આજે|today|date|day|time)/i;
const FINGER_INTENT =
  /\b(how many (?:fingers|hands)|count (?:my |the )?(?:fingers|hands)|can you count (?:my |the )?(?:fingers|hands)|how many fingers (?:am i|can you|are|do you|holding|showing)|(?:fingers|hands) (?:am i|can you|holding up|showing)|what hand gesture|see my (?:fingers|hands|thumb|palm)|can you see (?:my )?(?:fingers|hands|thumb|palm)|do you see (?:my )?(?:fingers|hands|thumb|palm))\b|(?:उंगलियां|उंगली|उंगलियों|आંગળી|આંગળીઓ|હાથ|हाथ|finger|fingers|hand|hands|thumb|palm).*(?:कितनी|कितने|કેટલી|ગણો|गिनो|दिख|દેખ|count|many|holding|showing|visible|show|see|gesture)/i;
const VISION_INTENT =
  /\b(can you see (?:me|my face|my expression|anything|anyone|who)|do you see (?:me|my face|my expression|anything|anyone|who)|are you able to see (?:me|anything)|are you seeing (?:me|my face)|see my (?:face|expression|emotion)|how do i look|what is my (?:facial )?expression|what emotion (?:am i|is my)|am i (?:smiling|happy|sad|visible|in front)|am i looking at|look at me|check my (?:face|expression)|what do you see|what can you see|describe what you see|tell me what you see|who is in front of (?:you|the camera)|is someone in front of (?:you|the camera)|is anyone in front of (?:you|the camera)|is (?:my |the )?camera (?:on|working)|is camera (?:on|working)|expression|facial expression|emotion|vision)\b|(?:देख|દેખ|જોઈ|હાવભાવ|ભાવ|મુખ|मुस्कुरा|हस|face|camera|vision|chehra|chehro|dikh|expression|emotion).*(?:सकते|શકો|છો|हो|है|શું|क्या|चेहरा|ચહેરો|visible|lag|kaisa|kem|kaise|batao|bolo|kaho|hai|che|chhe|\?)/i;

export function isFingerQuery(message: string): boolean {
  return FINGER_INTENT.test(message) || /\b(finger|fingers|hand|hands|thumb|thumbs|palm|pinky|ungli|ungliya|aangli|aangliyo)\b/i.test(message);
}

export function isVisionQuery(message: string): boolean {
  if (SEARCH_INTENT.test(message)) return false;
  return VISION_INTENT.test(message) || FINGER_INTENT.test(message) || isFingerQuery(message);
}

export function selectRealtimeTool(message: string): 'current_time' | 'web_search' | 'vision' | null {
  if (isVisionQuery(message)) return 'vision';
  if (CURRENT_TIME_INTENT.test(message) && !SEARCH_INTENT.test(message)) return 'current_time';
  return SEARCH_INTENT.test(message) ? 'web_search' : null;
}

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

export function parseMemoryCommand(message: string): { action: 'remember' | 'forget'; text: string } | null {
  const remember = message.match(/^\s*(?:remember(?:\s+that|\s+this)?|don't forget(?:\s+that)?|save this)\s*[:,-]?\s*(.+)$/i);
  if (remember) return { action: 'remember', text: remember[1].trim() };
  const forget = message.match(/^\s*(?:forget(?:\s+that)?|delete that memory)\s*[:,-]?\s*(.+)$/i);
  if (forget) return { action: 'forget', text: forget[1].trim() };
  return null;
}

export async function webSearch(query: string): Promise<WebSearchResult[]> {
  const normalizedQuery = normalizeSearchQuery(query);
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(normalizedQuery)}&format=json&no_html=1&skip_disambig=1`;
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
    results.push({ title: data.AbstractSource || query, url: data.AbstractURL, snippet: data.AbstractText, source: data.AbstractSource || 'DuckDuckGo' });
  }
  for (const topic of data.RelatedTopics ?? []) {
    const nested = topic.Topics ?? [topic];
    for (const item of nested) {
      if (item.Text && item.FirstURL) results.push({ title: item.Text.split(' - ')[0], url: item.FirstURL, snippet: item.Text, source: 'DuckDuckGo' });
      if (results.length >= 5) return results;
    }
  }
  return results;
}

function normalizeSearchQuery(query: string): string {
  return query
    .replace(/^\s*(?:find|search|look up|lookup|research|google|retrieve)\s+/i, '')
    .replace(/^\s*(?:what(?:'s| is)?\s+)?(?:the\s+)?(?:latest|current|recent)\s+(?:information|news|details)\s+(?:about|on)\s+/i, '')
    .replace(/^\s*(?:the\s+)?(?:information|details)\s+(?:about|on)\s+/i, '')
    .trim();
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}
