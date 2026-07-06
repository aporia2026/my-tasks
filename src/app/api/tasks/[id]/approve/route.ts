import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";

import { approveTask } from "@/lib/db/repo/tasks";
import { log } from "@/lib/logger";
import { notifyReviewDecision } from "@/lib/notify";
import { getSession } from "@/lib/session";

const logger = log("api approve");

type Params = { params: Promise<{ id: string }> };

/** Admin accepts a pending submission so it enters the normal flow. */
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

  const task = await approveTask(id);
  if (!task) {
    return NextResponse.json(
      { error: "This task is not awaiting review." },
      { status: 409 },
    );
  }
  logger.info("task approved", { taskId: id });
  const origin = request.nextUrl.origin;
  after(() => notifyReviewDecision(origin, task, "accepted", null));
  return NextResponse.json({ task });
}
