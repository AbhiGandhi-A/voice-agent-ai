import { sttService } from '../../stt/stt.service';
import { ttsService } from '../../tts/tts.service';
import { ollamaService } from '../../ai/ollama.service';
import { ApiError } from '../../../middleware/error';
import { logger } from '../../../utils/logger';
import { callsService } from '../../calls/calls.service';
import { conversationsService } from '../../conversations/conversations.service';
import { contactsService } from '../../contacts/contacts.service';
import { settingsService } from '../../settings/settings.service';
import { linearToUlaw, pcmToWav, resample } from './audio-codecs';
import { VAD } from './vad';

export interface MediaStreamSessionOptions {
  callId: string;
  userId: string;
  conversationId: string | null;
  providerCallId: string;
  /** Callback that delivers outbound audio to the telephony provider
   *  (μ-law or other 8kHz encoded bytes plus a format hint). */
  sendAudio: (audio: Buffer | Uint8Array, format: 'ulaw' | 'alaw' | 'pcm16') => void;
  /** Raise barge-in / silent the outgoing track. */
  silenceOutbound: (silent: boolean) => void;
  phoneNumber: string;
}

type SessionState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'closed';

/**
 * Third-party audio bridge: caller voice → STT → Ollama → TTS → caller hears.
 * Barge-in stops synthesis the moment the caller starts speaking again.
 */
export class MediaStreamSession {
  private state: SessionState = 'idle';
  private vad = new VAD();
  private utterance: number[] = [];
  private inUtterance = false;
  private speakingQueue: Array<{ bytes: Buffer; format: 'ulaw' | 'alaw' }> = [];
  private speaking = false;
  private closed = false;
  private opts: MediaStreamSessionOptions;

  constructor(opts: MediaStreamSessionOptions) {
    this.opts = opts;
  }

  /** Feed decoded PCM16 samples from the caller (8kHz telephone audio). */
  async feed(pcm8k: ArrayLike<number>): Promise<void> {
    if (this.closed) return;

    // Barge-in: any caller speech while the AI is speaking halts playback.
    const event = this.vad.process(pcm8k);

    if (event === 'started' && this.state === 'speaking' && this.speaking) {
      await this.stopSpeaking();
      this.opts.silenceOutbound(false);
    }

    if (event === 'started') {
      this.utterance = [];
      this.inUtterance = true;
    }

    if (this.inUtterance && event !== 'ended') {
      for (let i = 0; i < pcm8k.length; i++) this.utterance.push(pcm8k[i]);
    }

    if (event === 'ended') {
      const samples = this.utterance;
      this.utterance = [];
      this.inUtterance = false;
      this.vad.reset();
      if (samples.length > 160 && this.state !== 'transcribing' && this.state !== 'thinking') {
        await this.handleUtterance(samples);
      }
    }
  }

  /** Provide a full TTS reply (VAD is not used when coming from the agent side). */
  async enqueueAiReply(text: string): Promise<void> {
    if (this.closed || this.state === 'closed') return;
    this.state = 'speaking';
    try {
      const synth = await ttsService.synthesize(text);
      const pcm = synth.audioBase64 ? decodePcm16(Buffer.from(synth.audioBase64, 'base64')) : new Int16Array(0);
      // Convert to 8kHz μ-law for the telephone line.
      const pcm8k = resample(pcm, synth.sampleRate || 22050, 8000);
      const ulaw = Buffer.from(linearToUlaw(pcm8k));
      this.speakingQueue.push({ bytes: ulaw, format: 'ulaw' });
    } catch (err) {
      logger.error('tts_failed_for_call', { callId: this.opts.callId, message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.stopSpeaking();
  }

  get currentState(): SessionState {
    return this.state;
  }

  async interrupt(): Promise<void> {
    await this.stopSpeaking();
  }

  private async stopSpeaking(): Promise<void> {
    this.speakingQueue = [];
    this.speaking = false;
    this.opts.silenceOutbound(true);
  }

  private async handleUtterance(samples: number[]): Promise<void> {
    this.state = 'transcribing';
    await this.logTranscript('transcript_partial', samples.length);

    let text = '';
    try {
      const wav = pcmToWav(new Int16Array(samples), 8000);
      const result = await sttService.transcribe(wav, 'audio/wav');
      text = result.text;
    } catch (err) {
      logger.warn('stt_failed_for_call', { callId: this.opts.callId, message: err instanceof Error ? err.message : 'unknown' });
    }

    if (!text) {
      this.state = 'listening';
      return;
    }

    await this.logTranscript('transcript_final', text);
    this.state = 'thinking';
    this.opts.silenceOutbound(true);

    try {
      const reply = await this.makeAiReply(text);
      // Persist transcript messages.
      await this.persistMessages(text, reply);
      await callsService.logEvent(null, this.opts.callId, { eventType: 'ai_started', payload: { model: reply.model } });
      this.state = 'speaking';
      this.opts.silenceOutbound(false);
    } catch (err) {
      if (err instanceof ApiError) {
        logger.warn('ai_failed_for_call', { callId: this.opts.callId, message: err.message });
      }
      this.state = 'listening';
    }
  }

  private async makeAiReply(text: string): Promise<{ text: string; model: string }> {
    const settings = await settingsService.getAll(this.opts.userId);
    let context: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (this.opts.conversationId) {
      context = (await conversationsService.recentMessagesForContext(this.opts.conversationId, 12)).map((m) => ({
        role: m.role === 'user' || m.role === 'assistant' ? m.role : ('user' as const),
        content: m.content,
      }));
    }

    const contact = this.opts.phoneNumber
      ? await contactsService.findByPhone(this.opts.phoneNumber).catch(() => null)
      : null;
    const customerContext = contact
      ? `\n\nCaller context: ${contact.name}${contact.company ? ` at ${contact.company}` : ''}${contact.notes ? ` — ${contact.notes}` : ''}`
      : '';

    const systemPrompt = `${settings.ai.systemPrompt}\nKeep responses spoken and concise (1-3 sentences). You are the AI agent on a live phone call.\n${customerContext}`;

    const result = await ollamaService.generate(
      [
        { role: 'system', content: systemPrompt },
        ...context,
        { role: 'user', content: text },
      ],
      { temperature: settings.ai.temperature, maxTokens: settings.ai.maxTokens || 150 }
    );
    return { text: result.text, model: result.model };
  }

  private async persistMessages(userText: string, reply: { text: string }): Promise<void> {
    if (!this.opts.conversationId) return;
    await conversationsService.addMessage(this.opts.conversationId, 'user', userText);
    await conversationsService.addMessage(this.opts.conversationId, 'assistant', reply.text);
  }

  private async logTranscript(eventType: 'transcript_partial' | 'transcript_final', detail: number | string): Promise<void> {
    await callsService.logEvent(null, this.opts.callId, {
      eventType,
      payload: typeof detail === 'string' ? { text: detail } : { samples: detail },
    });
  }
}

function decodePcm16(buf: Buffer): Int16Array {
  const out = new Int16Array(Math.floor(buf.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}