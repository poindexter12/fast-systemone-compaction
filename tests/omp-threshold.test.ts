import { describe, expect, it } from 'vitest';
import { clearsOmpThreshold, ompTriggerTokens } from '../src/omp-threshold.js';

describe('omp compaction threshold', () => {
  it('uses the token limit ahead of the percentage', () => {
    expect(ompTriggerTokens(200_000, { thresholdTokens: 150_000, thresholdPercent: 70 })).toBe(150_000);
  });

  it('uses the percentage when no token limit is set', () => {
    expect(ompTriggerTokens(200_000, { thresholdPercent: 70 })).toBe(140_000);
  });

  it('clears only at or below 80% of the trigger', () => {
    expect(clearsOmpThreshold(120_000, 150_000)).toBe(true);
    expect(clearsOmpThreshold(120_001, 150_000)).toBe(false);
  });
});