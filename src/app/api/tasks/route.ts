import { NextRequest, NextResponse, after } from "next/server";

import { createTaskForCaller, listTasksForCaller } from "@/lib/db/repo/tasks";
import { log } from "@/lib/logger";
import { notifyTaskSubmitted } from "@/lib/notify";
import { sweepExpiredMedia } from "@/lib/pipeline/cleanup";
import { getSession } from "@/lib/session";
import { taskCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const logger = log("api tasks");

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Opportunistic media cleanup is a system/admin concern, not something a
  // requester's dashboard load should trigger.
  if (session.role === "admin") await sweepExpiredMedia();
  const rows = await listTasksForCaller(session);
  logger.info("listed tasks", { count: rows.length, role: session.role });
  return NextResponse.json({ tasks: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = taskCreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    logger.warn("create rejected", { issues: body.error.issues.length });
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const created = await createTaskForCaller(session, {
    title: body.data.title,
    notes: body.data.notes,
    priority: body.data.priority,
    status: body.data.status,
    description: body.data.description,
    tldr: body.data.tldr,
    dueDate: body.data.dueDate ? new Date(body.data.dueDate) : null,
    todos: body.data.todos,
  });

  logger.info("task created", { taskId: created.id, ownerId: created.ownerId });

  // A requester's submission goes to the admin's review queue; let them know.
  if (session.role === "requester") {
    const origin = request.nextUrl.origin;
    after(() => notifyTaskSubmitted(origin, created, session.sub));
  }
  return NextResponse.json({ task: created }, { status: 201 });
}
