import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { HoldOptions, MakeCallOptions, ProviderCall, ProviderEvent, TelephonyProvider, TransferOptions, WebhookHandlers } from './types';
import { TelnyxProvider } from './telnyx.provider';
import { TwilioProvider } from './twilio.provider';

class NullProvider implements TelephonyProvider {
  readonly name = 'none';
  isConfigured(): boolean {
    return false;
  }
  describe(): { configured: boolean; details: string } {
    return { configured: false, details: 'No telephony provider configured. Set TELEPHONY_PROVIDER to "telnyx" or "twilio" and add credentials.' };
  }
  async makeCall(_options: MakeCallOptions): Promise<ProviderCall> {
    throw new Error('telephony_not_configured');
  }
  async hangup(_providerCallId: string): Promise<void> {
    throw new Error('telephony_not_configured');
  }
  async hold(_options: HoldOptions): Promise<void> {
    throw new Error('telephony_not_configured');
  }
  async transfer(_options: TransferOptions): Promise<void> {
    throw new Error('telephony_not_configured');
  }
  verifyRequest(): boolean {
    return false;
  }
  parseWebhook(): ProviderEvent | null {
    return null;
  }
}

let provider: TelephonyProvider | null = null;

export function getProvider(): TelephonyProvider {
  if (provider) return provider;
  switch (env.telephonyProvider) {
    case 'telnyx':
      provider = new TelnyxProvider();
      break;
    case 'twilio':
      provider = new TwilioProvider();
      break;
    default:
      provider = new NullProvider();
  }
  return provider;
}

/** Routes a verified webhook event into the calls service / media bridge. */
export async function dispatchWebhook(event: ProviderEvent, handlers: WebhookHandlers): Promise<void> {
  try {
    await handlers.onEvent(event);
  } catch (err) {
    logger.error('webhook_dispatch_failed', { message: err instanceof Error ? err.message : 'unknown', eventType: event.eventType });
  }
}