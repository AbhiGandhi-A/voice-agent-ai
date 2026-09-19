import { logger } from '../../utils/logger';
import { MediaStreamSession } from './voice/media-session';

/**
 * In-memory registry of active media bridge sessions (one per live call).
 * Lives and dies with the Node process — telephony webhooks re-query Supabase,
 * but low-latency audio routing stays in RAM.
 */
const sessions = new Map<string, MediaStreamSession>();

export function attachMediaSession(providerCallId: string, session: MediaStreamSession): void {
  closeMediaSession(providerCallId);
  sessions.set(providerCallId, session);
  logger.info('media_session_attached', { providerCallId });
}

export function getMediaSession(providerCallId: string): MediaStreamSession | undefined {
  return sessions.get(providerCallId);
}

export async function closeMediaSession(providerCallId: string): Promise<void> {
  const session = sessions.get(providerCallId);
  if (session) {
    await session.close().catch(() => undefined);
    sessions.delete(providerCallId);
    logger.info('media_session_closed', { providerCallId });
  }
}

export function closeAllMediaSessions(): Promise<void[]> {
  const ids = [...sessions.keys()];
  return Promise.all(ids.map((id) => closeMediaSession(id)));
}