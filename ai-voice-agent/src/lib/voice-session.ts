import { Message, VoiceStatus } from '../types';

export interface VoiceSessionConfig {
  aiModel: string;
  whisperModel: string;
  whisperLanguage: string;
  ttsVoice: string;
  silenceThresholdMs: number;
  systemPrompt?: string;
  serverWsUrl?: string;
  /**
   * Supplies the Supabase access token used to authenticate requests to the
   * Node API (Bearer header). Set externally after auth state changes.
   */
  getAuthToken?: () => string | null | Promise<string | null>;
  chatEndpoint?: string;
  /** Returns the server conversation id to continue (null starts a new one). */
  getConversationId?: () => string | null;
}

export type VoiceEventCallback = (event: {
  type:
    | 'status'
    | 'user_transcript'
    | 'transcript_final'
    | 'ai_text'
    | 'tool_call'
    | 'error';
  status?: VoiceStatus;
  text?: string;
  data?: unknown;
  message?: Message;
}) => void;

/* Web Speech Recognition types for browser compatibility */
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorLike {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export class VoiceSessionManager {
  private config: VoiceSessionConfig;
  private onEvent: VoiceEventCallback;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private recognition: SpeechRecognitionLike | null = null;
  private recognitionActive = false;
  private starting = false;
  private stopRequested = false;
  private restartTimer: NodeJS.Timeout | null = null;
  private restartAttempts = 0;
  private isListening = false;
  private isMuted = false;
  private currentStatus: VoiceStatus = 'idle';
  private ws: WebSocket | null = null;
  private onAmplitudeCallback?: (amp: number) => void;
  private historyProvider?: () => Message[];

  constructor(config: VoiceSessionConfig, onEvent: VoiceEventCallback) {
    this.config = config;
    this.onEvent = onEvent;
  }

  public setHistoryProvider(provider: () => Message[]) {
    this.historyProvider = provider;
  }

  public updateConfig(newConfig: Partial<VoiceSessionConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public setAmplitudeListener(callback: (amp: number) => void) {
    this.onAmplitudeCallback = callback;
  }

  public async startSession(): Promise<boolean> {
    // Guard against concurrent/duplicate starts (e.g. double-click on the mic).
    // Starting a second Web Speech recognition aborts the active Chrome session
    // with a silent 'aborted' error — the exact "stuck Listening, no transcript".
    if (this.starting || this.isListening) {
      this.log('startSession ignored (already ' + (this.starting ? 'starting' : 'listening') + ')');
      return true;
    }
    this.starting = true;
    this.stopRequested = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    try {
      this.setStatus('connecting');

      // Request browser microphone
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          // Setup Web Audio API Analyser
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            if (this.audioContext && this.audioContext.state !== 'closed') {
              await this.audioContext.close().catch(() => undefined);
            }
            this.audioContext = new AudioContextClass();
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 128;
            this.analyser.smoothingTimeConstant = 0.8;
            source.connect(this.analyser);
            this.trackAudioVolume();
          }
        } catch (micErr) {
          console.warn('Microphone permission issue or no mic device:', micErr);
        }
      }

      this.isListening = true;
      // Initialize Web Speech Recognition if available in browser
      if (!this.startRecognitionInstance()) {
        this.isListening = false;
        this.setStatus('error');
        return false;
      }
      this.setStatus('listening');
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize voice session';
      this.setStatus('error');
      this.onEvent({ type: 'error', text: errorMsg });
      return false;
    } finally {
      this.starting = false;
    }
  }

  private log(...args: unknown[]) {
    console.log('[STT]', ...args);
  }

  private recognitionLanguage(): string {
    const lang = this.config.whisperLanguage;
    if (lang === 'Hindi') return 'hi-IN';
    if (lang === 'Gujarati') return 'gu-IN';
    return 'en-US';
  }

  /**
   * Creates a fresh SpeechRecognition instance, wires every lifecycle handler,
   * and starts it. Never starts if one is already active.
   */
  private startRecognitionInstance(): boolean {
    if (this.recognitionActive) {
      this.log('start ignored (recognition already active)');
      return true;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this.log('SpeechRecognition API not available in this browser');
      this.onEvent({
        type: 'error',
        text: 'Speech recognition is not supported in this browser. Use Google Chrome (desktop).',
      });
      return false;
    }

    let rec: SpeechRecognitionLike;
    try {
      rec = new SpeechRec();
    } catch (err) {
      this.log('could not construct SpeechRecognition:', err);
      return false;
    }

    // continuous=false + restart-on-end is the most reliable Chrome pattern:
    // each utterance ends cleanly with an isFinal result, then onend restarts
    // so the agent keeps listening.
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = this.recognitionLanguage();
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.log('onstart');
      this.recognitionActive = true;
      this.restartAttempts = 0;
    };

    rec.onaudiostart = () => this.log('onaudiostart');
    rec.onaudioend = () => this.log('onaudioend');
    rec.onspeechstart = () => this.log('speech started');
    rec.onspeechend = () => this.log('speech ended');

    rec.onresult = (event) => {
      this.log('onresult', { results: event.results.length });
      if (this.isMuted) return;

      // Barge-in: if the user speaks while the AI is speaking, stop the AI now.
      if (this.currentStatus === 'speaking') {
        this.interruptAI();
      }

      let interim = '';
      let final = '';
      const startIdx = event.resultIndex ?? 0;
      for (let i = startIdx; i < event.results.length; ++i) {
        const res = event.results[i];
        if (!res || res.length === 0) continue;
        const alt = res[0];
        const text = (alt.transcript ?? '').trim();
        if (!text) continue;
        if (res.isFinal) {
          final += (final ? ' ' : '') + text;
        } else {
          interim += (interim ? ' ' : '') + text;
        }
      }

      // Live interim bubble (only when we are actually listening for input).
      if (interim && this.currentStatus !== 'thinking' && this.currentStatus !== 'speaking') {
        this.onEvent({ type: 'user_transcript', text: interim });
      }

      if (final) {
        this.log('final transcript:', JSON.stringify(final));
        this.setStatus('thinking');
        // Clear the live bubble and hand the REAL final transcript to the app,
        // which routes it through the existing authenticated message flow.
        this.onEvent({ type: 'user_transcript', text: final });
        this.onEvent({ type: 'transcript_final', text: final });
      }
    };

    rec.onerror = (event) => {
      const err = (event?.error || 'unknown').toLowerCase();
      this.log('error:', err);

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        this.isListening = false;
        this.setStatus('error');
        this.onEvent({ type: 'error', text: 'Microphone access was denied. Allow microphone access in the browser and try again.' });
      } else if (err === 'network') {
        this.isListening = false;
        this.setStatus('error');
        this.onEvent({ type: 'error', text: 'The speech recognition service could not reach the network. Check your connection and try again.' });
      } else if (err === 'audio-capture') {
        this.isListening = false;
        this.setStatus('error');
        this.onEvent({ type: 'error', text: 'No audio could be captured from the microphone.' });
      } else if (err === 'no-speech') {
        // Transient: no speech detected this round — keep listening.
        this.log('no-speech (keeping the session listening)');
      } else if (err === 'aborted') {
        // Expected whenever we call stop()/abort() ourselves; otherwise the
        // recognizer was superseded — restart if the session should still run.
        this.log('aborted');
        if (this.isListening && !this.stopRequested) this.scheduleRestart(250);
      } else {
        this.log('unhandled error (non-fatal):', err);
        if (this.isListening && !this.stopRequested) this.scheduleRestart(250);
      }
    };

    rec.onend = () => {
      this.log('onend');
      this.recognitionActive = false;
      if (this.recognition === rec) this.recognition = null;
      // Auto-restart so the agent keeps listening after each utterance/round.
      if (this.isListening && !this.stopRequested) {
        this.scheduleRestart(200);
      }
    };

    this.recognition = rec;
    try {
      rec.start();
      this.log('recognition.start()');
    } catch (err) {
      this.log('recognition.start() threw:', err);
      this.recognitionActive = false;
      this.recognition = null;
      if (this.isListening && !this.stopRequested) this.scheduleRestart(250);
      return false;
    }
    return true;
  }

  private scheduleRestart(delay: number): void {
    if (!this.isListening || this.stopRequested) return;
    if (this.restartAttempts >= 3) {
      this.log('restart limit reached');
      this.isListening = false;
      this.setStatus('error');
      this.onEvent({ type: 'error', text: 'Speech recognition stopped unexpectedly. Start listening again to retry.' });
      return;
    }
    this.restartAttempts += 1;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.isListening || this.stopRequested || this.recognitionActive) return;
      this.startRecognitionInstance();
    }, delay);
  }

  public speakText(text: string, notifyConversation = true) {
    this.setStatus('speaking');
    if (notifyConversation) {
      this.onEvent({ type: 'ai_text', text });
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop prior audio
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Select natural voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) => v.lang.includes('en') && (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google'))
      );
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        if (this.isListening) {
          this.setStatus('listening');
        }
      };

      utterance.onerror = () => {
        if (this.isListening) {
          this.setStatus('listening');
        }
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback timer if speech synth isn't enabled
      const wordCount = text.split(' ').length;
      const durationMs = Math.max(2500, (wordCount / 3) * 1000);
      setTimeout(() => {
        if (this.isListening) {
          this.setStatus('listening');
        }
      }, durationMs);
    }
  }

  public interruptAI() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentStatus === 'speaking' || this.currentStatus === 'thinking') {
      this.setStatus('listening');
      this.onEvent({ type: 'status', status: 'listening' });
    }
  }

  public resumeListening() {
    if (this.isListening && !this.stopRequested) {
      this.setStatus('listening');
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  public stopSession() {
    this.isListening = false;
    this.stopRequested = true;
    this.interruptAI();

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    if (this.recognition) {
      this.recognitionActive = false;
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('idle');
  }

  private setStatus(status: VoiceStatus) {
    this.currentStatus = status;
    this.onEvent({ type: 'status', status });
  }

  private trackAudioVolume() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const update = () => {
      if (!this.analyser || !this.isListening) return;
      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalized = Math.min(1, average / 80);

      if (this.onAmplitudeCallback) {
        this.onAmplitudeCallback(normalized);
      }

      // Barge-in based on volume threshold while AI is speaking
      if (this.currentStatus === 'speaking' && normalized > 0.45 && !this.isMuted) {
        this.interruptAI();
      }

      this.animFrameId = requestAnimationFrame(update);
    };

    update();
  }
}