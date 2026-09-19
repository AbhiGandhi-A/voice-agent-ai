import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { visionService } from '../services/vision/vision.service';

export const visionRouter = Router();

visionRouter.get('/status', async (_req, res) => {
  const health = await visionService.checkHealth();
  const latestState = visionService.getLatestState();
  res.json({
    health,
    latestState,
  });
});

visionRouter.post(
  '/frame',
  validate(
    z.object({
      image: z.string().min(10),
      cameraActive: z.boolean().optional(),
    })
  ),
  async (req, res) => {
    const { image, cameraActive } = req.body as { image: string; cameraActive?: boolean };
    const result = await visionService.analyzeFrame(image, cameraActive !== false);
    res.json(result);
  }
);

visionRouter.post(
  '/camera-state',
  validate(
    z.object({
      cameraActive: z.boolean(),
    })
  ),
  async (req, res) => {
    const { cameraActive } = req.body as { cameraActive: boolean };
    visionService.setCameraState(cameraActive);
    res.json({ ok: true, cameraActive });
  }
);

