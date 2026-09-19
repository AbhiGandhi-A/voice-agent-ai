import type { WebSocket } from 'ws';
import { ulawToLinear } from '../services/telephony/voice/audio-codecs';
import { getMediaSession, closeMediaSession } from '../services/telephony/bridge-registry';
import { callsService } from '../services/calls/calls.service';
import { startMediaSession } from '../services/calls/webhook-hub';
import { logger } from '../utils/logger';

interface RawJson {
  event?: string;
  streamSid?: string;
  callSid?: string;
  media?: { payload?: string };
  start?: { callSid?: string; streamSid?: string; customParameters?: Record<string, string> };
}

interface ActiveMedia {
  streamSid: string;
  callId: string;
  providerCallId: string;
}

/**
 * Twilio <Stream> WebSocket endpoint. Receives base64 μ-law (8kHz) audio
 * frames from the caller, feeds them to a MediaStreamSession, and relays the
 * AI's synthesized reply back as μ-law media messages.
 */
export function handleMediaSocket(ws: WebSocket): void {
  let active: ActiveMedia | null = null;

  const sendAudio = (audio: Buffer | Uint8Array, _format: 'ulaw' | 'alaw' | 'pcm16'): void => {
    if (!active) return;
    const msg = JSON.stringify({ event: 'media', streamSid: active.streamSid, media: { payload: Buffer.from(audio).toString('base64') } });
    ws.send(msg);
  };

  const silenceOutbound = (_silent: boolean): void => {
    // Twilio μ-law streams cannot be muted mid-stream; barge-in is handled by
    // halting synthesis in the session itself.
  };

  ws.on('message', async (raw: Buffer) => {
    let json: RawJson;
    try {
      json = JSON.parse(raw.toString('utf8'));
    } catch {
      return;
    }

    if (json.event === 'start') {
      const streamSid = json.start?.streamSid ?? json.streamSid ?? '';
      const twilioCallSid = json.start?.callSid;
      const customCallId = json.start?.customParameters?.['callId'] ?? null;

      try {
        const call = await resolveCall(customCallId, twilioCallSid);
        if (!call) {
          logger.warn('media_unknown_call', { twilioCallSid, customCallId });
          ws.close();
          return;
        }
        const callId = call.id as string;
        const providerCallId = (call.provider_call_id as string | null) ?? twilioCallSid ?? streamSid;
        if (getMediaSession(providerCallId)) {
          await closeMediaSession(providerCallId);
        }
        const session = await startMediaSession({
          callId,
          userId: call.user_id as string,
          providerCallId,
          conversationId: (call.conversation_id as string | null) ?? null,
          phoneNumber: (call.phone_number as string) ?? '',
          sendAudio,
          silenceOutbound,
        });
        void session;
        active = { streamSid, callId, providerCallId };
        await callsService.updateCallStatus(callId, 'ai_active');
      } catch (err) {
        logger.error('media_start_failed', { message: err instanceof Error ? err.message : 'unknown', twilioCallSid });
        ws.close();
        return;
      }
      ws.send(JSON.stringify({ event: 'mark', streamSid, name: 'bridge-start' }));
      return;
    }

    if (json.event === 'media') {
      const payload = json.media?.payload;
      if (!payload || !active) return;
      const session = getMediaSession(active.providerCallId);
      if (session) {
        const pcm = ulawToLinear(new Uint8Array(Buffer.from(payload, 'base64')));
        await session.feed(pcm);
      }
      return;
    }

    if (json.event === 'stop') {
      if (active) await closeMediaSession(active.providerCallId);
      ws.close();
    }
  });

  ws.on('close', () => {
    if (active) void closeMediaSession(active.providerCallId);
  });
}

async function resolveCall(customCallId: string | null | undefined, twilioCallSid: string | null | undefined): Promise<Record<string, unknown> | null> {
  if (customCallId) {
    try {
      return await callsService.getCall(customCallId);
    } catch {
      // fall back to provider sid lookup
    }
  }
  if (twilioCallSid) {
    return await callsService
      .getCallByProviderId(twilioCallSid)
      .catch(() => null);
  }
  return null;
}