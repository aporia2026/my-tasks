/**
 * The only place task rows are read or written on behalf of a user. Every
 * function takes the caller and scopes to what they may see: a requester is
 * confined to their own tasks, the admin sees everything. By-id routes call a
 * getAccessible* gate before doing anything, and it returns null for both
 * "missing" and "not yours" so a requester cannot probe which ids exist.
 */

import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { ownsOrAdmin, type Caller } from "@/lib/db/repo/access";
import { comments, tasks, type Task } from "@/lib/db/schema";
import { canReviewTransition } from "@/lib/review";
import type { TaskPriority } from "@/lib/types";

// Owner fields safe to send to the client. Never selects password_hash.
const ownerColumns = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export async function listTasksForCaller(caller: Caller) {
  return db.query.tasks.findMany({
    where: caller.role === "admin" ? undefined : eq(tasks.ownerId, caller.sub),
    orderBy: [desc(tasks.createdAt)],
    with: { attachments: true, owner: { columns: ownerColumns } },
  });
}

export async function createTaskForCaller(
  caller: Caller,
  values: {
    title: string;
    notes?: string;
    priority?: TaskPriority;
    dueDate: Date | null;
  },
): Promise<Task> {
  // A requester's task enters the review queue; the admin's own skips it.
  const reviewState = caller.role === "admin" ? "none" : "pending";
  const [created] = await db
    .insert(tasks)
    .values({
      ownerId: caller.sub,
      title: values.title,
      notes: values.notes,
      priority: values.priority ?? "medium",
      reviewState,
      dueDate: values.dueDate,
    })
    .returning();
  return created;
}

/** Ownership gate returning the bare task row, or null if inaccessible. */
export async function getAccessibleTask(
  caller: Caller,
  id: string,
): Promise<Task | null> {
  const where =
    caller.role === "admin"
      ? eq(tasks.id, id)
      : and(eq(tasks.id, id), eq(tasks.ownerId, caller.sub));
  const [row] = await db.select().from(tasks).where(where).limit(1);
  return row ?? null;
}

/** Ownership gate returning the task with its owner, attachments, segments. */
export async function getAccessibleTaskDetail(caller: Caller, id: string) {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      owner: { columns: ownerColumns },
      attachments: { with: { segments: true } },
      comments: {
        orderBy: [asc(comments.createdAt)],
        with: { author: { columns: ownerColumns } },
      },
    },
  });
  if (!task || !ownsOrAdmin(caller, task.ownerId)) return null;
  return task;
}

/** Admin review: accept a pending task so it enters the normal flow. */
export async function approveTask(id: string): Promise<Task | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row || !canReviewTransition(row.reviewState, "accepted")) return null;
  const [updated] = await db
    .update(tasks)
    .set({ reviewState: "accepted", updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return updated ?? null;
}

/** Admin review: decline a pending task with an optional reason. */
export async function declineTask(
  id: string,
  reason: string | null,
): Promise<Task | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row || !canReviewTransition(row.reviewState, "declined")) return null;
  const [updated] = await db
    .update(tasks)
    .set({ reviewState: "declined", declineReason: reason, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return updated ?? null;
}
