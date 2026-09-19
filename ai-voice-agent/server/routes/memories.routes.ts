import { Router } from 'express';
import { z } from 'zod';
import { validate, parseId } from '../middleware/validate';
import { ApiError } from '../middleware/error';
import { memoriesService } from '../services/memory/memories.service';

export const memoriesRouter = Router();

const memorySchema = z.object({
  memory: z.string().min(1).max(2000),
  category: z.string().max(80).optional(),
  importance: z.number().int().min(1).max(5).optional(),
});

memoriesRouter.get('/', async (req, res) => {
  res.json({ memories: await memoriesService.list(req.user!.id) });
});

memoriesRouter.post('/', validate(memorySchema), async (req, res) => {
  try {
    const memory = await memoriesService.create(req.user!.id, req.body as z.infer<typeof memorySchema>);
    res.status(201).json({ memory });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }
    throw error;
  }
});

memoriesRouter.patch('/:id', validate(memorySchema.partial()), async (req, res) => {
  try {
    const id = parseId(req.params.id, 'memory id');
    const memory = await memoriesService.update(req.user!.id, id, req.body as z.infer<typeof memorySchema>);
    res.json({ memory });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }
    throw error;
  }
});

memoriesRouter.delete('/:id', async (req, res) => {
  try {
    await memoriesService.remove(req.user!.id, parseId(req.params.id, 'memory id'));
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }
    throw error;
  }
});
