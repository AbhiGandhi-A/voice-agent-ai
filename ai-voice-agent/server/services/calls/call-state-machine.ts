export type CallState =
  | 'idle'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ai_active'
  | 'human_active'
  | 'on_hold'
  | 'transferring'
  | 'ended'
  | 'failed';

export const ALLOWED_TRANSITIONS: Record<CallState, CallState[]> = {
  idle: ['ringing', 'connecting', 'ended', 'failed'],
  ringing: ['connecting', 'connected', 'ended', 'failed'],
  connecting: ['connected', 'failed'],
  connected: ['ai_active', 'human_active', 'on_hold', 'transferring', 'ended', 'failed'],
  ai_active: ['human_active', 'on_hold', 'transferring', 'connected', 'ended', 'failed'],
  human_active: ['ai_active', 'on_hold', 'transferring', 'connected', 'ended', 'failed'],
  on_hold: ['ai_active', 'human_active', 'connected', 'ended', 'failed'],
  transferring: ['connected', 'ai_active', 'ended', 'failed'],
  ended: [],
  failed: [],
};

/** Highest-level public states used by callers of the machine. */
export const TERMINAL_STATES: CallState[] = ['ended', 'failed'];

export function canTransition(from: CallState, to: CallState): boolean {
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function isTerminal(state: CallState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * Maps a call AI control mode onto the enumerated call states.
 * An agent speaking with the caller is `ai_active`; a human override is
 * `human_active`.
 */
export function aiModeToState(mode: 'ai' | 'human' | 'none'): CallState | null {
  switch (mode) {
    case 'ai':
      return 'ai_active';
    case 'human':
      return 'human_active';
    default:
      return null;
  }
}