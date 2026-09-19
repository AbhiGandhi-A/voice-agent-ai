import { Router } from 'express';
import { z } from 'zod';
import { aiRateLimit } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { ApiError } from '../middleware/error';
import { ollamaService } from '../services/ai/ollama.service';
import { chatWithAi, chatStatus } from '../services/ai/chat.service';
import { logger } from '../utils/logger';

export const aiRouter = Router();

aiRouter.get('/status', async (_req, res) => {
  res.json(await chatStatus());
});

aiRouter.get('/models', async (_req, res) => {
  if (!(await ollamaService.isAvailable())) {
    res.status(503).json({ error: 'Ollama is not running or not configured.', available: false });
    return;
  }
  const models = await ollamaService.listModels();
  res.json({ available: true, models, count: models.length });
});

aiRouter.post('/chat', aiRateLimit, validate(z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  runtimeContext: z.object({
    currentTime: z.string().datetime().optional(),
    timezone: z.string().max(100).optional(),
    localDateTime: z.string().max(200).optional(),
  }).optional(),
})), async (req, res) => {
  const { message, conversationId, contactId, runtimeContext } = req.body as { message: string; conversationId?: string; contactId?: string; runtimeContext?: { currentTime?: string; timezone?: string; localDateTime?: string } };
  try {
    const result = await chatWithAi({ userId: req.user!.id, message, conversationId, contactId, runtimeContext });
    res.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    logger.error('chat_failed', { message: err instanceof Error ? err.message : 'unknown' });
    res.status(502).json({ error: 'The AI is unavailable right now. Please try again shortly.' });
  }
});

aiRouter.post('/models/:model/pull', aiRateLimit, async (req, res) => {
  try {
    await ollamaService.pull(req.params.model);
    res.json({ ok: true, model: req.params.model });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Pull failed.', code: 'pull_failed' });
  }
});

aiRouter.delete('/models/:model', async (req, res) => {
  try {
    await ollamaService.deleteModel(req.params.model);
    res.json({ ok: true, model: req.params.model });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Delete failed.', code: 'delete_failed' });
  }
});