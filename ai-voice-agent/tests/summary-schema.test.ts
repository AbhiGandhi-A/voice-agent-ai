import { describe, it, expect } from 'vitest';
import { SUMMARY_SCHEMA } from '../server/services/summary/summary.service';

describe('SUMMARY_SCHEMA', () => {
  const valid = {
    summary: 'Caller asked about a refund and was helped.',
    customer_intent: 'Refund request',
    outcome: 'resolved',
    action_items: ['Send refund confirmation email'],
    sentiment: 'positive',
    escalation_required: false,
  };

  it('accepts a valid generated summary', () => {
    const parsed = SUMMARY_SCHEMA.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.outcome).toBe('resolved');
      expect(parsed.data.action_items).toHaveLength(1);
    }
  });

  it('rejects missing required fields', () => {
    const { summary, ...withoutSummary } = valid;
    const parsed = SUMMARY_SCHEMA.safeParse(withoutSummary);
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown outcome', () => {
    const parsed = SUMMARY_SCHEMA.safeParse({ ...valid, outcome: 'mystery' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a non-boolean escalation flag', () => {
    const parsed = SUMMARY_SCHEMA.safeParse({ ...valid, escalation_required: 'yes' });
    expect(parsed.success).toBe(false);
  });

  it('defaults escalation and sentiment when omitted', () => {
    const { escalation_required: _omit, ...withoutFlag } = valid;
    const { sentiment: _omit2, ...withoutSentiment } = { ...valid, sentiment: undefined as unknown as string };
    const parsed = SUMMARY_SCHEMA.safeParse({ ...withoutFlag, sentiment: undefined });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.escalation_required).toBe(false);
      expect(parsed.data.sentiment).toBe('neutral');
    }
    void withoutSentiment;
  });
});