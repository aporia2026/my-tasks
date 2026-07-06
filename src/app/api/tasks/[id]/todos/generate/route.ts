import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateTodos } from "@/lib/ai";
import { getAccessibleTask } from "@/lib/db/repo/tasks";
import { listTodos, regenerateTodos } from "@/lib/db/repo/todos";
import { log } from "@/lib/logger";
import { canProcess } from "@/lib/review";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings-store";

const logger = log("api todos generate");

type Params = { params: Promise<{ id: string }> };

/**
 * Regenerate the checklist from the task's current text. Admin only, and gated
 * by canProcess so a requester upload can never spend the OpenAI budget. Keeps
 * already-done items; replaces the rest with fresh suggestions.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const task = await getAccessibleTask(session, id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canProcess(task.reviewState)) {
    return NextResponse.json(
      { error: "This task is still awaiting review." },
      { status: 409 },
    );
  }

  try {
    const settings = await getSettings();
    const titles = await generateTodos(
      {
        title: task.title,
        notes: task.notes,
        description: task.description,
        tldr: task.tldr,
      },
      settings,
    );
    if (titles.length === 0) {
      return NextResponse.json(
        { error: "The AI couldn't suggest sub-tasks from this task yet." },
        { status: 502 },
      );
    }
    await regenerateTodos(id, titles);
    const todos = await listTodos(id);
    logger.info("todos regenerated", { taskId: id, count: titles.length });
    return NextResponse.json({ todos });
  } catch (error) {
    logger.error("todos generate failed", {
      taskId: id,
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Could not generate sub-tasks. Try again." },
      { status: 502 },
    );
  }
}
