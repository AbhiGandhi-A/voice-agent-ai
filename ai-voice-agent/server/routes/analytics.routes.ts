import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { analyticsService } from '../services/analytics/analytics.service';

export const analyticsRouter = Router();

const rangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

analyticsRouter.get('/calls', validate(rangeSchema, 'query'), async (req, res) => {
  const q = req.query as z.infer<typeof rangeSchema>;
  res.json(await analyticsService.callAnalytics({ from: q.from, to: q.to }));
});

analyticsRouter.get('/trend', validate(rangeSchema.merge(z.object({ bucket: z.enum(['day', 'hour', 'month']).default('day') })), 'query'), async (req, res) => {
  const q = req.query as z.infer<typeof rangeSchema> & { bucket: 'day' | 'hour' | 'month' };
  res.json(await analyticsService.callTrend({ from: q.from, to: q.to }, q.bucket));
});

analyticsRouter.get('/summary', validate(rangeSchema, 'query'), async (req, res) => {
  const q = req.query as z.infer<typeof rangeSchema>;
  res.json(await analyticsService.countSummaries({ from: q.from, to: q.to }));
});