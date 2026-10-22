/**
 * The token count at which omp starts compaction, copied from its
 * `resolveThresholdTokens`: a positive token limit wins over the percentage,
 * and a limit at or beyond the window is not a usable trigger.
 */
export function ompTriggerTokens(
  contextWindow: number,
  settings: { thresholdTokens?: number; thresholdPercent?: number },
): number | undefined {
  if (!(contextWindow > 0)) return undefined;
  const fixed = settings.thresholdTokens;
  if (typeof fixed === 'number' && Number.isFinite(fixed) && fixed > 0) {
    if (fixed >= contextWindow) return undefined;
    return Math.min(contextWindow - 1, Math.max(1, Math.floor(fixed)));
  }
  const percent = settings.thresholdPercent;
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent <= 0) return undefined;
  const clamped = Math.min(99, Math.max(1, percent));
  return Math.floor(contextWindow * (clamped / 100));
}

/**
 * omp only treats a compaction as having cleared the trigger when what remains
 * is at or below 80% of that trigger. At 150000 that line is 120000.
 */
export function clearsOmpThreshold(tokensAfter: number, trigger: number): boolean {
  return tokensAfter <= Math.floor(trigger * 0.8);
}
