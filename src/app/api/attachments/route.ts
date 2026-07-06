import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAccessibleTask } from "@/lib/db/repo/tasks";
import { attachments, segments } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { attachmentRegisterSchema } from "@/lib/validation";

const logger = log("api attachments");

/**
 * Registers uploaded blobs as an attachment (plus its audio segments) after
 * the client has finished uploading them to Vercel Blob.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = attachmentRegisterSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    logger.warn("register rejected", { issues: body.error.issues.length });
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const data = body.data;

  if (!data.blob && (!data.segments || data.segments.length === 0)) {
    return NextResponse.json(
      { error: "Either a blob or audio segments are required." },
      { status: 400 },
    );
  }

  // Ownership gate: you can only attach to a task you own (or any, as admin).
  if (!(await getAccessibleTask(session, data.taskId))) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const [attachment] = await db
    .insert(attachments)
    .values({
      taskId: data.taskId,
      kind: data.kind,
      originalName: data.originalName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      durationSeconds: data.durationSeconds,
      blobUrl: data.blob?.url,
      blobPathname: data.blob?.pathname,
      status: "uploaded",
    })
    .returning();

  if (data.segments && data.segments.length > 0) {
    await db.insert(segments).values(
      data.segments.map((s) => ({
        attachmentId: attachment.id,
        idx: s.idx,
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
        blobUrl: s.url,
        blobPathname: s.pathname,
      })),
    );
  }

  logger.info("attachment registered", {
    attachmentId: attachment.id,
    taskId: data.taskId,
    kind: data.kind,
    segmentCount: data.segments?.length ?? 0,
  });
  return NextResponse.json({ attachment }, { status: 201 });
}
