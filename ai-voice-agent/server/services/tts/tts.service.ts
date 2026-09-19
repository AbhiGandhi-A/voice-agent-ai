import { env } from '../../config/env';
import { ApiError } from '../../middleware/error';

export interface TTSSynthesis {
  audioBase64: string;
  mimeType: string;
  sampleRate: number;
}

export type TTSStatus = {
  provider: string;
  status: 'connected' | 'not_configured' | 'disconnected' | 'error';
  details: string;
};

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
}

const FALLBACK_VOICES: TTSVoice[] = [
  { id: 'en_US-amy', name: 'Amy (American)', language: 'en-US' },
  { id: 'en_US-lessac', name: 'Lessac (American)', language: 'en-US' },
  { id: 'en_GB-alan', name: 'Alan (British)', language: 'en-GB' },
  { id: 'hi_IN-roop', name: 'Roop (Hindi)', language: 'hi-IN' },
  { id: 'gu_IN-shyam', name: 'Shyam (Gujarati)', language: 'gu-IN' },
];

/**
 * Server-side text-to-speech abstraction.
 *  - `browser`: handled on the client (speechSynthesis). Server status only.
 *  - `piper` / `kokoro`: local HTTP service that returns WAV audio.
 */
export const ttsService = {
  status(): Promise<TTSStatus> {
    return (async () => {
      switch (env.ttsProvider) {
        case 'piper':
        case 'kokoro': {
          const ok = await ping(env.piperServerUrl);
          return ok
            ? { provider: env.ttsProvider, status: 'connected', details: `${env.ttsProvider} (${env.ttsVoice})` }
            : { provider: env.ttsProvider, status: 'disconnected', details: `${env.ttsProvider} server unreachable at ${env.piperServerUrl}` };
        }
        case 'browser':
        default:
          return { provider: 'browser', status: 'connected', details: 'Browser speechSynthesis (web mode)' };
      }
    })();
  },

  async voices(): Promise<TTSVoice[]> {
    if (env.ttsProvider === 'browser') return FALLBACK_VOICES;
    try {
      const res = await fetch(`${env.piperServerUrl}/voices`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = (await res.json()) as TTSVoice[] | { voices: TTSVoice[] };
        return Array.isArray(data) ? data : data.voices ?? [];
      }
    } catch {
      // fall through to known voices
    }
    return FALLBACK_VOICES;
  },

  /**
   * Synthesizes speech as WAV audio. Contract for the local TTS server:
   * POST /synthesize { text, voice } → audio/wav body.
   */
  async synthesize(text: string, voice?: string): Promise<TTSSynthesis> {
    if (env.ttsProvider === 'browser') {
      throw new ApiError(409, 'tts_not_server', 'Server-side TTS is not configured. Use TTS_PROVIDER=piper.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${env.piperServerUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: voice ?? env.ttsVoice }),
        signal: controller.signal,
      });
      if (!res.ok) throw new ApiError(502, 'tts_error', 'TTS synthesis failed.');
      const arrayBuffer = await res.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);

      const wavHeader = bytes.subarray(0, 44);
      const sampleRate = wavHeader.length === 44 ? wavHeader.readUInt32LE(24) : 22050;

      return {
        audioBase64: bytes.toString('base64'),
        mimeType: 'audio/wav',
        sampleRate,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(503, 'tts_unavailable', `${env.ttsProvider} server unavailable.`);
    } finally {
      clearTimeout(timer);
    }
  },
};

async function ping(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}