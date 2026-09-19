import express, { Request, Response, Router } from 'express';
import { getProvider, dispatchWebhook } from '../services/telephony/index';
import { buildWebhookHandlers } from '../services/calls/webhook-hub';
import { webhookRateLimit } from '../middleware/rate-limit';
import { logger } from '../utils/logger';
import { env } from '../config/env';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Public telephony webhook endpoints. Uses express.raw so we can verify
 * provider signatures over the untouched body before parsing.
 */
export const webhookRouter = Router();

webhookRouter.post('/webhook', webhookRateLimit, express.raw({ type: '*/*', limit: '5mb' }), async (req: Request, res: Response) => {
  const provider = getProvider();
  const rawBody = req.body as Buffer;

  const ok = await provider.verifyRequest(req, rawBody);
  if (!ok) {
    logger.warn('telephony_webhook_signature_failed');
    res.status(401).json({ error: 'Invalid webhook signature.' });
    return;
  }

  const event = provider.parseWebhook(rawBody, req);
  if (!event) {
    res.status(200).json({ status: 'ignored' });
    return;
  }

  const handlers = await buildWebhookHandlers();
  await dispatchWebhook(event, handlers);
  res.status(200).json({ status: 'received' });
});

/** Twilio TwiML answer point — starts a media <Stream> towards our bridge. */
webhookRouter.get('/bridge-answer', (_req: Request, res: Response) => {
  const wssUrl = `wss://${new URL(env.appUrl).host}/api/telephony/media`;
  const twiml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Response><Connect><Stream url="' + escapeXml(wssUrl) + '" track="inbound" />' +
    '<Parameter name="provider" value="twilio" /></Connect></Response>';
  res.type('xml').send(twiml);
});