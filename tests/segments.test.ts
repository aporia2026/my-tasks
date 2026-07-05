import { describe, expect, it } from "vitest";

import {
  DEFAULT_SEGMENT_SECONDS,
  MIN_TAIL_SECONDS,
  planSegments,
  stitchTranscripts,
} from "@/lib/pipeline/segments";

describe("planSegments", () => {
  it("returns empty for zero, negative, and non-finite durations", () => {
    expect(planSegments(0)).toEqual([]);
    expect(planSegments(-10)).toEqual([]);
    expect(planSegments(Number.NaN)).toEqual([]);
    expect(planSegments(Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it("throws on a non-positive segment length", () => {
    expect(() => planSegments(100, 0)).toThrow();
    expect(() => planSegments(100, -5)).toThrow();
  });

  it("plans a single segment for short audio", () => {
    expect(planSegments(120)).toEqual([
      { idx: 0, startSeconds: 0, endSeconds: 120 },
    ]);
  });

  it("plans exact boundaries with no empty tail", () => {
    const plan = planSegments(DEFAULT_SEGMENT_SECONDS * 2);
    expect(plan).toHaveLength(2);
    expect(plan[1]).toEqual({
      idx: 1,
      startSeconds: DEFAULT_SEGMENT_SECONDS,
      endSeconds: DEFAULT_SEGMENT_SECONDS * 2,
    });
  });

  it("covers a 2 hour recording completely and in order", () => {
    const twoHours = 7200;
    const plan = planSegments(twoHours);
    expect(plan).toHaveLength(12);
    expect(plan[0].startSeconds).toBe(0);
    expect(plan.at(-1)!.endSeconds).toBe(twoHours);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].startSeconds).toBe(plan[i - 1].endSeconds);
      expect(plan[i].idx).toBe(i);
    }
  });

  it("merges a tiny tail chunk into the previous segment", () => {
    const duration = DEFAULT_SEGMENT_SECONDS + MIN_TAIL_SECONDS - 1;
    const plan = planSegments(duration);
    expect(plan).toHaveLength(1);
    expect(plan[0].endSeconds).toBe(duration);
  });

  it("keeps a tail chunk at or above the minimum", () => {
    const duration = DEFAULT_SEGMENT_SECONDS + MIN_TAIL_SECONDS;
    const plan = planSegments(duration);
    expect(plan).toHaveLength(2);
  });
});

describe("stitchTranscripts", () => {
  it("joins transcripts in idx order regardless of input order", () => {
    const result = stitchTranscripts([
      { idx: 1, transcript: "second" },
      { idx: 0, transcript: "first" },
    ]);
    expect(result).toBe("first\n\nsecond");
  });

  it("marks missing and empty segments explicitly", () => {
    const result = stitchTranscripts([
      { idx: 0, transcript: "hello" },
      { idx: 1, transcript: null },
      { idx: 2, transcript: "   " },
    ]);
    expect(result).toContain("[segment 2 missing]");
    expect(result).toContain("[segment 3 missing]");
  });

  it("handles unicode content untouched", () => {
    const hebrew = "שלום, זו פגישה חשובה";
    expect(stitchTranscripts([{ idx: 0, transcript: hebrew }])).toBe(hebrew);
  });

  it("returns empty string for no segments", () => {
    expect(stitchTranscripts([])).toBe("");
  });
});
