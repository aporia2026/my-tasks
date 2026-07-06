import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getAccessibleTask, getAccessibleTaskDetail } from "@/lib/db/repo/tasks";
import { attachments, tasks } from "@/lib/db/schema";
import { deleteTaskMedia } from "@/lib/pipeline/cleanup";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { taskUpdateSchema } from "@/lib/validation";

const logger = log("api task");

type Params = { params: Promise<{ id: string }> };

async function taskId(params: Params["params"]): Promise<string | null> {
  const { id } = await params;
  return z.uuid().safeParse(id).success ? id : null;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await taskId(params);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = await getAccessibleTaskDetail(session, id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await taskId(params);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership gate: 404 (not 403) so ids cannot be probed.
  if (!(await getAccessibleTask(session, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = taskUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(tasks)
    .set({
      ...body.data,
      dueDate:
        body.data.dueDate === undefined
          ? undefined
          : body.data.dueDate === null
            ? null
            : new Date(body.data.dueDate),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  logger.info("task updated", { taskId: id, fields: Object.keys(body.data) });
  return NextResponse.json({ task: updated });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await taskId(params);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await getAccessibleTask(session, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const taskAttachments = await db.query.attachments.findMany({
    where: eq(attachments.taskId, id),
    with: { segments: true },
  });
  await deleteTaskMedia(taskAttachments);

  const deleted = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  logger.info("task deleted", { taskId: id, attachments: taskAttachments.length });
  return NextResponse.json({ ok: true });
}
