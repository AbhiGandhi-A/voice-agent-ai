import { getAdminClient } from '../../db/supabase';
import { logger } from '../../utils/logger';
import { callsService } from './calls.service';
import { conversationsService } from '../conversations/conversations.service';
import { attachMediaSession } from '../telephony/bridge-registry';
import { MediaStreamSession } from '../telephony/voice/media-session';
import type { ProviderEvent, WebhookHandlers } from '../telephony/types';

/**
 * Routes provider events into the Supabase-backed call state machine and the
 * media bridge. Lookups are done by provider_call_id; outbound calls restore
 * the provider call id via the custom header passed during dialing.
 */
async function findCallId(event: ProviderEvent): Promise<string | null> {
  const client = getAdminClient();
  if (!client) return null;

  if (event.callId) return event.callId;

  if (event.providerCallId) {
    const { data } = await client
      .from('calls')
      .select('id')
      .eq('provider_call_id', event.providerCallId)
      .maybeSingle();
    if (data) return data.id as string;
  }
  return null;
}

export async function buildWebhookHandlers(): Promise<WebhookHandlers> {
  return {
    async onEvent(event: ProviderEvent) {
      const callId = await findCallId(event);
      if (!callId) {
        logger.warn('webhook_unknown_call', { eventType: event.eventType, providerCallId: event.providerCallId });
        return;
      }

      switch (event.eventType) {
        case 'ringing':
          await callsService.updateCallStatus(callId, 'ringing');
          await callsService.logEvent(null, callId, { eventType: 'call_ringing', payload: {} });
          break;
        case 'answered':
          if (!(await callsService.isTerminal(callId))) {
            await callsService.updateCallStatus(callId, 'connected');
            await callsService.logEvent(null, callId, { eventType: 'call_answered', payload: {} });
          }
          break;
        case 'hold':
          await callsService.updateCallStatus(callId, 'on_hold');
          await callsService.logEvent(null, callId, { eventType: 'hold', payload: {} });
          break;
        case 'unhold':
          await callsService.updateCallStatus(callId, 'connected');
          await callsService.logEvent(null, callId, { eventType: 'resume', payload: {} });
          break;
        case 'completed':
        case 'canceled':
          if (!(await callsService.isTerminal(callId))) {
            await callsService.updateCallStatus(callId, 'ended');
            await callsService.logEvent(null, callId, { eventType: 'call_ended', payload: { reason: event.eventType } });
          }
          break;
        case 'failed':
          await callsService.updateCallStatus(callId, 'failed');
          await callsService.logEvent(null, callId, { eventType: 'call_failed', payload: {} });
          break;
        default:
          break;
      }
    },
  };
}

export async function startMediaSession(opts: {
  callId: string;
  userId: string;
  providerCallId: string;
  conversationId: string | null;
  phoneNumber: string;
  sendAudio: (audio: Buffer | Uint8Array, format: 'ulaw' | 'alaw' | 'pcm16') => void;
  silenceOutbound: (silent: boolean) => void;
}): Promise<MediaStreamSession> {
  let conversationId = opts.conversationId;
  if (!conversationId) {
    const created = await conversationsService.create({
      userId: opts.userId,
      type: 'phone',
      title: `Call from ${opts.phoneNumber || 'unknown'}`,
    });
    conversationId = created.id as string;
    await callsService.updateCall(opts.callId, { conversation_id: conversationId });
  }

  const session = new MediaStreamSession({
    callId: opts.callId,
    userId: opts.userId,
    conversationId,
    providerCallId: opts.providerCallId,
    sendAudio: opts.sendAudio,
    silenceOutbound: opts.silenceOutbound,
    phoneNumber: opts.phoneNumber,
  });

  attachMediaSession(opts.providerCallId, session);
  return session;
}