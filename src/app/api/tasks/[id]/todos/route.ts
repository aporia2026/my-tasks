import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAccessibleTask } from "@/lib/db/repo/tasks";
import { addTodo } from "@/lib/db/repo/todos";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { todoCreateSchema } from "@/lib/validation";

const logger = log("api todos");

type Params = { params: Promise<{ id: string }> };

/** Add one sub-task to a task. Admin only; requesters read todos but never write. */
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
  // Ownership gate: 404 (not 403) so ids cannot be probed.
  if (!(await getAccessibleTask(session, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = todoCreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const todo = await addTodo(id, body.data.title);
  logger.info("todo added", { taskId: id, todoId: todo.id });
  return NextResponse.json({ todo }, { status: 201 });
}
