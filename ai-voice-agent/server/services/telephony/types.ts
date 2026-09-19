import type { Request } from 'express';
import type { IncomingMessage } from 'http';

export interface MakeCallOptions {
  to: string;
  from?: string;
  callId: string;
  webhookUrl: string;
}

export interface ProviderCall {
  providerCallId: string;
  /** URL or route that streams the call audio to our media bridge. */
  mediaUrl?: string;
}

export type ProviderEventType = 'initiated' | 'ringing' | 'answered' | 'completed' | 'canceled' | 'failed' | 'media_started' | 'hold' | 'unhold';

export interface ProviderEvent {
  eventType: ProviderEventType;
  providerCallId?: string;
  /** Our internal call id when the provider surfaces it (e.g. Telnyx custom headers). */
  callId?: string;
  raw: unknown;
}

export interface HoldOptions {
  providerCallId: string;
  hold: boolean;
}

export interface TransferOptions {
  providerCallId: string;
  to: string;
}

export interface WebhookHandlers {
  /** Route provider events to our state machine. */
  onEvent(event: ProviderEvent): Promise<void>;
}

export interface TelephonyProvider {
  readonly name: string;
  isConfigured(): boolean;
  describe(): { configured: boolean; details: string };
  makeCall(options: MakeCallOptions): Promise<ProviderCall>;
  hangup(providerCallId: string): Promise<void>;
  hold(options: HoldOptions): Promise<void>;
  transfer(options: TransferOptions): Promise<void>;
  /** Verify authenticity of an incoming webhook request. */
  verifyRequest(req: Request | IncomingMessage, rawBody: Buffer): boolean | Promise<boolean>;
  /** Let the provider-specific implementation parse its webhook into a ProviderEvent. */
  parseWebhook(rawBody: Buffer, req: Request | IncomingMessage): ProviderEvent | null;
}