/**
 * Pure state-machine rules for the processing pipeline. All state lives in
 * Postgres rows; these functions only decide what is allowed to happen next.
 */

import type { Segment } from "@/lib/db/schema";

export const MAX_SEGMENT_ATTEMPTS = 3;

export type AiStatus = "idle" | "processing" | "ready" | "confirmed" | "failed";

const AI_TRANSITIONS: Record<AiStatus, AiStatus[]> = {
  idle: ["processing"],
  processing: ["ready", "failed", "processing"],
  ready: ["confirmed", "processing"],
  confirmed: ["processing"],
  failed: ["processing"],
};

export function canTransitionAiStatus(from: AiStatus, to: AiStatus): boolean {
  return AI_TRANSITIONS[from].includes(to);
}

/**
 * Segments still owed work, in order. Includes failed segments that have
 * retry budget left, so a retry resumes exactly where the pipeline died.
 */
export function pendingSegments(all: Segment[]): Segment[] {
  return [...all]
    .sort((a, b) => a.idx - b.idx)
    .filter(
      (s) =>
        s.status === "pending" ||
        s.status === "transcribing" || // orphaned by a crashed run
        (s.status === "failed" && s.attempts < MAX_SEGMENT_ATTEMPTS),
    );
}

export function allSegmentsDone(all: Segment[]): boolean {
  return all.length > 0 && all.every((s) => s.status === "done");
}

/** True when at least one segment is permanently failed (retries exhausted). */
export function hasExhaustedSegments(all: Segment[]): boolean {
  return all.some(
    (s) => s.status === "failed" && s.attempts >= MAX_SEGMENT_ATTEMPTS,
  );
}
