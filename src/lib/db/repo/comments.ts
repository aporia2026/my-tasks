/**
 * Comment writes, gated by task access. A comment can only be added to a task
 * the caller owns (or any task, as admin), so the thread cannot be used to
 * reach or annotate another user's task.
 */

import { db } from "@/lib/db";
import { getAccessibleTask } from "@/lib/db/repo/tasks";
import { type Caller } from "@/lib/db/repo/access";
import { comments, type Comment, type Task } from "@/lib/db/schema";

export async function addComment(
  caller: Caller,
  taskId: string,
  body: string,
): Promise<{ comment: Comment; task: Task } | null> {
  const task = await getAccessibleTask(caller, taskId);
  if (!task) return null;
  const [comment] = await db
    .insert(comments)
    .values({ taskId, authorId: caller.sub, body })
    .returning();
  return { comment, task };
}
