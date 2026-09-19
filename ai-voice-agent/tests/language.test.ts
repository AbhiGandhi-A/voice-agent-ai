import { describe, expect, it } from 'vitest';
import {
  detectExplicitLanguageCommand,
  detectLanguageFromText,
  resolveConversationLanguage,
  recognitionLocaleForLanguage,
  ttsLanguageForLanguage,
} from '../src/lib/language';

describe('language utilities', () => {
  it('detects explicit language commands across scripts and phrasing', () => {
    expect(detectExplicitLanguageCommand('Speak in Hindi')).toBe('hi');
    expect(detectExplicitLanguageCommand('हिंदी में बात करो')).toBe('hi');
    expect(detectExplicitLanguageCommand('Speak in Gujarati')).toBe('gu');
    expect(detectExplicitLanguageCommand('ગુજરાતીમાં વાત કરો')).toBe('gu');
    expect(detectExplicitLanguageCommand('Speak in English')).toBe('en');
    expect(detectExplicitLanguageCommand('Hinglish mein baat karo')).toBe('hinglish');
  });

  it('detects non-English input from script and vocabulary', () => {
    expect(detectLanguageFromText('आप कैसे हो?')).toBe('hi');
    expect(detectLanguageFromText('તમે કેમ છો?')).toBe('gu');
    expect(detectLanguageFromText('bhai aaj kya karna hai')).toBe('hinglish');
    expect(detectLanguageFromText('Hello, how are you?')).toBe('en');
  });

  it('keeps the active language sticky until changed', () => {
    expect(resolveConversationLanguage('What is today?', 'hi', true, null)).toBe('hi');
    expect(resolveConversationLanguage('bhai aaj kya karna hai', 'en', false, null)).toBe('hinglish');
  });

  it('maps languages to browser recognition and TTS locales', () => {
    expect(recognitionLocaleForLanguage('hi')).toBe('hi-IN');
    expect(recognitionLocaleForLanguage('gu')).toBe('gu-IN');
    expect(recognitionLocaleForLanguage('hinglish')).toBe('hi-IN');
    expect(ttsLanguageForLanguage('hi')).toBe('hi-IN');
    expect(ttsLanguageForLanguage('gu')).toBe('gu-IN');
    expect(ttsLanguageForLanguage('hinglish')).toBe('hi-IN');
  });
});
