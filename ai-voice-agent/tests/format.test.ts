import { describe, it, expect } from 'vitest';
import { dateLabel, timeLabel, timeLabelSeconds, formatDuration, prettyBytes } from '../src/lib/format';

describe('format', () => {
  describe('dateLabel', () => {
    it('marks today and yesterday', () => {
      expect(dateLabel(new Date().toISOString())).toBe('Today');
      const yesterday = new Date(Date.now() - 86_400_000).toISOString();
      expect(dateLabel(yesterday)).toBe('Yesterday');
    });

    it('handles null/invalid input', () => {
      expect(dateLabel(null)).toBe('—');
      expect(dateLabel('not-a-date')).toBe('—');
    });
  });

  describe('timeLabel', () => {
    it('formats time and guards bad input', () => {
      expect(timeLabel('not-a-date')).toBe('');
      expect(timeLabel(null)).toBe('');
      expect(timeLabel(new Date().toISOString())).toMatch(/\d{1,2}:\d{2}/);
    });

    it('adds seconds variant', () => {
      expect(timeLabelSeconds(new Date().toISOString())).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
  });

  describe('formatDuration', () => {
    it('formats durations', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(null)).toBe('00:00');
      expect(formatDuration(65)).toBe('01:05');
      expect(formatDuration(3601)).toBe('60:01');
      expect(formatDuration(NaN)).toBe('00:00');
    });
  });

  describe('prettyBytes', () => {
    it('formats byte sizes', () => {
      expect(prettyBytes(undefined)).toBe('—');
      expect(prettyBytes(0)).toBe('—');
      expect(prettyBytes(512)).toBe('512 B');
      expect(prettyBytes(1536)).toBe('1.5 KB');
      expect(prettyBytes(1_048_576)).toBe('1.0 MB');
    });
  });
});