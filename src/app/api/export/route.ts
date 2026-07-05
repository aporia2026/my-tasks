import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

const logger = log("api export");

/**
 * One-click backup of the entire corpus: tasks, summaries, and transcripts.
 * The transcript archive is the long-term asset, so it must always have an
 * exit path from the database.
 */
export async function GET() {
  const rows = await db.query.tasks.findMany({
    orderBy: [desc(tasks.createdAt)],
    with: { attachments: true },
  });

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

  logger.info("export generated", { taskCount: rows.length });
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="my-tasks-export-${
        new Date().toISOString().slice(0, 10)
      }.json"`,
    },
  });
}
