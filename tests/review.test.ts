import { describe, expect, it } from "vitest";

import { canProcess, canReviewTransition, requesterStatusLabel } from "@/lib/review";

describe("canProcess", () => {
  it("allows the admin's own tasks and approved tasks", () => {
    expect(canProcess("none")).toBe(true);
    expect(canProcess("accepted")).toBe(true);
  });

  it("blocks tasks still in or out of review", () => {
    expect(canProcess("pending")).toBe(false);
    expect(canProcess("declined")).toBe(false);
  });
});

describe("canReviewTransition", () => {
  it("only lets a pending task be accepted or declined", () => {
    expect(canReviewTransition("pending", "accepted")).toBe(true);
    expect(canReviewTransition("pending", "declined")).toBe(true);
  });

  it("rejects transitions from any other state", () => {
    expect(canReviewTransition("none", "accepted")).toBe(false);
    expect(canReviewTransition("accepted", "declined")).toBe(false);
    expect(canReviewTransition("declined", "accepted")).toBe(false);
  });
});

describe("requesterStatusLabel", () => {
  it("shows review state first", () => {
    expect(
      requesterStatusLabel({ reviewState: "pending", status: "inbox", aiStatus: "idle" }),
    ).toBe("Under review");
    expect(
      requesterStatusLabel({ reviewState: "declined", status: "inbox", aiStatus: "idle" }),
    ).toBe("Declined");
  });

  it("surfaces active work once accepted", () => {
    expect(
      requesterStatusLabel({ reviewState: "accepted", status: "todo", aiStatus: "processing" }),
    ).toBe("Working on it");
    expect(
      requesterStatusLabel({ reviewState: "accepted", status: "in_progress", aiStatus: "idle" }),
    ).toBe("In progress");
    expect(
      requesterStatusLabel({ reviewState: "accepted", status: "done", aiStatus: "confirmed" }),
    ).toBe("Done");
    expect(
      requesterStatusLabel({ reviewState: "accepted", status: "inbox", aiStatus: "idle" }),
    ).toBe("Accepted");
  });
});
