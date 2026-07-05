import { describe, expect, it } from "vitest";

import { RETENTION_DAYS, isMediaDeletable } from "@/lib/pipeline/retention";

const DAY_MS = 24 * 60 * 60 * 1000;

function input(overrides: Partial<Parameters<typeof isMediaDeletable>[0]> = {}) {
  return {
    policy: "after_confirm" as const,
    taskConfirmed: true,
    attachmentStatus: "transcribed" as const,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    now: new Date("2026-07-05T00:00:00Z"),
    ...overrides,
  };
}

describe("isMediaDeletable", () => {
  it("deletes after confirmation under the default policy", () => {
    expect(isMediaDeletable(input())).toBe(true);
  });

  it("never deletes before the user confirms", () => {
    expect(isMediaDeletable(input({ taskConfirmed: false }))).toBe(false);
  });

  it("never deletes media that is not fully transcribed", () => {
    expect(isMediaDeletable(input({ attachmentStatus: "uploaded" }))).toBe(false);
    expect(isMediaDeletable(input({ attachmentStatus: "transcribing" }))).toBe(false);
    expect(isMediaDeletable(input({ attachmentStatus: "failed" }))).toBe(false);
  });

  it("never re-deletes cleaned media", () => {
    expect(isMediaDeletable(input({ attachmentStatus: "cleaned" }))).toBe(false);
  });

  it("keeps media inside the 30 day window and deletes after it", () => {
    const createdAt = new Date("2026-06-20T00:00:00Z");
    const before = new Date(createdAt.getTime() + (RETENTION_DAYS - 1) * DAY_MS);
    const after = new Date(createdAt.getTime() + RETENTION_DAYS * DAY_MS);
    expect(
      isMediaDeletable(input({ policy: "days_30", createdAt, now: before })),
    ).toBe(false);
    expect(
      isMediaDeletable(input({ policy: "days_30", createdAt, now: after })),
    ).toBe(true);
  });

  it("never deletes under the forever policy", () => {
    expect(isMediaDeletable(input({ policy: "forever" }))).toBe(false);
  });
});
