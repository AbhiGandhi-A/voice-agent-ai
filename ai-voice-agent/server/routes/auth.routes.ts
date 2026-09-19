import { Request, Response } from 'express';
import { z } from 'zod';
import { getAdminClient } from '../db/supabase';
import { logger } from '../utils/logger';

export const me = async (req: Request, res: Response): Promise<void> => {
  res.json({ user: req.user, supabaseConfigured: Boolean(getAdminClient()) });
};

const updateProfileSchema = z.object({ fullName: z.string().min(1).max(120) });

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'fullName must be a non-empty string.' });
    return;
  }
  const client = getAdminClient();
  if (!client) {
    res.status(503).json({ error: 'Database not configured.' });
    return;
  }
  const { error } = await client
    .from('profiles')
    .update({ full_name: parsed.data.fullName })
    .eq('id', req.user!.id);
  if (error) {
    logger.error('profile_update_failed', { message: error.message });
    res.status(500).json({ error: 'Failed to update profile.' });
    return;
  }
  res.json({ ok: true, id: req.user!.id, fullName: parsed.data.fullName });
};

export const authRouter = { me, updateProfile };