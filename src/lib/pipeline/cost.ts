/**
 * Cost estimation shown in the UI before processing starts.
 * Rates verified against developers.openai.com/api/docs/pricing on 2026-07-05.
 */

export const TRANSCRIPTION_RATE_PER_MINUTE: Record<string, number> = {
  "gpt-4o-mini-transcribe": 0.003,
  "gpt-4o-transcribe": 0.006,
};

export function estimateTranscriptionCostUsd(
  durationSeconds: number,
  model: string,
): number {
  const rate = TRANSCRIPTION_RATE_PER_MINUTE[model];
  if (rate === undefined) {
    throw new Error(`Unknown transcription model: ${model}`);
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return (durationSeconds / 60) * rate;
}

export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return "less than $0.01";
  return `$${amount.toFixed(2)}`;
}
