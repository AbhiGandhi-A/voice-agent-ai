const WAKE_WORD_PATTERN = /(?:\bhey[\s,.-]*robo\b|હે\s*રોબો|हे\s*रोबो)/iu;

export function containsWakeWord(text: string): boolean {
  return WAKE_WORD_PATTERN.test(text.trim());
}

export function commandAfterWakeWord(text: string): string {
  return text
    .replace(WAKE_WORD_PATTERN, '')
    .replace(/^[\s,;:!-]+|[\s,;:!-]+$/g, '')
    .trim();
}

export function wakeWordPattern(): RegExp {
  return WAKE_WORD_PATTERN;
}