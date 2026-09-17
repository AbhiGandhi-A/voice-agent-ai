import { Message, VoiceStatus } from '../types';

export interface VoiceSessionConfig {
  aiModel: string;
  whisperModel: string;
  whisperLanguage: string;
  ttsVoice: string;
  silenceThresholdMs: number;
  systemPrompt?: string;
  serverWsUrl?: string;
}

export type VoiceEventCallback = (event: {
  type:
    | 'status'
    | 'user_transcript'
    | 'ai_text'
    | 'ai_audio'
    | 'tool_call'
    | 'error';
  status?: VoiceStatus;
  text?: string;
  data?: unknown;
  message?: Message;
}) => void;

/* Web Speech Recognition types for browser compatibility */
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResultItem[];
  [index: number]: SpeechRecognitionResultItem[];
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
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
  private isListening = false;
  private isMuted = false;
  private currentStatus: VoiceStatus = 'idle';
  private silenceTimer: NodeJS.Timeout | null = null;
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
          // Still proceed in mock mode gracefully with visual indicator
        }
      }

      // Initialize Web Speech Recognition if available in browser
      this.setupSpeechRecognition();

      if (this.config.serverWsUrl && this.config.serverWsUrl.startsWith('ws')) {
        // Optional WebSocket connection
        this.connectRealWebSocket();
      }

      this.isListening = true;
      this.setStatus('listening');
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize voice session';
      this.setStatus('error');
      this.onEvent({ type: 'error', text: errorMsg });
      return false;
    }
  }

  private connectRealWebSocket() {
    try {
      this.ws = new WebSocket(this.config.serverWsUrl);
      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({ type: 'session_started', config: this.config }));
      };
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ai_text') {
            this.speakText(data.text);
          }
        } catch {
          // ignore non-json
        }
      };
      this.ws.onerror = () => {
        this.onEvent({
          type: 'error',
          text: 'AI Server disconnected. Ensure uvicorn app.main:app is running or enable Mock Mode.',
        });
      };
    } catch {
      // WS error
    }
  }

  private setupSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang =
          this.config.whisperLanguage === 'Hindi'
            ? 'hi-IN'
            : this.config.whisperLanguage === 'Gujarati'
            ? 'gu-IN'
            : 'en-US';

        this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
          if (this.isMuted) return;

          // Barge-in: If user speaks while AI is speaking, interrupt immediately!
          if (this.currentStatus === 'speaking') {
            this.interruptAI();
          }

          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = 0; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res && res[0]) {
              if (res[0].transcript) {
                finalTranscript += res[0].transcript;
              }
            }
          }

          const activeText = finalTranscript || interimTranscript;
          if (activeText.trim()) {
            this.onEvent({
              type: 'user_transcript',
              text: activeText.trim(),
            });

            // Reset silence VAD debounce
            if (this.silenceTimer) clearTimeout(this.silenceTimer);
            this.silenceTimer = setTimeout(() => {
              const history = this.historyProvider ? this.historyProvider() : [];
              this.handleSpeechCompleted(activeText.trim(), history);
            }, this.config.silenceThresholdMs || 900);
          }
        };

        this.recognition.onerror = () => {
          // ignore transient mic aborts
        };

        try {
          this.recognition.start();
        } catch {
          // already started
        }
      } catch (e) {
        console.warn('SpeechRecognition initialization warning:', e);
      }
    }
  }

  public async handleSpeechCompleted(userText: string, history: Message[] = []) {
    if (!userText.trim()) return;

    this.setStatus('thinking');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: history.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: this.config.systemPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const aiReply = data.reply || "I didn't receive a response. Please try again.";
      this.speakText(aiReply);
    } catch (err: unknown) {
      console.warn('Real AI chat endpoint error, falling back gracefully:', err);
      // Helpful natural answer if offline or waiting for key
      const fallbackReply = `I heard you say: "${userText}". I am listening, but connecting to the AI model service encountered a network issue. Please ensure the server is active.`;
      this.speakText(fallbackReply);
    }
  }

  public speakText(text: string) {
    this.setStatus('speaking');
    this.onEvent({ type: 'ai_text', text });

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
    this.interruptAI();

    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
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
