import { describe, expect, it } from "vitest";

import { estimateTranscriptionCostUsd, formatUsd } from "@/lib/pipeline/cost";
import {
  attachmentRegisterSchema,
  taskCreateSchema,
  taskUpdateSchema,
} from "@/lib/validation";

describe("taskCreateSchema", () => {
  it("accepts a minimal valid task and trims the title", () => {
    const result = taskCreateSchema.parse({ title: "  Ship it  " });
    expect(result.title).toBe("Ship it");
  });

  it("rejects empty and oversized titles", () => {
    expect(taskCreateSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: "x".repeat(301) }).success).toBe(
      false,
    );
    expect(taskCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe("taskUpdateSchema", () => {
  it("accepts partial updates including clearing the due date", () => {
    expect(taskUpdateSchema.safeParse({ status: "done" }).success).toBe(true);
    expect(taskUpdateSchema.safeParse({ dueDate: null }).success).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(taskUpdateSchema.safeParse({ status: "someday" }).success).toBe(false);
  });
});

describe("attachmentRegisterSchema", () => {
  const valid = {
    taskId: "3f0b8f9e-7c3a-4f6e-9b2d-1a2b3c4d5e6f",
    kind: "audio",
    originalName: "meeting.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1000,
    durationSeconds: 3600,
    segments: [
      {
        idx: 0,
        startSeconds: 0,
        endSeconds: 600,
        url: "https://blob.example.com/a.mp3",
        pathname: "tasks/x/audio/0.mp3",
      },
    ],
  };

  it("accepts a chunked audio registration", () => {
    expect(attachmentRegisterSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects bad uuids, negative sizes, and absurd durations", () => {
    expect(
      attachmentRegisterSchema.safeParse({ ...valid, taskId: "nope" }).success,
    ).toBe(false);
    expect(
      attachmentRegisterSchema.safeParse({ ...valid, sizeBytes: -1 }).success,
    ).toBe(false);
    expect(
      attachmentRegisterSchema.safeParse({
        ...valid,
        durationSeconds: 60 * 60 * 13,
      }).success,
    ).toBe(false);
  });
});

describe("cost estimation", () => {
  it("prices an hour of audio per model", () => {
    expect(estimateTranscriptionCostUsd(3600, "gpt-4o-mini-transcribe")).toBeCloseTo(
      0.18,
    );
    expect(estimateTranscriptionCostUsd(3600, "gpt-4o-transcribe")).toBeCloseTo(
      0.36,
    );
  });

  it("returns 0 for empty input and throws for unknown models", () => {
    expect(estimateTranscriptionCostUsd(0, "gpt-4o-transcribe")).toBe(0);
    expect(() => estimateTranscriptionCostUsd(60, "unknown")).toThrow();
  });

  it("formats sub-cent amounts honestly", () => {
    expect(formatUsd(0.004)).toBe("less than $0.01");
    expect(formatUsd(1.5)).toBe("$1.50");
  });
});
