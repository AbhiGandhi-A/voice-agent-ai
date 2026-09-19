import { Router } from 'express';
import { z } from 'zod';
import { validate, parseId } from '../middleware/validate';
import { callRateLimit, summaryRateLimit } from '../middleware/rate-limit';
import { callsService } from '../services/calls/calls.service';
import { getProvider } from '../services/telephony/index';
import { startMediaSession } from '../services/calls/webhook-hub';
import { conversationsService } from '../services/conversations/conversations.service';
import { generateCallSummary, ollamaSummaryAvailable } from '../services/summary/summary.service';
import { env } from '../config/env';
import { ApiError } from '../middleware/error';
import { logger } from '../utils/logger';

export const callsRouter = Router();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

callsRouter.get('/', validate(listQuery, 'query'), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listQuery>;
  const isAdmin = req.user!.role === 'admin' || req.user!.role === 'supervisor';
  const result = isAdmin ? await callsService.list(q) : await callsService.listByUser(req.user!.id, q);
  res.json(result);
});

const outboundSchema = z.object({
  phoneNumber: z.string().min(5).max(32),
  contactId: z.string().uuid().optional(),
});

callsRouter.post('/outbound', callRateLimit, validate(outboundSchema), async (req, res) => {
  const { phoneNumber, contactId } = req.body as { phoneNumber: string; contactId?: string };

  const provider = getProvider();
  if (!provider.isConfigured()) {
    res.status(503).json({ error: provider.describe().details, code: 'telephony_not_configured' });
    return;
  }

  const call = await callsService.createCall({
    userId: req.user!.id,
    phoneNumber,
    contactId,
    direction: 'outbound',
    provider: provider.name,
  });

  const webhookUrl = `${env.appUrl}/api/telephony/webhook`;

  try {
    const providerCall = await provider.makeCall({ to: phoneNumber, callId: call.id as string, webhookUrl });
    await callsService.updateCall(call.id as string, { provider_call_id: providerCall.providerCallId, status: 'ringing' });
    await callsService.logEvent(null, call.id as string, { eventType: 'call_ringing', payload: {} });
    res.status(201).json({ ok: true, call, providerCallId: providerCall.providerCallId });
  } catch (err) {
    await callsService.updateCall(call.id as string, { status: 'failed' });
    logger.error('outbound_call_failed', { message: err instanceof Error ? err.message : 'unknown' });
    res.status(502).json({ error: err instanceof Error ? err.message : 'Provider call failed.', code: 'provider_error' });
  }
});

callsRouter.post('/media-start', callRateLimit, validate(z.object({ callId: z.string().uuid(), providerCallId: z.string().min(1), phoneNumber: z.string().optional() })), async (req, res) => {
  const { callId, providerCallId, phoneNumber } = req.body as { callId: string; providerCallId: string; phoneNumber?: string };
  const call = await callsService.getCall(callId);

  await startMediaSession({
    callId,
    userId: call.user_id as string,
    providerCallId,
    conversationId: (call.conversation_id as string | null) ?? null,
    phoneNumber: phoneNumber ?? (call.phone_number as string) ?? '',
    sendAudio: () => undefined,
    silenceOutbound: () => undefined,
  });

  await callsService.updateCallStatus(callId, 'ai_active');
  await callsService.logEvent(null, callId, { eventType: 'ai_started', payload: {} });
  res.json({ ok: true });
});

callsRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'call id');
  const call = await callsService.getCall(id);
  let messages: { messages: unknown[]; total: number } | null = null;
  if (call.conversation_id) {
    messages = await conversationsService.listMessages(call.conversation_id as string);
  }
  res.json({ ...call, messages: messages?.messages ?? [], messageTotal: messages?.total ?? 0 });
});

callsRouter.patch('/:id/status', validate(z.object({ status: z.enum(['ringing', 'connected', 'ai_active', 'human_active', 'on_hold', 'transferring', 'ended', 'failed']) })), async (req, res) => {
  const id = parseId(req.params.id, 'call id');
  const { status } = req.body as { status: string };
  try {
    res.json(await callsService.updateCallStatus(id, status as never));
  } catch (err) {
    if (err instanceof ApiError) res.status(err.status).json({ error: err.message, code: err.code });
    else res.status(500).json({ error: 'Failed to update call status.' });
  }
});

callsRouter.post('/:id/hangup', callRateLimit, async (req, res) => {
  const id = parseId(req.params.id, 'call id');
  const call = await callsService.getCall(id);
  const providerCallId = call.provider_call_id as string | null;

  if (providerCallId) {
    try {
      await getProvider().hangup(providerCallId);
    } catch (err) {
      logger.warn('provider_hangup_failed', { message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  await callsService.updateCallStatus(id, 'ended');
  await callsService.logEvent(null, id, { eventType: 'call_ended', payload: { reason: 'user_initiated' } });
  res.json({ ok: true });
});

callsRouter.post('/:id/hold', callRateLimit, validate(z.object({ hold: z.boolean() })), async (req, res) => {
  const id = parseId(req.params.id, 'call id');
  const { hold } = req.body as { hold: boolean };
  const call = await callsService.getCall(id);
  const providerCallId = call.provider_call_id as string | null;

  if (providerCallId) {
    try {
      await getProvider().hold({ providerCallId, hold });
    } catch (err) {
      logger.warn('provider_hold_failed', { message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  await callsService.updateCallStatus(id, hold ? 'on_hold' : 'ai_active');
  await callsService.logEvent(null, id, { eventType: hold ? 'hold' : 'resume', payload: {} });
  res.json({ ok: true });
});

callsRouter.post('/:id/transfer', callRateLimit, validate(z.object({ to: z.string().min(5).max(32) })), async (req, res) => {
  const id = parseId(req.params.id, 'call id');
  const { to } = req.body as { to: string };
  const call = await callsService.getCall(id);
  const providerCallId = call.provider_call_id as string | null;

  if (providerCallId) {
    try {
      await getProvider().transfer({ providerCallId, to });
    } catch (err) {
      logger.warn('provider_transfer_failed', { message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  await callsService.updateCallStatus(id, 'transferring');
  await callsService.updateAiStatus(id, 'transferred');
  await callsService.logEvent(null, id, { eventType: 'transfer', payload: { to } });
  res.json({ ok: true });
});

callsRouter.post('/:id/summary', summaryRateLimit, async (req, res) => {
  const id = parseId(req.params.id, 'call id');
  if (!(await ollamaSummaryAvailable())) {
    res.status(503).json({ error: 'Ollama is not running. Summary generation is unavailable.', code: 'ollama_unavailable' });
    return;
  }
  try {
    const summary = await generateCallSummary(id);
    res.json({ ok: true, summary });
  } catch (err) {
    if (err instanceof ApiError) res.status(err.status).json({ error: err.message, code: err.code });
    else res.status(500).json({ error: 'Summary generation failed.' });
  }
});