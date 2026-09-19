import { Request, Response } from 'express';
import { supabasePing } from '../db/supabase';
import { ollamaService } from '../services/ai/ollama.service';
import { sttService } from '../services/stt/stt.service';
import { ttsService } from '../services/tts/tts.service';
import { getProvider } from '../services/telephony/index';
import { env } from '../config/env';

export const health = async (_req: Request, res: Response): Promise<void> => {
  const [, database, ollama, stt, tts, telephony] = await Promise.all([
    Promise.resolve(),
    supabasePing().catch(() => false),
    ollamaService.isAvailable().catch(() => false),
    sttService.status().catch(() => ({ available: false, provider: 'unknown' })),
    ttsService.status().catch(() => ({ available: false, provider: 'unknown' })),
    Promise.resolve(getProvider().describe()),
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
    stt,
    tts,
    telephony,
  });
};