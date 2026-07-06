/**
 * The review gate that sits in front of the existing AI pipeline. A requester's
 * submitted task waits in "pending" until the admin accepts or declines it; the
 * admin's own tasks are "none" and skip the queue entirely. Pure logic, no DB
 * or React, so it is shared by the server, the client labels, and the tests.
 */

import type { AiStatus, ReviewState, TaskStatus } from "@/lib/types";

/** AI may run only once a task is out of review: the admin's own, or approved. */
export function canProcess(reviewState: ReviewState): boolean {
  return reviewState === "none" || reviewState === "accepted";
}

/** Admin review moves: only a pending task can be accepted or declined. */
export function canReviewTransition(
  from: ReviewState,
  to: "accepted" | "declined",
): boolean {
  return from === "pending" && (to === "accepted" || to === "declined");
}

/**
 * The single, plainly worded status a requester sees. It folds the review
 * state, the work status, and the AI status into one label so the requester
 * never has to reason about the pipeline.
 */
export function requesterStatusLabel(task: {
  reviewState: ReviewState;
  status: TaskStatus;
  aiStatus: AiStatus;
}): string {
  if (task.reviewState === "pending") return "Under review";
  if (task.reviewState === "declined") return "Declined";
  if (task.aiStatus === "processing") return "Working on it";
  if (task.status === "done") return "Done";
  if (task.status === "in_progress") return "In progress";
  return "Accepted";
}
