import type { Request } from 'express';
import type { IncomingMessage } from 'http';
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { HoldOptions, MakeCallOptions, ProviderCall, ProviderEvent, TelephonyProvider, TransferOptions } from './types';
import { getHeader } from './http-util';

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';

/**
 * Twilio provider — outbound REST calls ( /Calls ) and inbound webhooks.
 * Media streaming is enabled via the <Stream /> TwiML verb pointing at our
 * WebSocket bridge. Signature verification is the standard
 * HMAC-SHA1 over the full request URL + raw body (X-Twilio-Signature).
 */
export class TwilioProvider implements TelephonyProvider {
  readonly name = 'twilio';

  isConfigured(): boolean {
    return Boolean(env.telephonyAccountId && env.telephonyAuthToken && env.telephonyPhoneNumber);
  }

  describe(): { configured: boolean; details: string } {
    if (!this.isConfigured()) {
      return { configured: false, details: 'Twilio account SID / auth token / phone number missing. Set telephonyAccountId, telephonyAuthToken, telephonyPhoneNumber.' };
    }
    return { configured: true, details: `Twilio account ${env.telephonyAccountId?.slice(0, 6)}…` };
  }

  async makeCall(options: MakeCallOptions): Promise<ProviderCall> {
    if (!this.isConfigured()) throw new Error('Twilio is not configured.');
    const params = new URLSearchParams({
      To: options.to,
      From: options.from ?? env.telephonyPhoneNumber as string,
      Url: options.webhookUrl,
      StatusCallback: options.webhookUrl,
      StatusCallbackEvent: 'initiated,ringing,answered,completed',
      StatusCallbackMethod: 'POST',
    });

    const auth = Buffer.from(`${env.telephonyAccountId}:${env.telephonyAuthToken}`).toString('base64');
    const res = await fetch(`${TWILIO_API}/${env.telephonyAccountId}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const body = (await res.json()) as { statusCode?: number; sid?: string; message?: string };
    if (!res.ok || body.statusCode) {
      const msg = body.message || res.statusText;
      logger.error('twilio_make_call_failed', { status: res.status, message: msg });
      throw new Error(`Twilio call failed: ${msg}`);
    }
    return { providerCallId: body.sid as string };
  }

  async hangup(providerCallId: string): Promise<void> {
    await this.twilioPost(`/Calls/${encodeURIComponent(providerCallId)}.json`, { Status: 'completed' });
  }

  async hold(options: HoldOptions): Promise<void> {
    // Twilio media streams cannot be paused via REST; we mute the bridge instead.
    await this.twilioPost(`/Calls/${encodeURIComponent(options.providerCallId)}.json`, {
      Twiml: holdTwiML(options.hold),
    });
  }

  async transfer(options: TransferOptions): Promise<void> {
    await this.twilioPost(`/Calls/${encodeURIComponent(options.providerCallId)}.json`, {
      Twiml: `<Response><Dial>${escapeXml(options.to)}</Dial></Response>`,
    });
  }

  verifyRequest(req: Request | IncomingMessage, rawBody: Buffer): boolean {
    const header = getHeader(req, 'x-twilio-signature');
    if (!header) return false;
    if (!env.telephonyAuthToken) return false;
    const url = typeof (req as Request).originalUrl === 'string'
      ? `${(req as Request).protocol}://${(req as Request).get('host')}${(req as Request).originalUrl}`
      : (req as IncomingMessage).url as string;
    const fullUrl = new URL(url, 'http://localhost').toString();
    const hmac = crypto.createHmac('sha1', env.telephonyAuthToken).update(fullUrl + rawBody.toString('utf8')).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(header)) || hmac === header;
  }

  parseWebhook(rawBody: Buffer, _req: Request | IncomingMessage): ProviderEvent {
    const params = new URLSearchParams(rawBody.toString('utf8'));
    const eventType = params.get('CallStatus') ?? 'initiated';
    const providerCallId = params.get('CallSid') ?? '';
    const custom = params.get('X-Voice-Agent-Call-Id');
    return {
      eventType: this.mapEvent(eventType),
      providerCallId,
      callId: custom ?? undefined,
      raw: Object.fromEntries(params.entries()),
    };
  }

  private mapEvent(status: string): ProviderEvent['eventType'] {
    switch (status.toUpperCase()) {
      case 'INITIATED':
      case 'QUEUED': return 'initiated';
      case 'RINGING': return 'ringing';
      case 'IN-PROGRESS': return 'answered';
      case 'COMPLETED':
      case 'CONNECTED': return 'completed';
      case 'CANCELED': return 'canceled';
      case 'NO-ANSWER':
      case 'BUSY':
      case 'FAILED': return 'failed';
      default: return 'ringing';
    }
  }

  private async twilioPost(path: string, body: Record<string, string>): Promise<void> {
    if (!env.telephonyAccountId || !env.telephonyAuthToken) throw new Error('Twilio is not configured.');
    const auth = Buffer.from(`${env.telephonyAccountId}:${env.telephonyAuthToken}`).toString('base64');
    const res = await fetch(`${TWILIO_API}/${env.telephonyAccountId}${path}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
    if (!res.ok) {
      logger.error('twilio_action_failed', { path, status: res.status });
      throw new Error(`Twilio action failed (${res.status}).`);
    }
  }
}

function holdTwiML(hold: boolean): string {
  return hold
    ? '<Response><Pause length="300" /></Response>'
    : '<Response><Redirect>/api/telephony/bridge-answer</Redirect></Response>';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}