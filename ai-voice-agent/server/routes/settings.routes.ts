import { Router } from 'express';
import { settingsService, DEFAULT_USER_SETTINGS } from '../services/settings/settings.service';
import { logger } from '../utils/logger';

export const settingsRouter = Router();

settingsRouter.get('/', async (req, res) => {
  const settings = await settingsService.getAll(req.user!.id);
  res.json({ settings, defaults: DEFAULT_USER_SETTINGS });
});

settingsRouter.put('/', async (req, res) => {
  const candidate = (req.body as { settings?: Record<string, Record<string, unknown>> }).settings ?? (req.body as Record<string, Record<string, unknown>>);

  const merged: Record<string, Record<string, unknown>> = {
    ai: { ...DEFAULT_USER_SETTINGS.ai, ...(candidate.ai ?? {}) },
    voice: { ...DEFAULT_USER_SETTINGS.voice, ...(candidate.voice ?? {}) },
    call: { ...DEFAULT_USER_SETTINGS.call, ...(candidate.call ?? {}) },
  };

  try {
    const saved = await settingsService.replaceAll(req.user!.id, merged as never);
    res.json({ ok: true, settings: saved });
  } catch (err) {
    logger.error('save_settings_failed', { message: err instanceof Error ? err.message : 'unknown' });
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});