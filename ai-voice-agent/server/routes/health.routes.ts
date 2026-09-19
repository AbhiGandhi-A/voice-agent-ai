import { Request, Response } from 'express';
import { supabasePing } from '../db/supabase';
import { ollamaService } from '../services/ai/ollama.service';
import { sttService } from '../services/stt/stt.service';
import { ttsService } from '../services/tts/tts.service';
import { getProvider } from '../services/telephony/index';
import { visionService } from '../services/vision/vision.service';
import { env } from '../config/env';

export const health = async (_req: Request, res: Response): Promise<void> => {
  const [, database, ollama, stt, tts, telephony, vision] = await Promise.all([
    Promise.resolve(),
    supabasePing().catch(() => false),
    ollamaService.isAvailable().catch(() => false),
    sttService.status().catch(() => ({ available: false, provider: 'unknown' })),
    ttsService.status().catch(() => ({ available: false, provider: 'unknown' })),
    Promise.resolve(getProvider().describe()),
    visionService.checkHealth().catch(() => ({ status: 'offline' as const, available: false, provider: 'local-python', model: '', device: 'cpu' })),
  ]);

  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: { connected: database, provider: database ? 'supabase' : 'unconfigured' },
    ai: {
      available: ollama,
      provider: 'ollama',
      baseUrl: env.ollamaBaseUrl,
      status: ollama ? 'online' : 'offline',
      model: ollama ? ollamaService.configuredModel() || undefined : undefined,
    },
    vision,
    stt,
    tts,
    telephony,
  });
};