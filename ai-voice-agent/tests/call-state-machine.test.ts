import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isTerminal,
  aiModeToState,
  ALLOWED_TRANSITIONS,
} from '../server/services/calls/call-state-machine';

describe('call-state-machine', () => {
  it('allows skipping to the same state', () => {
    expect(canTransition('ended', 'ended')).toBe(true);
    expect(canTransition('failed', 'failed')).toBe(true);
  });

  it('allows expected transitions', () => {
    expect(canTransition('idle', 'ringing')).toBe(true);
    expect(canTransition('ringing', 'connected')).toBe(true);
    expect(canTransition('connecting', 'connected')).toBe(true);
    expect(canTransition('connected', 'ai_active')).toBe(true);
    expect(canTransition('ai_active', 'human_active')).toBe(true);
    expect(canTransition('on_hold', 'connected')).toBe(true);
    expect(canTransition('transferring', 'connected')).toBe(true);
    expect(canTransition('ai_active', 'ended')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('idle', 'ai_active')).toBe(false);
    expect(canTransition('ringing', 'on_hold')).toBe(false);
    expect(canTransition('ended', 'connected')).toBe(false);
    expect(canTransition('failed', 'ringing')).toBe(false);
  });

  it('marks terminal states', () => {
    expect(isTerminal('ended')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('connected')).toBe(false);
  });

  it('covers every state in the transition table', () => {
    for (const from of Object.keys(ALLOWED_TRANSITIONS)) {
      for (const to of ALLOWED_TRANSITIONS[from as keyof typeof ALLOWED_TRANSITIONS]) {
        expect(canTransition(from as never, to)).toBe(true);
      }
    }
  });

  it('maps AI control modes to states', () => {
    expect(aiModeToState('ai')).toBe('ai_active');
    expect(aiModeToState('human')).toBe('human_active');
    expect(aiModeToState('none')).toBeNull();
  });
});