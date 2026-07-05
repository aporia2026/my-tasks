/**
 * Pure segment planning: how a recording's audio track is split into chunks
 * that fit comfortably under OpenAI's 25MB per-file transcription cap.
 *
 * At 16kHz mono 48kbps MP3, ten minutes is roughly 3.6MB, so the default
 * chunk length leaves a wide safety margin.
 */

export const DEFAULT_SEGMENT_SECONDS = 600;

/** Chunks shorter than this get merged into the previous chunk. */
export const MIN_TAIL_SECONDS = 15;

export interface PlannedSegment {
  idx: number;
  startSeconds: number;
  endSeconds: number;
}

export function planSegments(
  durationSeconds: number,
  segmentSeconds: number = DEFAULT_SEGMENT_SECONDS,
): PlannedSegment[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  if (!Number.isFinite(segmentSeconds) || segmentSeconds <= 0) {
    throw new Error(`segmentSeconds must be positive, got ${segmentSeconds}`);
  }

  const plan: PlannedSegment[] = [];
  for (
    let start = 0, idx = 0;
    start < durationSeconds;
    start += segmentSeconds, idx++
  ) {
    plan.push({
      idx,
      startSeconds: start,
      endSeconds: Math.min(start + segmentSeconds, durationSeconds),
    });
  }

  const last = plan[plan.length - 1];
  if (plan.length > 1 && last.endSeconds - last.startSeconds < MIN_TAIL_SECONDS) {
    plan.pop();
    plan[plan.length - 1].endSeconds = durationSeconds;
  }

  return plan;
}

/**
 * Stitches per-segment transcripts back into one document in segment order.
 * Failed or missing segments leave an explicit gap marker instead of
 * silently producing a shorter transcript.
 */
export function stitchTranscripts(
  parts: Array<{ idx: number; transcript: string | null }>,
): string {
  return [...parts]
    .sort((a, b) => a.idx - b.idx)
    .map((part) =>
      part.transcript && part.transcript.trim().length > 0
        ? part.transcript.trim()
        : `[segment ${part.idx + 1} missing]`,
    )
    .join("\n\n");
}
