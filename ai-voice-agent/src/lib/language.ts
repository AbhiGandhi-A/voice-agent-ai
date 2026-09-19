export type AssistantLanguage = 'en' | 'hi' | 'gu' | 'hinglish';

export const LANGUAGE_LABELS: Record<AssistantLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
  hinglish: 'Hinglish',
};

const GUJARATI_SCRIPT = /[\u0A80-\u0AFF]/;
const HINDI_SCRIPT = /[\u0900-\u097F]/;
const HINGLISH_KEYWORDS = /\b(bhai|aaj|kya|kaise|karna|karvanu|che|shu|hai|nahi|abhi|mein|aur|kal|ham|hum|mujhe|batao|bol|vado|chalo)/i;
const GUJARATI_KEYWORDS = /(gujarati|ગુજરાત|કેમ|આજે|શું|હું|હવે|મારી|તમે|તુ|બોલો|વાત|કરવું|મારા)/i;
const HINDI_KEYWORDS = /(hindi|हिंदी|हिन्दी|आप|कैसे|क्या|आज|तुम|मैं|बोलो|बात|करना|नमस्ते|कौन|मुझे|और|अब)/i;

export function normalizeAssistantLanguage(input?: string | null): AssistantLanguage {
  const value = (input ?? '').toLowerCase().trim();
  if (!value) return 'en';
  if (value === 'hi' || value.includes('hindi') || value.includes('हिंदी') || value.includes('हिन्दी')) return 'hi';
  if (value === 'gu' || value.includes('gujarati') || value.includes('ગુજરાત')) return 'gu';
  if (value === 'hinglish' || value.includes('hinglish') || value.includes('mixed')) return 'hinglish';
  return 'en';
}

export function languageSettingLabel(language: AssistantLanguage | string): string {
  const normalized = normalizeAssistantLanguage(language);
  return LANGUAGE_LABELS[normalized];
}

export function detectExplicitLanguageCommand(text: string): AssistantLanguage | null {
  const value = text.trim();
  if (!value) return null;

  const lower = value.toLowerCase();

  const hasHindi = /(?:hindi|हिंदी|हिन्दी)/i.test(value);
  if (hasHindi && (/(?:in|mein|में|me|मे)/i.test(value) || /(?:बात|बोल|बोलो|बात करो|बोलना)/i.test(value) || /(?:hindi|हिंदी|हिन्दी)/i.test(value))) {
    return 'hi';
  }

  const hasGujarati = /(?:gujarati|ગુજરાતી|ગુજરાત)/i.test(value);
  if (hasGujarati && (/(?:in|માં|મા|માટે|mein)/i.test(value) || /(?:વાત|બોલ|બોલો|બાત|બात करो|બોલना)/i.test(value) || /(?:gujarati|ગુજરાતી|ગુજરાત)/i.test(value))) {
    return 'gu';
  }

  if (/(?:speak\s+in\s+english|talk\s+in\s+english|answer\s+in\s+english|reply\s+in\s+english|english)/i.test(value)) {
    return 'en';
  }

  if (/(?:hinglish|mixed)/i.test(value) && (/(?:in|mein|में|me)/i.test(value) || /(?:baat|answer|reply|batao|bol|बोलो|बात)/i.test(value) || /(?:hinglish|mixed)/i.test(value))) {
    return 'hinglish';
  }

  if (/(?:\benglish\b.*\bmein\b)|(?:\bhi\b.*\benglish\b)|(?:\bgujarati\b.*\benglish\b)|(?:\bhinglish\b.*\benglish\b)/i.test(lower)) {
    if (lower.includes('gujarati')) return 'gu';
    if (lower.includes('hindi')) return 'hi';
    if (lower.includes('hinglish')) return 'hinglish';
    return 'en';
  }

  return null;
}

export function detectLanguageFromText(text: string): AssistantLanguage {
  const trimmed = text.trim();
  if (!trimmed) return 'en';

  const explicit = detectExplicitLanguageCommand(trimmed);
  if (explicit) return explicit;

  if (GUJARATI_SCRIPT.test(trimmed) || GUJARATI_KEYWORDS.test(trimmed)) return 'gu';
  if (HINDI_SCRIPT.test(trimmed) || HINDI_KEYWORDS.test(trimmed)) return 'hi';
  if (HINGLISH_KEYWORDS.test(trimmed)) return 'hinglish';

  return 'en';
}

