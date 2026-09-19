import { Router } from 'express';
import { z } from 'zod';
import { validate, parseId } from '../middleware/validate';
import { searchRateLimit } from '../middleware/rate-limit';
import { contactsService } from '../services/contacts/contacts.service';

export const contactsRouter = Router();

const createContactSchema = z.object({
  name: z.string().min(1).max(160),
  phone: z.string().min(3).max(32),
  email: z.string().email().max(255).optional().or(z.literal('').transform(() => undefined)),
  company: z.string().max(255).optional().or(z.literal('').transform(() => undefined)),
  notes: z.string().max(2000).optional().or(z.literal('').transform(() => undefined)),
});

contactsRouter.get('/', searchRateLimit, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const result = await contactsService.list(req.user!.id, { page, limit, search });
  res.json(result);
});

contactsRouter.post('/', validate(createContactSchema), async (req, res) => {
  const record = await contactsService.create({ userId: req.user!.id, ...req.body });
  res.status(201).json(record);
});

contactsRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'contact id');
  res.json(await contactsService.findById(id));
});

contactsRouter.put('/:id', validate(createContactSchema.partial()), async (req, res) => {
  const id = parseId(req.params.id, 'contact id');
  res.json(await contactsService.update(id, req.body));
});

contactsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'contact id');
  await contactsService.delete(id);
  res.json({ ok: true });
});