import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getAccessibleTask } from "@/lib/db/repo/tasks";
import { tasks } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { cleanAttachmentMedia } from "@/lib/pipeline/cleanup";
import { isMediaDeletable } from "@/lib/pipeline/retention";
import { canTransitionAiStatus } from "@/lib/pipeline/state";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings-store";

const logger = log("api confirm");

type Params = { params: Promise<{ id: string }> };

/**
 * User confirms the AI summary. Only then does media become eligible for
 * cleanup under the retention policy; transcripts are always kept.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await getAccessibleTask(session, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { attachments: { with: { segments: true } } },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canTransitionAiStatus(task.aiStatus, "confirmed")) {
    return NextResponse.json(
      { error: `Cannot confirm a task whose summary is ${task.aiStatus}.` },
      { status: 409 },
    );
  }

  await db
    .update(tasks)
    .set({ aiStatus: "confirmed", updatedAt: new Date() })
    .where(eq(tasks.id, id));

  const settings = await getSettings();
  let cleaned = 0;
  for (const attachment of task.attachments) {
    const isMedia = attachment.kind === "audio" || attachment.kind === "video";
    if (!isMedia) continue;
    const deletable = isMediaDeletable({
      policy: settings.mediaRetention,
      taskConfirmed: true,
      attachmentStatus: attachment.status,
      createdAt: attachment.createdAt,
    });
    if (deletable) {
      await cleanAttachmentMedia(attachment);
      cleaned++;
    }
  }

  logger.info("task confirmed", {
    taskId: id,
    mediaCleaned: cleaned,
    retention: settings.mediaRetention,
  });
  return NextResponse.json({ ok: true, mediaCleaned: cleaned });
}
