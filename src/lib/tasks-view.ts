/**
 * Pure view logic shared by the list and board layouts: filtering by search,
 * sorting within a status, and grouping by status. No React, no server
 * imports, so it is trivially testable.
 */

import type { TaskDto, TaskPriority, TaskStatus } from "@/lib/types";

/** Fixed left-to-right / top-to-bottom order for statuses. */
export const STATUS_ORDER: TaskStatus[] = [
  "inbox",
  "todo",
  "in_progress",
  "done",
];

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export interface TaskGroup {
  status: TaskStatus;
  tasks: TaskDto[];
}

/** Sorts by priority, then soonest due date (undated last), then newest. */
export function sortTasks(tasks: TaskDto[]): TaskDto[] {
  return [...tasks].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;

    const aDue = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

/** Case-insensitive match across title, TLDR, description, and notes. */
export function filterTasks(tasks: TaskDto[], query: string): TaskDto[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return tasks;
  return tasks.filter((task) =>
    [task.title, task.tldr, task.description, task.notes]
      .filter((field): field is string => Boolean(field))
      .some((field) => field.toLowerCase().includes(needle)),
  );
}

/** One group per status in STATUS_ORDER, each internally sorted. */
export function groupTasksByStatus(tasks: TaskDto[]): TaskGroup[] {
  return STATUS_ORDER.map((status) => ({
    status,
    tasks: sortTasks(tasks.filter((task) => task.status === status)),
  }));
}
