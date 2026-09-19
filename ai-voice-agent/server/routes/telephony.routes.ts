import { Router } from 'express';
import { getProvider } from '../services/telephony/index';
import { logger } from '../utils/logger';

export const telephonyRouter = Router();

telephonyRouter.get('/status', (_req, res) => {
  const provider = getProvider();
  res.json({ provider: provider.name, ...provider.describe() });
});