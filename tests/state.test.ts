import { describe, expect, it } from "vitest";

import type { Segment } from "@/lib/db/schema";
import {
  MAX_SEGMENT_ATTEMPTS,
  allSegmentsDone,
  canTransitionAiStatus,
  hasExhaustedSegments,
  pendingSegments,
} from "@/lib/pipeline/state";

function segment(overrides: Partial<Segment>): Segment {
  return {
    id: "s",
    attachmentId: "a",
    idx: 0,
    startSeconds: 0,
    endSeconds: 600,
    blobUrl: "https://example.com/blob",
    blobPathname: "blob",
    status: "pending",
    transcript: null,
    error: null,
    attempts: 0,
    ...overrides,
  };
}

describe("canTransitionAiStatus", () => {
  it("allows the golden path", () => {
    expect(canTransitionAiStatus("idle", "processing")).toBe(true);
    expect(canTransitionAiStatus("processing", "ready")).toBe(true);
    expect(canTransitionAiStatus("ready", "confirmed")).toBe(true);
  });

  it("allows regeneration from every settled state", () => {
    expect(canTransitionAiStatus("ready", "processing")).toBe(true);
    expect(canTransitionAiStatus("confirmed", "processing")).toBe(true);
    expect(canTransitionAiStatus("failed", "processing")).toBe(true);
  });

  it("blocks confirming anything that is not ready", () => {
    expect(canTransitionAiStatus("idle", "confirmed")).toBe(false);
    expect(canTransitionAiStatus("processing", "confirmed")).toBe(false);
    expect(canTransitionAiStatus("failed", "confirmed")).toBe(false);
  });
});

describe("pendingSegments", () => {
  it("returns pending and orphaned-transcribing segments in idx order", () => {
    const queue = pendingSegments([
      segment({ id: "b", idx: 2, status: "transcribing" }),
      segment({ id: "a", idx: 0, status: "pending" }),
      segment({ id: "c", idx: 1, status: "done" }),
    ]);
    expect(queue.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("retries failed segments until attempts run out", () => {
    const retriable = segment({ status: "failed", attempts: MAX_SEGMENT_ATTEMPTS - 1 });
    const exhausted = segment({ status: "failed", attempts: MAX_SEGMENT_ATTEMPTS });
    expect(pendingSegments([retriable])).toHaveLength(1);
    expect(pendingSegments([exhausted])).toHaveLength(0);
  });
});

describe("allSegmentsDone / hasExhaustedSegments", () => {
  it("requires at least one segment to be done", () => {
    expect(allSegmentsDone([])).toBe(false);
    expect(allSegmentsDone([segment({ status: "done" })])).toBe(true);
    expect(
      allSegmentsDone([segment({ status: "done" }), segment({ status: "pending" })]),
    ).toBe(false);
  });

  it("flags exhausted segments only after retries run out", () => {
    expect(
      hasExhaustedSegments([segment({ status: "failed", attempts: 1 })]),
    ).toBe(false);
    expect(
      hasExhaustedSegments([
        segment({ status: "failed", attempts: MAX_SEGMENT_ATTEMPTS }),
      ]),
    ).toBe(true);
  });
});
