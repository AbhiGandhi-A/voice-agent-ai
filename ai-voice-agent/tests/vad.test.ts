import { describe, it, expect } from 'vitest';
import { VAD } from '../server/services/telephony/voice/vad';

function frame(value: number, size = 160): number[] {
  return new Array<number>(size).fill(value);
}

describe('VAD', () => {
  it('stays idle for quiet frames', () => {
    const vad = new VAD();
    for (let i = 0; i < 30; i++) {
      expect(vad.process(frame(0))).toBe('idle');
    }
    expect(vad.isSpeaking).toBe(false);
  });

  it('starts after the minimum number of speech frames', () => {
    const vad = new VAD();
    const loud = frame(2000);
    let startedAt: number | null = null;
    for (let i = 0; i < 20; i++) {
      const result = vad.process(loud);
      if (result === 'started') startedAt = i;
    }
    expect(startedAt).not.toBeNull();
    expect(startedAt).toBeGreaterThanOrEqual(4);
    expect(vad.isSpeaking).toBe(true);
  });

  it('emits ended after a silence hangover', () => {
    const vad = new VAD({ minSpeechFrames: 2, silenceHangover: 5 });
    const loud = frame(2000);
    vad.process(loud);
    vad.process(loud);
    expect(vad.process(loud)).toBe('active');

    let ended = false;
    for (let i = 0; i < 20; i++) {
      if (vad.process(frame(0)) === 'ended') ended = true;
    }
    expect(ended).toBe(true);
    expect(vad.isSpeaking).toBe(false);
  });

  it('can be reset between utterances', () => {
    const vad = new VAD();
    vad.process(frame(2000));
    vad.reset();
    expect(vad.isSpeaking).toBe(false);
  });
});