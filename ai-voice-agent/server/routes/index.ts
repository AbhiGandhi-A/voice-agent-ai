import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { authRouter } from './auth.routes';
import { health } from './health.routes';
import { aiRouter } from './ai.routes';
import { contactsRouter } from './contacts.routes';
import { conversationsRouter } from './conversations.routes';
import { callsRouter } from './calls.routes';
import { analyticsRouter } from './analytics.routes';
import { settingsRouter } from './settings.routes';
import { telephonyRouter } from './telephony.routes';
import { webhookRouter } from './telephony-webhook.routes';
import { memoriesRouter } from './memories.routes';
import { visionRouter } from './vision.routes';

export function buildApiRouter(): Router {
  const router = Router();

  router.get('/health', health);
  router.get('/auth/me', requireAuth, authRouter.me);
  router.put('/auth/profile', requireAuth, authRouter.updateProfile);

  router.use('/ai', requireAuth, aiRouter);
  router.use('/vision', requireAuth, visionRouter);
  router.use('/contacts', requireAuth, contactsRouter);
  router.use('/conversations', requireAuth, conversationsRouter);
  router.use('/calls', requireAuth, callsRouter);

  router.use('/telephony', telephonyRouter); // /telephony/status (public)
  router.use('/telephony', webhookRouter); // /telephony/webhook + /telephony/bridge-answer (public, raw body)

  router.use('/analytics', requireAuth, analyticsRouter);
  router.use('/settings', requireAuth, settingsRouter);
  router.use('/memories', requireAuth, memoriesRouter);

  return router;
}