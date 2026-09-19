import type { Request } from 'express';
import type { IncomingMessage } from 'http';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { HoldOptions, MakeCallOptions, ProviderCall, ProviderEvent, TelephonyProvider, TransferOptions } from './types';
import { getHeader } from './http-util';

const TELNYX_API = 'https://api.telnyx.com/v2';

/**
 * Telnyx provider — uses Telnyx API v2 outbound calls and inbound webhooks.
 * Media streaming is enabled via the call's TeXML connection streaming config.
 * Signature verification uses the Telnyx-Signature JWT verified with Telnyx's
 * published signing keys (cached from https://api.telnyx.com/keys/{kid}).
 */
export class TelnyxProvider implements TelephonyProvider {
  readonly name = 'telnyx';

  isConfigured(): boolean {
    return Boolean(env.telephonyAccountId && env.telephonyAuthToken && env.telephonyPhoneNumber);
  }

  describe(): { configured: boolean; details: string } {
    if (!this.isConfigured()) {
      return { configured: false, details: 'Telnyx API token / account ID / phone number missing. Set telephonyAccountId, telephonyAuthToken, telephonyPhoneNumber.' };
    }
    return { configured: true, details: `Telnyx account ${env.telephonyAccountId?.slice(0, 6)}…` };
  }

  async makeCall(options: MakeCallOptions): Promise<ProviderCall> {
    if (!this.isConfigured()) throw new Error('Telnyx is not configured.');

    const res = await fetch(`${TELNYX_API}/calls`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.telephonyAuthToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: options.to,
        from: options.from ?? env.telephonyPhoneNumber,
        connection_id: env.telephonyAccountId,
        webhook_url: options.webhookUrl,
        custom_headers: [{ name: 'X-Voice-Agent-Call-Id', value: options.callId }],
      }),
    });

    const body = (await res.json()) as { data?: { call_session_id?: string; call_control_id?: string }; errors?: Array<{ detail?: string }> };
    if (!res.ok) {
      const detail = body.errors?.map((e) => e.detail).join(', ') || res.statusText;
      logger.error('telnyx_make_call_failed', { status: res.status, detail });
      throw new Error(`Telnyx call failed: ${detail}`);
    }
    return { providerCallId: body.data?.call_session_id ?? body.data?.call_control_id ?? '' };
  }

  async hangup(providerCallId: string): Promise<void> {
    await this.telnyxPost(`/calls/${encodeURIComponent(providerCallId)}/actions/hangup`, {});
  }

  async hold(options: HoldOptions): Promise<void> {
    await this.telnyxPost(`/calls/${encodeURIComponent(options.providerCallId)}/actions/hold`, { hold: options.hold });
  }

  async transfer(options: TransferOptions): Promise<void> {
    await this.telnyxPost(`/calls/${encodeURIComponent(options.providerCallId)}/actions/transfer`, { to: options.to });
  }

  /**
   * Telnyx signs webhooks with a JWT in the Telnyx-Signature header (RS256).
   * The signing key is fetched from Telnyx's public keys endpoint and cached.
   */
  async verifyRequest(req: Request | IncomingMessage, _rawBody: Buffer): Promise<boolean> {
    const header = getHeader(req, 'Telnyx-Signature') ?? getHeader(req, 'telnyx-signature');
    if (!header) return false;
    try {
      // Lazy require keeps jwt out of the sync code path.
      const { jwtVerify, importJWK } = await import('jose');
      const parts = header.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { kid?: string };
      const kid = payload.kid ?? 'telnyx';
      const key = await this.fetchSigningKey(kid);
      const { payload: verified } = await jwtVerify(header, await importJWK(key as never, 'RS256'));
      return Boolean(verified && verified.iss === 'Telnyx');
    } catch (err) {
      logger.warn('telnyx_signature_verify_failed', { message: err instanceof Error ? err.message : 'unknown' });
      return false;
    }
  }

  parseWebhook(rawBody: Buffer, req: Request | IncomingMessage): ProviderEvent {
    try {
      const json = JSON.parse(rawBody.toString('utf8')) as { data?: { event_type?: string; payload?: { call_session_id: string; call_control_id?: string; from?: string } } };
      const d = json.data;
      if (!d?.event_type) return null;
      const ev = d.event_type;
      const p = d.payload ?? ({} as Record<string, unknown>);
      const providerCallId = (p.call_session_id as string) ?? (p.call_control_id as string) ?? '';
      const callIdHeader = getHeader(req, 'x-voice-agent-call-id') ?? undefined;
      return {
        eventType: mapEvent(ev),
        providerCallId,
        callId: callIdHeader,
        raw: json,
      };
    } catch {
      return null;
    }
  }

  private async telnyxPost(path: string, body: unknown): Promise<void> {
    if (!env.telephonyAuthToken) throw new Error('Telnyx is not configured.');
    const res = await fetch(`${TELNYX_API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.telephonyAuthToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.error('telnyx_action_failed', { path, status: res.status });
      throw new Error(`Telnyx action failed (${res.status}).`);
    }
  }

  private signingKeyCache = new Map<string, { jwk: unknown; fetchedAt: number }>();

  private async fetchSigningKey(kid: string): Promise<unknown> {
    const cached = this.signingKeyCache.get(kid);
    if (cached && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000) return cached.jwk;
    const res = await fetch(`https://api.telnyx.com/keys/${kid}`);
    if (!res.ok) throw new Error(`Telnyx key fetch failed (${res.status}).`);
    const json = (await res.json()) as { public_key_kty?: unknown };
    const jwk = json.public_key_kty;
    this.signingKeyCache.set(kid, { jwk, fetchedAt: Date.now() });
    return jwk;
  }
}

function mapEvent(type: string): ProviderEvent['eventType'] {
  switch (type) {
    case 'call.initiated': return 'initiated';
    case 'call.ringing': return 'ringing';
    case 'call.answered': return 'answered';
    case 'call.hangup':
    case 'call.completed': return 'completed';
    case 'call.canceled': return 'canceled';
    case 'call.failed':
    case 'call.rejected': return 'failed';
    case 'call.media.streaming.started': return 'media_started';
    case 'call.hold.started': return 'hold';
    case 'call.hold.ended': return 'unhold';
    default: return 'ringing';
  }
}