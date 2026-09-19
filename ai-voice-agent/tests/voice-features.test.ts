import { describe, expect, it, vi } from 'vitest';
import { cameraErrorMessage, stopMediaStream } from '../src/lib/camera';
import { selectVoiceForLanguage, ttsLanguageForLanguage } from '../src/lib/language';
import { commandAfterWakeWord, containsWakeWord } from '../src/lib/wake-word';
import { VoiceSessionManager } from '../src/lib/voice-session';

describe('voice feature helpers', () => {
  it('recognizes wake-word variants and removes only the wake phrase', () => {
    expect(containsWakeWord('Hey Robo')).toBe(true);
    expect(containsWakeWord('hey, robo')).toBe(true);
    expect(containsWakeWord('હે રોબો')).toBe(true);
    expect(containsWakeWord('हे रोबो')).toBe(true);
    expect(commandAfterWakeWord("Hey Robo, what is today's date?")).toBe("what is today's date?");
    expect(commandAfterWakeWord('Hey Robo')).toBe('');
  });

  it('maps Gujarati to the Gujarati browser locale', () => {
    expect(ttsLanguageForLanguage('Gujarati')).toBe('gu-IN');
  });

  it('selects Gujarati first and an Indian fallback when needed', () => {
    const gujarati = { lang: 'gu-IN', name: 'Gujarati Voice' } as SpeechSynthesisVoice;
    const hindi = { lang: 'hi-IN', name: 'Hindi Voice' } as SpeechSynthesisVoice;
    const english = { lang: 'en-US', name: 'English Voice' } as SpeechSynthesisVoice;
    expect(selectVoiceForLanguage([english, gujarati], 'gu-IN')).toBe(gujarati);
    expect(selectVoiceForLanguage([english, hindi], 'gu-IN')).toBe(hindi);
  });

  it('stops every camera track when the stream is released', () => {
    const stop = vi.fn();
    stopMediaStream({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream);
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('reports camera permission and device failures truthfully', () => {
    expect(cameraErrorMessage(new DOMException('denied', 'NotAllowedError'))).toContain('permission');
    expect(cameraErrorMessage(new DOMException('missing', 'NotFoundError'))).toContain('No camera');
  });

  it('does not request a wake listener when Auto Wake is off and starts one when enabled', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      maxAlternatives = 1;
      onstart = null;
      onresult = null;
      onerror = null;
      onend = null;
      onaudiostart = null;
      onaudioend = null;
      onspeechstart = null;
      onspeechend = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
    }
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: undefined });
    const manager = new VoiceSessionManager({ aiModel: '', whisperModel: '', whisperLanguage: 'Gujarati', ttsVoice: '', silenceThresholdMs: 900, autoWake: false }, vi.fn());

    await manager.setAutoWakeEnabled(false);
    expect(getUserMedia).not.toHaveBeenCalled();
    await manager.setAutoWakeEnabled(true);
    expect(getUserMedia).toHaveBeenCalledOnce();
    manager.stopSession();
    vi.unstubAllGlobals();
  });
});