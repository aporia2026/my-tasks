import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAccessibleTask } from "@/lib/db/repo/tasks";
import { listTodos, reorderTodos } from "@/lib/db/repo/todos";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { todoReorderSchema } from "@/lib/validation";

const logger = log("api todos reorder");

type Params = { params: Promise<{ id: string }> };

/** Persist a new sub-task order. The payload must be exactly this task's todos. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await getAccessibleTask(session, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = todoReorderSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // The ids must be a permutation of this task's todos: same count, all known,
  // no duplicates. Anything else is a stale or tampered payload.
  const existing = await listTodos(id);
  const existingIds = new Set(existing.map((t) => t.id));
  const ids = body.data.ids;
  const valid =
    ids.length === existing.length &&
    new Set(ids).size === ids.length &&
    ids.every((tid) => existingIds.has(tid));
  if (!valid) {
    return NextResponse.json({ error: "Invalid ordering." }, { status: 400 });
  }

  await reorderTodos(id, ids);
  const todos = await listTodos(id);
  logger.info("todos reordered", { taskId: id, count: todos.length });
  return NextResponse.json({ todos });
}
