/**
 * Simple energy-based Voice Activity Detector with adaptive threshold and
 * hangover. Operates on 16-bit PCM samples.
 */
export class VAD {
  private static readonly FRAME_SIZE = 160; // 20ms @ 8kHz
  private energyHistory: number[] = [];
  private speechFrames = 0;
  private silenceFrames = 0;
  private readonly thresholdFactor: number;
  private readonly minSpeechFrames: number;
  private readonly silenceHangover: number;

  private state: 'idle' | 'speech' | 'utterance' = 'idle';

  constructor(opts: { thresholdFactor?: number; minSpeechFrames?: number; silenceHangover?: number } = {}) {
    this.thresholdFactor = opts.thresholdFactor ?? 2.5;
    this.minSpeechFrames = opts.minSpeechFrames ?? 5; // ~100ms
    this.silenceHangover = opts.silenceHangover ?? 15; // ~300ms
  }

  /** Feed a chunk of PCM16 samples. Returns 'started' | 'active' | 'ended' | 'idle'. */
  process(samples: ArrayLike<number>): 'started' | 'active' | 'ended' | 'idle' {
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) sumSquares += (samples[i] * samples[i]) / 65536;
    const energy = sumSquares / Math.max(1, samples.length);

    this.energyHistory.push(energy);
    if (this.energyHistory.length > 50) this.energyHistory.shift();

    const noiseFloor = this.energyHistory.length > 10
      ? this.percentile(this.energyHistory, 0.2)
      : 5;
    const threshold = Math.max(noiseFloor * this.thresholdFactor, 8);

    const isSpeech = energy > threshold;

    if (isSpeech) {
      this.speechFrames++;
      this.silenceFrames = 0;
      if (this.speechFrames >= this.minSpeechFrames) {
        const wasIdle = this.state !== 'speech' && this.state !== 'utterance';
        this.state = 'speech';
        return wasIdle ? 'started' : 'active';
      }
      return 'idle';
    }

    this.silenceFrames++;
    if (this.state === 'speech' || this.state === 'utterance') {
      if (this.silenceFrames >= this.silenceHangover) {
        const result = this.state === 'speech' ? 'ended' : 'ended';
        this.state = 'utterance'; // final silence segment is consumed by caller
        this.speechFrames = 0;
        this.state = 'idle';
        return result;
      }
      this.state = 'utterance';
      return 'active';
    }

    return 'idle';
  }

  reset(): void {
    this.state = 'idle';
    this.speechFrames = 0;
    this.silenceFrames = 0;
  }

  private percentile(values: number[], q: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)));
    return sorted[idx];
  }

  get isSpeaking(): boolean {
    return this.state === 'speech' || this.state === 'utterance';
  }
}