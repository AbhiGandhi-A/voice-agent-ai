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

  it('keeps final transcription when the browser result index is not usable', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
    let recognition: InstanceType<typeof FakeRecognition> | undefined;
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      maxAlternatives = 1;
      onstart = null;
      onresult: ((event: any) => void) | null = null;
      onerror = null;
      onend = null;
      onaudiostart = null;
      onaudioend = null;
      onspeechstart = null;
      onspeechend = null;
      start = vi.fn(() => { recognition = this; });
      stop = vi.fn();
      abort = vi.fn();
    }
    const events: Array<{ type: string; text?: string }> = [];
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: undefined });
    const manager = new VoiceSessionManager({ aiModel: '', whisperModel: '', whisperLanguage: 'English', ttsVoice: '', silenceThresholdMs: 900, autoWake: false }, (event) => events.push(event));
    await manager.startSession();
    const result = { isFinal: true, length: 1, 0: { transcript: 'hello there', confidence: 1 } };
    recognition?.onresult?.({ resultIndex: 99, results: { length: 1, 0: result } });
    recognition?.onresult?.({ resultIndex: 0, results: { length: 1, 0: result } });
    expect(events.filter((event) => event.type === 'transcript_final')).toHaveLength(1);
    expect(events.find((event) => event.type === 'transcript_final')?.text).toBe('hello there');
    manager.stopSession();
    vi.unstubAllGlobals();
  });
});