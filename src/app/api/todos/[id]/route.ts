import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { type Session } from "@/lib/auth";
import { getAccessibleTask } from "@/lib/db/repo/tasks";
import { deleteTodo, getTodoTaskId, updateTodo } from "@/lib/db/repo/todos";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { todoUpdateSchema } from "@/lib/validation";

const logger = log("api todo");

type Params = { params: Promise<{ id: string }> };

/** The todo exists and its parent task belongs to (or is visible to) the admin. */
async function accessibleTodo(session: Session, todoId: string): Promise<boolean> {
  const taskId = await getTodoTaskId(todoId);
  if (!taskId) return false;
  return Boolean(await getAccessibleTask(session, taskId));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await accessibleTodo(session, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = todoUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const updated = await updateTodo(id, body.data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  logger.info("todo updated", { todoId: id, fields: Object.keys(body.data) });
  return NextResponse.json({ todo: updated });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await accessibleTodo(session, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteTodo(id);
  logger.info("todo deleted", { todoId: id });
  return NextResponse.json({ ok: true });
}
