import { Router } from 'express';
import { z } from 'zod';
import { validate, parseId } from '../middleware/validate';
import { conversationsService } from '../services/conversations/conversations.service';
import { contactsService } from '../services/contacts/contacts.service';

export const conversationsRouter = Router();

conversationsRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const result = await conversationsService.list(req.user!.id, { page, limit, search, type, status });
  res.json(result);
});

conversationsRouter.post('/', validate(z.object({ contactId: z.string().uuid().optional(), title: z.string().max(160).optional() })), async (req, res) => {
  const { contactId, title } = req.body as { contactId?: string; title?: string };
  const created = await conversationsService.create({ userId: req.user!.id, contactId, title });
  res.status(201).json(created);
});

conversationsRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'conversation id');
  const conversation = await conversationsService.getById(id);
  let contact = null;
  if (conversation.contact_id) {
    contact = await contactsService.findById(conversation.contact_id as string).catch(() => null);
  }
  res.json({ ...conversation, contact });
});

conversationsRouter.get('/:id/messages', async (req, res) => {
  const id = parseId(req.params.id, 'conversation id');
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(await conversationsService.listMessages(id, { page }));
});

conversationsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'conversation id');
  await conversationsService.delete(id);
  res.json({ ok: true });
});