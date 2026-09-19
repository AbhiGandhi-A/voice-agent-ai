import { env } from '../../config/env';
import { ApiError } from '../../middleware/error';

export interface TranscriptResult {
  text: string;
  language: string;
  durationSeconds: number;
  isFinal: boolean;
}

export type STTStatus = {
  provider: string;
  status: 'connected' | 'not_configured' | 'disconnected' | 'error';
  details: string;
};

/**
 * Server-side speech-to-text abstraction.
 *  - `browser`: handled on the client (Web Speech API). Server status only.
 *  - `whisper`: a local faster-whisper HTTP service that accepts audio bytes.
 *  - `deepgram` / `google`: external APIs via a shared key.
 */
export const sttService = {
  status(): Promise<STTStatus> {
    return (async () => {
      switch (env.sttProvider) {
        case 'whisper': {
          if (!env.whisperServerUrl) {
            return { provider: 'whisper', status: 'not_configured', details: 'WHISPER_SERVER_URL is not configured.' };
          }
          const ok = await ping(env.whisperServerUrl);
          return ok
            ? { provider: 'whisper', status: 'connected', details: `faster-whisper (${env.sttModel})` }
            : { provider: 'whisper', status: 'disconnected', details: `Whisper server unreachable at ${env.whisperServerUrl}` };
        }
        case 'deepgram':
        case 'google': {
          return env.sttApiKey
            ? { provider: env.sttProvider, status: 'connected', details: 'API key configured' }
            : { provider: env.sttProvider, status: 'not_configured', details: 'STT_API_KEY missing' };
        }
        case 'browser':
        default:
          return { provider: 'browser', status: 'connected', details: 'Browser Web Speech API (web mode)' };
      }
    })();
  },

  /**
   * Transcribes 16-bit PCM mono audio (used by the telephony voice bridge).
   * The whisper service contract: POST /transcribe with a WAV body →
   * { text, language, duration }.
   */
  async transcribe(audioWav: Buffer, mimeType = 'audio/wav'): Promise<TranscriptResult> {
    if (env.sttProvider === 'whisper') {
      if (!env.whisperServerUrl) throw new ApiError(503, 'stt_unavailable', 'Whisper server URL is not configured.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch(`${env.whisperServerUrl}/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': mimeType, 'X-Model': env.sttModel },
          body: audioWav,
          signal: controller.signal,
        });
        if (!res.ok) throw new ApiError(502, 'stt_error', 'Whisper transcription failed.');
        const data = (await res.json()) as { text?: string; language?: string; duration?: number };
        return {
          text: (data.text ?? '').trim(),
          language: data.language ?? env.sttLanguage,
          durationSeconds: data.duration ?? 0,
          isFinal: true,
        };
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(503, 'stt_unavailable', 'Whisper server unavailable.');
      } finally {
        clearTimeout(timer);
      }
    }

    if (env.sttProvider === 'deepgram' || env.sttProvider === 'google') {
      // External API placeholders — both accept raw audio and return text.
      const url = env.sttProvider === 'deepgram' ? 'https://api.deepgram.com/v1/listen' : 'https://speech.googleapis.com/v1/speech:recognize';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': mimeType, Authorization: `Bearer ${env.sttApiKey}` },
        body: audioWav,
      });
      if (!res.ok) throw new ApiError(502, 'stt_error', 'External STT provider failed.');
      const data = (await res.json()) as { results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> } };
      return {
        text: data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? '',
        language: env.sttLanguage,
        durationSeconds: 0,
        isFinal: true,
      };
    }

    throw new ApiError(409, 'stt_not_server', 'Server-side STT is not configured. Use STT_PROVIDER=whisper.');
  },
};

async function ping(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}