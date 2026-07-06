import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";

import { declineTask } from "@/lib/db/repo/tasks";
import { log } from "@/lib/logger";
import { notifyReviewDecision } from "@/lib/notify";
import { getSession } from "@/lib/session";
import { declineSchema } from "@/lib/validation";

const logger = log("api decline");

type Params = { params: Promise<{ id: string }> };

/** Admin declines a pending submission with an optional reason. */
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

  const body = declineSchema.safeParse(await request.json().catch(() => ({})));
  const reason = body.success ? (body.data.reason ?? null) : null;

  const task = await declineTask(id, reason);
  if (!task) {
    return NextResponse.json(
      { error: "This task is not awaiting review." },
      { status: 409 },
    );
  }
  logger.info("task declined", { taskId: id });
  const origin = request.nextUrl.origin;
  after(() => notifyReviewDecision(origin, task, "declined", reason));
  return NextResponse.json({ task });
}
