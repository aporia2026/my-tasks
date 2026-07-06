/**
 * Sub-task (todo) reads and writes. Todos belong to a task and inherit its
 * ownership: every route gates on the parent task with getAccessibleTask before
 * calling in here, so these functions trust the taskId they are handed. The one
 * invariant enforced here is "at most one 'doing' todo per task".
 */

import { and, asc, eq, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { todos, type Todo } from "@/lib/db/schema";
import type { TodoStatus } from "@/lib/types";

/** One past the highest existing position, so appends never collide on gaps. */
async function nextPosition(taskId: string): Promise<number> {
  const rows = await db
    .select({ position: todos.position })
    .from(todos)
    .where(eq(todos.taskId, taskId));
  return rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.position)) + 1;
}

export async function listTodos(taskId: string): Promise<Todo[]> {
  return db
    .select()
    .from(todos)
    .where(eq(todos.taskId, taskId))
    .orderBy(asc(todos.position));
}

export async function addTodo(taskId: string, title: string): Promise<Todo> {
  const position = await nextPosition(taskId);
  const [created] = await db
    .insert(todos)
    .values({ taskId, title, position })
    .returning();
  return created;
}

/** Bulk-create in order, appended after any existing todos. */
export async function addTodos(taskId: string, titles: string[]): Promise<void> {
  if (titles.length === 0) return;
  const base = await nextPosition(taskId);
  await db
    .insert(todos)
    .values(titles.map((title, i) => ({ taskId, title, position: base + i })));
}

/**
 * Regenerate the AI checklist: drop everything not yet done and append the fresh
 * suggestions, so completed work is never lost.
 */
export async function regenerateTodos(
  taskId: string,
  titles: string[],
): Promise<void> {
  await db
    .delete(todos)
    .where(and(eq(todos.taskId, taskId), ne(todos.status, "done")));
  await addTodos(taskId, titles);
}

export async function updateTodo(
  id: string,
  patch: { title?: string; status?: TodoStatus },
): Promise<Todo | null> {
  // Marking a todo "doing" demotes whichever sibling was current.
  if (patch.status === "doing") {
    const [row] = await db
      .select({ taskId: todos.taskId })
      .from(todos)
      .where(eq(todos.id, id))
      .limit(1);
    if (row) {
      await db
        .update(todos)
        .set({ status: "pending", updatedAt: new Date() })
        .where(
          and(
            eq(todos.taskId, row.taskId),
            eq(todos.status, "doing"),
            ne(todos.id, id),
          ),
        );
    }
  }
  const [updated] = await db
    .update(todos)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(todos.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteTodo(id: string): Promise<boolean> {
  const deleted = await db.delete(todos).where(eq(todos.id, id)).returning();
  return deleted.length > 0;
}

/**
 * Persist a new order. `ids` is the full ordered id list for the task; each row
 * is set to its index. The taskId guard means a stray id can never touch another
 * task's rows.
 */
export async function reorderTodos(
  taskId: string,
  ids: string[],
): Promise<void> {
  await Promise.all(
    ids.map((id, index) =>
      db
        .update(todos)
        .set({ position: index, updatedAt: new Date() })
        .where(and(eq(todos.id, id), eq(todos.taskId, taskId))),
    ),
  );
}

/** Resolve a todo's parent task id, for the ownership gate on /api/todos/[id]. */
export async function getTodoTaskId(id: string): Promise<string | null> {
  const [row] = await db
    .select({ taskId: todos.taskId })
    .from(todos)
    .where(eq(todos.id, id))
    .limit(1);
  return row?.taskId ?? null;
}
