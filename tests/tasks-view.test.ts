import { describe, expect, it } from "vitest";

import {
  STATUS_ORDER,
  filterTasks,
  groupTasksByStatus,
  sortTasks,
} from "@/lib/tasks-view";
import type { TaskDto } from "@/lib/types";

function task(overrides: Partial<TaskDto>): TaskDto {
  return {
    id: overrides.id ?? "id",
    title: "Task",
    notes: null,
    status: "todo",
    priority: "medium",
    reviewState: "none",
    declineReason: null,
    dueDate: null,
    description: null,
    tldr: null,
    aiStatus: "idle",
    aiError: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sortTasks", () => {
  it("orders high priority before medium before low", () => {
    const sorted = sortTasks([
      task({ id: "low", priority: "low" }),
      task({ id: "high", priority: "high" }),
      task({ id: "medium", priority: "medium" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["high", "medium", "low"]);
  });

  it("breaks priority ties by soonest due date, undated last", () => {
    const sorted = sortTasks([
      task({ id: "none", priority: "high", dueDate: null }),
      task({ id: "late", priority: "high", dueDate: "2026-08-01T00:00:00.000Z" }),
      task({ id: "soon", priority: "high", dueDate: "2026-07-10T00:00:00.000Z" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["soon", "late", "none"]);
  });

  it("breaks remaining ties by newest created", () => {
    const sorted = sortTasks([
      task({ id: "older", createdAt: "2026-07-01T00:00:00.000Z" }),
      task({ id: "newer", createdAt: "2026-07-05T00:00:00.000Z" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["newer", "older"]);
  });

  it("does not mutate its input", () => {
    const input = [task({ id: "a", priority: "low" }), task({ id: "b", priority: "high" })];
    sortTasks(input);
    expect(input.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("filterTasks", () => {
  const tasks = [
    task({ id: "1", title: "Renew the Contoso contract" }),
    task({ id: "2", title: "Budget review", tldr: "Ping Dana about the numbers" }),
    task({ id: "3", title: "Login bug", description: "redirect loop on Safari" }),
  ];

  it("returns everything for an empty or whitespace query", () => {
    expect(filterTasks(tasks, "")).toHaveLength(3);
    expect(filterTasks(tasks, "   ")).toHaveLength(3);
  });

  it("matches title, tldr, and description case-insensitively", () => {
    expect(filterTasks(tasks, "contoso").map((t) => t.id)).toEqual(["1"]);
    expect(filterTasks(tasks, "DANA").map((t) => t.id)).toEqual(["2"]);
    expect(filterTasks(tasks, "safari").map((t) => t.id)).toEqual(["3"]);
  });

  it("returns nothing when there is no match", () => {
    expect(filterTasks(tasks, "zzz")).toHaveLength(0);
  });
});

describe("groupTasksByStatus", () => {
  it("returns one group per status in fixed order, even when empty", () => {
    const groups = groupTasksByStatus([task({ status: "done" })]);
    expect(groups.map((g) => g.status)).toEqual(STATUS_ORDER);
    expect(groups.find((g) => g.status === "done")!.tasks).toHaveLength(1);
    expect(groups.find((g) => g.status === "inbox")!.tasks).toHaveLength(0);
  });

  it("places each task in its own status group, sorted inside", () => {
    const groups = groupTasksByStatus([
      task({ id: "t-low", status: "todo", priority: "low" }),
      task({ id: "t-high", status: "todo", priority: "high" }),
      task({ id: "done", status: "done" }),
    ]);
    const todo = groups.find((g) => g.status === "todo")!;
    expect(todo.tasks.map((t) => t.id)).toEqual(["t-high", "t-low"]);
  });
});
