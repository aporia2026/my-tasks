import { describe, expect, it } from "vitest";

import {
  buildSummaryPrompt,
  parseSummaryResponse,
  parseTodosResponse,
} from "@/lib/ai";

describe("parseSummaryResponse", () => {
  it("parses a clean JSON body", () => {
    const result = parseSummaryResponse(
      '{"description": "Full context", "tldr": "Do the thing"}',
    );
    expect(result.description).toBe("Full context");
    expect(result.tldr).toBe("Do the thing");
    expect(result.todos).toEqual([]);
  });

  it("tolerates code fences and stray prose around the JSON", () => {
    const raw =
      'Sure! Here you go:\n```json\n{"description": "d", "tldr": "t"}\n```\nHope that helps.';
    expect(parseSummaryResponse(raw)).toEqual({
      description: "d",
      tldr: "t",
      todos: [],
    });
  });

  it("parses a todos array and drops blank or non-string entries", () => {
    const result = parseSummaryResponse(
      '{"description": "d", "tldr": "t", "todos": ["  Draft email  ", "", 3, "Send it"]}',
    );
    expect(result.todos).toEqual(["Draft email", "Send it"]);
  });

  it("throws when there is no JSON or fields are missing", () => {
    expect(() => parseSummaryResponse("no json here")).toThrow();
    expect(() => parseSummaryResponse('{"description": "only"}')).toThrow();
    expect(() => parseSummaryResponse('{"description": 5, "tldr": "t"}')).toThrow();
  });
});

describe("parseTodosResponse", () => {
  it("extracts and cleans the todos array", () => {
    expect(
      parseTodosResponse('{"todos": ["First step", "  Second step  "]}'),
    ).toEqual(["First step", "Second step"]);
  });

  it("returns [] for missing, malformed, or non-JSON input", () => {
    expect(parseTodosResponse("nothing here")).toEqual([]);
    expect(parseTodosResponse('{"todos": "not an array"}')).toEqual([]);
    expect(parseTodosResponse("{ broken json")).toEqual([]);
  });
});

describe("buildSummaryPrompt", () => {
  const base = {
    title: "Ship the report",
    notes: null,
    transcripts: [{ name: "standup.mp4", text: "We agreed on Friday." }],
    imageUrls: [{ name: "shot.png", url: "https://example.com/shot.png" }],
    documents: [
      { name: "spec.pdf", url: "https://example.com/spec.pdf", mimeType: "application/pdf" },
    ],
  };

  it("includes the title, transcripts, and attachment counts", () => {
    const prompt = buildSummaryPrompt(base, "short");
    expect(prompt).toContain("Ship the report");
    expect(prompt).toContain("We agreed on Friday.");
    expect(prompt).toContain("1 screenshot(s)");
    expect(prompt).toContain("1 document(s)");
  });

  it("adapts the TLDR instruction to the configured length", () => {
    expect(buildSummaryPrompt(base, "short")).toContain("2-4 sentences");
    expect(buildSummaryPrompt(base, "detailed")).toContain("detailed action plan");
  });

  it("omits the notes section when there are none", () => {
    expect(buildSummaryPrompt(base, "short")).not.toContain("Owner's notes");
    expect(
      buildSummaryPrompt({ ...base, notes: "check with Dana" }, "short"),
    ).toContain("check with Dana");
  });
});
