/**
 * Runtime diagnostics for the AI Voice Agent stack.
 * Usage: npm run db:diag
 */
import { env, isSupabaseConfigured, isTelephonyConfigured } from '../server/config/env';
import { supabasePing } from '../server/db/supabase';
import { ollamaService } from '../server/services/ai/ollama.service';
import { sttService } from '../server/services/stt/stt.service';
import { ttsService } from '../server/services/tts/tts.service';
import { getProvider } from '../server/services/telephony/index';

async function table(name: string): Promise<string | null> {
  const client = (await import('../server/db/supabase')).getAdminClient();
  if (!client) return 'unconfigured';
  const { error } = await client.from(name).select('count', { count: 'exact', head: true });
  return error ? `error: ${error.message}` : 'ok';
}

async function main(): Promise<void> {
  console.log('=== AI Voice Agent — Runtime Diagnostics ===\n');
  console.log(`Environment : ${env.nodeEnv}`);
  console.log(`Port        : ${env.port}`);
  console.log(`App URL     : ${env.appUrl}`);

  console.log('\n[Database] Supabase');
  const dbConfigured = isSupabaseConfigured();
  console.log(`  configured        : ${dbConfigured}`);
  if (dbConfigured) {
    console.log(`  URL host          : ${env.supabaseUrl?.replace(/^https?:\/\//, '').split('/')[0]}`);
    const ping = await supabasePing();
    console.log(`  ping              : ${ping ? 'ok' : 'FAILED (check network / RLS / keys)'}`);
    for (const t of ['profiles', 'contacts', 'conversations', 'messages', 'calls', 'call_events', 'call_summaries', 'system_settings']) {
      console.log(`  table ${t.padEnd(17)}: ${await table(t)}`);
    }
  }

  console.log('\n[AI] Ollama');
  console.log(`  base URL          : ${env.ollamaBaseUrl}`);
  const ollamaUp = await ollamaService.isAvailable();
  console.log(`  reachable         : ${ollamaUp}`);
  if (ollamaUp) {
    const models = await ollamaService.listModels();
    console.log(`  models (${models.length})  : ${models.map((m) => m.name).join(', ') || '(none pulled)'}`);
    console.log(`  default model     : ${env.ollamaModel || '(auto: first available)'}`);
  }

  console.log('\n[STT]');
  const stt = await sttService.status();
  console.log(`  provider          : ${stt.provider} (${stt.status})`);
  console.log(`  details           : ${stt.details}`);

  console.log('\n[TTS]');
  const tts = await ttsService.status();
  console.log(`  provider          : ${tts.provider} (${tts.status})`);
  console.log(`  details           : ${tts.details}`);

  console.log('\n[Telephony]');
  const telephony = getProvider().describe();
  console.log(`  provider          : ${getProvider().name} (${telephony.configured ? 'configured' : 'NOT configured'})`);
  console.log(`  detail            : ${telephony.details}`);
  console.log(`  global flag       : ${isTelephonyConfigured() ? 'configured' : 'NOT configured'}`);

  console.log('\nNote: Supabase is used for persistence + auth. Ollama/STT/TTS must be reachable.');
  console.log('Provider media streaming (Twilio <Stream> / Telnyx) requires telephony credentials.');
  console.log('See .env.example and docs/WINDOWS_SETUP.md.');
}

main().then(() => {
  console.log('\nDiagnostics complete.');
}).catch((err) => {
  console.error('Diagnostics failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});