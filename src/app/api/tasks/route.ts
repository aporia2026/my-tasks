import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { sweepExpiredMedia } from "@/lib/pipeline/cleanup";
import { taskCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const logger = log("api tasks");

export async function GET() {
  await sweepExpiredMedia();
  const rows = await db.query.tasks.findMany({
    orderBy: [desc(tasks.createdAt)],
    with: { attachments: true },
  });
  logger.info("listed tasks", { count: rows.length });
  return NextResponse.json({ tasks: rows });
}

export async function POST(request: NextRequest) {
  const body = taskCreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    logger.warn("create rejected", { issues: body.error.issues.length });
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(tasks)
    .values({
      title: body.data.title,
      notes: body.data.notes,
      priority: body.data.priority ?? "medium",
      dueDate: body.data.dueDate ? new Date(body.data.dueDate) : null,
    })
    .returning();

  logger.info("task created", { taskId: created.id, title: created.title });
  return NextResponse.json({ task: created }, { status: 201 });
}
