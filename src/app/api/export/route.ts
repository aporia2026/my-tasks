import { NextResponse } from "next/server";

import { listTasksForCaller } from "@/lib/db/repo/tasks";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const logger = log("api export");

/**
 * One-click backup of the corpus: tasks, summaries, and transcripts. Scoped to
 * the caller (a requester exports only their own; the admin exports all). The
 * transcript archive is the long-term asset, so it must always have an exit
 * path from the database.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await listTasksForCaller(session);

  const payload = {
    exportedAt: new Date().toISOString(),
    taskCount: rows.length,
    tasks: rows.map((task) => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      notes: task.notes,
      description: task.description,
      tldr: task.tldr,
      createdAt: task.createdAt,
      attachments: task.attachments.map((a) => ({
        name: a.originalName,
        kind: a.kind,
        transcript: a.transcript,
      })),
    })),
  };

  logger.info("export generated", {
    taskCount: rows.length,
    role: session.role,
  });
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="my-tasks-export-${
        new Date().toISOString().slice(0, 10)
      }.json"`,
    },
  });
}
