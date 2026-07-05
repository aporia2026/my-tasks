import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { attachments, segments } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { deleteTaskMedia } from "@/lib/pipeline/cleanup";

const logger = log("api attachment");

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, id),
    with: { segments: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteTaskMedia([attachment]);
  await db.delete(attachments).where(eq(attachments.id, id));
  logger.info("attachment deleted", { attachmentId: id });
  return NextResponse.json({ ok: true });
}

/** Resets retry budget on failed segments so processing can run again. */
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, id),
    with: { segments: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (attachment.status === "cleaned") {
    return NextResponse.json(
      { error: "Source media was already cleaned up; re-upload the file to retry." },
      { status: 409 },
    );
  }

  const failed = attachment.segments.filter((s) => s.status === "failed");
  for (const segment of failed) {
    await db
      .update(segments)
      .set({ status: "pending", attempts: 0, error: null })
      .where(eq(segments.id, segment.id));
  }
  await db
    .update(attachments)
    .set({ status: "uploaded", error: null })
    .where(eq(attachments.id, id));

  logger.info("attachment retry queued", {
    attachmentId: id,
    resetSegments: failed.length,
  });
  return NextResponse.json({ ok: true, resetSegments: failed.length });
}
