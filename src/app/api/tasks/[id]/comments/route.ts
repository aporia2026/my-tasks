import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";

import { addComment } from "@/lib/db/repo/comments";
import { log } from "@/lib/logger";
import { notifyNewComment } from "@/lib/notify";
import { getSession } from "@/lib/session";
import { commentSchema } from "@/lib/validation";

const logger = log("api comments");

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = commentSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const result = await addComment(session, id, body.data.body);
  if (!result) {
    // Missing or not the caller's task; do not distinguish the two.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  logger.info("comment added", { taskId: id, commentId: result.comment.id });

  const origin = request.nextUrl.origin;
  after(() => notifyNewComment(origin, result.task, session.sub, session.role));
  return NextResponse.json({ comment: result.comment }, { status: 201 });
}
