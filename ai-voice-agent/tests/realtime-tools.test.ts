import { describe, expect, it } from 'vitest';
import { getCurrentTime, parseMemoryCommand, selectRealtimeTool } from '../server/services/ai/realtime-tools';
import { validateMemoryText } from '../server/services/memory/memories.service';

describe('realtime assistant tools', () => {
  it('formats current time using the requested timezone', () => {
    const result = getCurrentTime('Asia/Kolkata', new Date('2026-09-19T09:00:00.000Z'));
    expect(result.date).toBe('September 19, 2026');
    expect(result.dayOfWeek).toBe('Saturday');
    expect(result.timezone).toBe('Asia/Kolkata');
    expect(result.time).toContain('2:30');
  });

  it('selects current time before generic web search', () => {
    expect(selectRealtimeTool('What day is today?')).toBe('current_time');
    expect(selectRealtimeTool('What is the latest React version?')).toBe('web_search');
    expect(selectRealtimeTool('Explain React hooks.')).toBeNull();
  });

  it('parses explicit remember and forget commands', () => {
    expect(parseMemoryCommand('Remember that I prefer JavaScript.')).toEqual({ action: 'remember', text: 'I prefer JavaScript.' });
    expect(parseMemoryCommand('Forget that I prefer JavaScript.')).toEqual({ action: 'forget', text: 'I prefer JavaScript.' });
    expect(parseMemoryCommand('Explain JavaScript.')).toBeNull();
  });

  it('rejects secret-like memory content', () => {
    expect(() => validateMemoryText('my API key is secret')).toThrow();
    expect(validateMemoryText('I prefer backend development')).toBe('I prefer backend development');
  });
});
