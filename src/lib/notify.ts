/**
 * Notification emails for the events that move a task along. Each function
 * resolves the recipient, builds an absolute task link, and sends. Meant to run
 * after the response via next/server's after(), so a slow mailbox never blocks
 * the request; sendEmail already swallows and logs its own failures.
 */

import { findUserById, normalizeEmail } from "@/lib/db/repo/users";
import { sendEmail } from "@/lib/email";
import {
  newCommentEmail,
  summaryReadyEmail,
  taskAcceptedEmail,
  taskDeclinedEmail,
  taskSubmittedEmail,
} from "@/lib/emails";
import { env } from "@/lib/env";
import type { UserRole } from "@/lib/types";

interface TaskRef {
  id: string;
  title: string;
  ownerId: string;
}

function taskUrl(origin: string, taskId: string): string {
  return new URL(`/tasks/${taskId}`, origin).toString();
}

function adminEmail(): string {
  return normalizeEmail(env("ADMIN_EMAIL"));
}

/** A requester submitted a task: tell the admin. */
export async function notifyTaskSubmitted(
  origin: string,
  task: Pick<TaskRef, "id" | "title">,
  submitterId: string,
): Promise<void> {
  const submitter = await findUserById(submitterId);
  const name = submitter?.name ?? submitter?.email ?? "Someone";
  const email = taskSubmittedEmail(taskUrl(origin, task.id), name, task.title);
  await sendEmail({ to: adminEmail(), ...email, kind: "task-submitted" });
}

/** A task was accepted or declined: tell its owner. */
export async function notifyReviewDecision(
  origin: string,
  task: TaskRef,
  decision: "accepted" | "declined",
  reason: string | null,
): Promise<void> {
  const owner = await findUserById(task.ownerId);
  if (!owner) return;
  const url = taskUrl(origin, task.id);
  const email =
    decision === "accepted"
      ? taskAcceptedEmail(url, task.title)
      : taskDeclinedEmail(url, task.title, reason);
  await sendEmail({ to: owner.email, ...email, kind: `task-${decision}` });
}

/** A comment was posted: tell the other party (never the commenter). */
export async function notifyNewComment(
  origin: string,
  task: TaskRef,
  commenterId: string,
  commenterRole: UserRole,
): Promise<void> {
  let recipient: string | null;
  if (commenterId === task.ownerId) {
    // The owner commented. Notify the admin, unless the owner is the admin
    // (their own task), in which case there is no counterpart.
    if (commenterRole === "admin") return;
    recipient = adminEmail();
  } else {
    // Only the admin can comment on a task they do not own; notify the owner.
    const owner = await findUserById(task.ownerId);
    recipient = owner?.email ?? null;
  }
  if (!recipient) return;

  const commenter = await findUserById(commenterId);
  const name = commenter?.name ?? commenter?.email ?? "Someone";
  const email = newCommentEmail(taskUrl(origin, task.id), name, task.title);
  await sendEmail({ to: recipient, ...email, kind: "comment" });
}

/** A summary finished: tell the owner, unless the owner is the admin. */
export async function notifySummaryReady(
  origin: string,
  task: TaskRef,
): Promise<void> {
  const owner = await findUserById(task.ownerId);
  if (!owner || owner.role !== "requester") return;
  const email = summaryReadyEmail(taskUrl(origin, task.id), task.title);
  await sendEmail({ to: owner.email, ...email, kind: "summary-ready" });
}