export function resolveConversationLanguage(
  message: string,
  currentLanguage: AssistantLanguage | string | null,
  activeLanguageSetExplicitly: boolean,
  preferredLanguage?: AssistantLanguage | string | null
): AssistantLanguage {
  const explicit = detectExplicitLanguageCommand(message);
  if (explicit) return explicit;

  const normalizedCurrent = currentLanguage ? normalizeAssistantLanguage(currentLanguage) : null;
  const normalizedPreferred = preferredLanguage ? normalizeAssistantLanguage(preferredLanguage) : null;
  const detected = detectLanguageFromText(message);

  if (normalizedCurrent && normalizedCurrent !== 'en' && activeLanguageSetExplicitly) {
    return normalizedCurrent;
  }

  if (normalizedCurrent && normalizedCurrent !== 'en' && !activeLanguageSetExplicitly) {
    return detected === 'en' ? normalizedCurrent : detected;
  }

  if (normalizedPreferred && normalizedPreferred !== 'en') {
    return detected === 'en' ? normalizedPreferred : detected;
  }

  return detected;
}

export function recognitionLocaleForLanguage(language: AssistantLanguage | string): string {
  const normalized = normalizeAssistantLanguage(language);
  if (normalized === 'gu') return 'gu-IN';
  if (normalized === 'hi' || normalized === 'hinglish') return 'hi-IN';
  return 'en-US';
}

export function ttsLanguageForLanguage(language: AssistantLanguage | string): string {
  const normalized = normalizeAssistantLanguage(language);
  if (normalized === 'gu') return 'gu-IN';
  if (normalized === 'hi' || normalized === 'hinglish') return 'hi-IN';
  return 'en-US';
}

export function selectVoiceForLanguage(voices: SpeechSynthesisVoice[], targetLanguage: string): SpeechSynthesisVoice | undefined {
  const target = targetLanguage.toLowerCase();
  const prefix = target.split('-')[0];
  const exact = voices.find((voice) => voice.lang.toLowerCase() === target);
  if (exact) return exact;
  const regional = voices.find((voice) => voice.lang.toLowerCase().startsWith(`${prefix}-`));
  if (regional) return regional;
  if (prefix === 'gu') {
    return voices.find((voice) => /^(hi|en-in|mr|bn|ta|te|kn)-/i.test(voice.lang));
  }
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
}

export function buildLanguageSystemInstruction(language: AssistantLanguage | string): string {
  const normalized = normalizeAssistantLanguage(language);
  if (normalized === 'hi') {
    return 'ACTIVE RESPONSE LANGUAGE: Hindi\nINSTRUCTION: Respond naturally in Hindi.';
  }
  if (normalized === 'gu') {
    return 'ACTIVE RESPONSE LANGUAGE: Gujarati\nINSTRUCTION: Respond naturally in Gujarati.';
  }
  if (normalized === 'hinglish') {
    return 'ACTIVE RESPONSE LANGUAGE: Hinglish\nINSTRUCTION: Respond naturally in conversational Hinglish using Devanagari or Latin script based on the user\'s writing or speech. Keep common technical English terms in English.';
  }
  return 'ACTIVE RESPONSE LANGUAGE: English\nINSTRUCTION: Respond naturally in English.';
}

export function languagePreferenceFromMemory(memoryText: string): AssistantLanguage | null {
  if (/\b(hindi|हिंदी|हिन्दी)\b/i.test(memoryText) && /\b(prefer|want|like|speak|talk|answer)\b/i.test(memoryText)) return 'hi';
  if (/\b(gujarati|ગુજરાત|ગુજરાતी)\b/i.test(memoryText) && /\b(prefer|want|like|speak|talk|answer)\b/i.test(memoryText)) return 'gu';
  if (/\b(hinglish|mixed)\b/i.test(memoryText) && /\b(prefer|want|like|speak|talk|answer)\b/i.test(memoryText)) return 'hinglish';
  if (/\b(english)\b/i.test(memoryText) && /\b(prefer|want|like|speak|talk|answer)\b/i.test(memoryText)) return 'en';
  return null;
}
