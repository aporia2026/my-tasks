import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";

import {
  generateSummary,
  transcribeSegment,
  type SummaryInput,
} from "@/lib/ai";
import { db } from "@/lib/db";
import { getAccessibleTask } from "@/lib/db/repo/tasks";
import { attachments, segments, tasks } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { notifySummaryReady } from "@/lib/notify";
import { canProcess } from "@/lib/review";
import { stitchTranscripts } from "@/lib/pipeline/segments";
import {
  allSegmentsDone,
  hasExhaustedSegments,
  pendingSegments,
} from "@/lib/pipeline/state";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings-store";

export const maxDuration = 300;

/** Stop picking up new segments after this long; the client re-invokes. */
const TIME_BUDGET_MS = 220_000;

const logger = log("api process");

type Params = { params: Promise<{ id: string }> };

/**
 * Advances a task's AI pipeline as far as the time budget allows.
 *
 * All progress is persisted per segment, so this route is safe to call
 * repeatedly: finished segments are skipped, orphaned ones are picked up,
 * and a crash loses at most one segment of work. The client polls and
 * re-invokes until `continueProcessing` comes back false.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const origin = request.nextUrl.origin;

  const gated = await getAccessibleTask(session, id);
  if (!gated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Cost gate: the AI pipeline only runs on the admin's own tasks or ones the
  // admin has approved, so a requester upload can never spend the OpenAI budget.
  if (!canProcess(gated.reviewState)) {
    return NextResponse.json(
      { error: "This task is still awaiting review." },
      { status: 409 },
    );
  }

  const started = Date.now();
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      attachments: { with: { segments: { orderBy: [asc(segments.idx)] } } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await getSettings();
  await db
    .update(tasks)
    .set({ aiStatus: "processing", aiError: null, updatedAt: new Date() })
    .where(eq(tasks.id, id));
  logger.info("processing started", {
    taskId: id,
    attachments: task.attachments.length,
  });

  // Phase 1: transcribe pending segments, oldest attachment first.
  for (const attachment of task.attachments) {
    if (attachment.segments.length === 0) continue;

    const queue = pendingSegments(attachment.segments);
    if (queue.length > 0 && attachment.status === "uploaded") {
      await db
        .update(attachments)
        .set({ status: "transcribing" })
        .where(eq(attachments.id, attachment.id));
    }

    for (const segment of queue) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        logger.info("time budget reached, yielding", { taskId: id });
        return NextResponse.json({ continueProcessing: true });
      }
      await db
        .update(segments)
        .set({ status: "transcribing", attempts: segment.attempts + 1 })
        .where(eq(segments.id, segment.id));
      try {
        const text = await transcribeSegment(
          segment.blobUrl,
          `${attachment.originalName}.part${segment.idx + 1}.mp3`,
          settings.transcriptionModel,
        );
        await db
          .update(segments)
          .set({ status: "done", transcript: text, error: null })
          .where(eq(segments.id, segment.id));
      } catch (error) {
        const message = (error as Error).message;
        logger.error("segment failed", {
          taskId: id,
          segmentIdx: segment.idx,
          attempt: segment.attempts + 1,
          message,
        });
        await db
          .update(segments)
          .set({ status: "failed", error: message })
          .where(eq(segments.id, segment.id));
      }
    }

    // Settle the attachment now that its queue drained.
    const currentSegments = await db.query.segments.findMany({
      where: eq(segments.attachmentId, attachment.id),
      orderBy: [asc(segments.idx)],
    });
    if (allSegmentsDone(currentSegments)) {
      await db
        .update(attachments)
        .set({
          status: "transcribed",
          transcript: stitchTranscripts(currentSegments),
          error: null,
        })
        .where(eq(attachments.id, attachment.id));
      logger.info("attachment transcribed", { attachmentId: attachment.id });
    } else if (hasExhaustedSegments(currentSegments)) {
      const failed = currentSegments.filter((s) => s.status === "failed");
      await db
        .update(attachments)
        .set({
          status: "failed",
          transcript: stitchTranscripts(currentSegments),
          error: `${failed.length} segment(s) failed after retries`,
        })
        .where(eq(attachments.id, attachment.id));
    }
  }

  // Phase 2: summarize once every transcribable attachment is settled.
  const fresh = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { attachments: true },
  });
  if (!fresh) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stillWorking = fresh.attachments.some(
    (a) => a.status === "transcribing",
  );
  if (stillWorking) {
    return NextResponse.json({ continueProcessing: true });
  }

  const failedAttachments = fresh.attachments.filter((a) => a.status === "failed");
  const input: SummaryInput = {
    title: fresh.title,
    notes: fresh.notes,
    transcripts: fresh.attachments
      .filter((a) => a.transcript)
      .map((a) => ({ name: a.originalName, text: a.transcript as string })),
    imageUrls: fresh.attachments
      .filter((a) => a.kind === "image" && a.blobUrl)
      .map((a) => ({ name: a.originalName, url: a.blobUrl as string })),
    documents: fresh.attachments
      .filter((a) => a.kind === "document" && a.blobUrl)
      .map((a) => ({
        name: a.originalName,
        url: a.blobUrl as string,
        mimeType: a.mimeType,
      })),
  };

  const hasMaterial =
    input.transcripts.length > 0 ||
    input.imageUrls.length > 0 ||
    input.documents.length > 0 ||
    Boolean(fresh.notes);

  if (!hasMaterial) {
    await db
      .update(tasks)
      .set({
        aiStatus: "failed",
        aiError: "Nothing readable was attached to this task yet.",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id));
    return NextResponse.json({ continueProcessing: false });
  }

  try {
    const summary = await generateSummary(input, settings);
    await db
      .update(tasks)
      .set({
        description: summary.description,
        tldr: summary.tldr,
        aiStatus: "ready",
        aiError:
          failedAttachments.length > 0
            ? `Summary generated, but ${failedAttachments.length} attachment(s) could not be fully transcribed.`
            : null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id));
    logger.info("summary saved", { taskId: id });
    after(() => notifySummaryReady(origin, fresh));
  } catch (error) {
    const message = (error as Error).message;
    logger.error("summary failed", { taskId: id, message });
    await db
      .update(tasks)
      .set({ aiStatus: "failed", aiError: message, updatedAt: new Date() })
      .where(eq(tasks.id, id));
  }

  return NextResponse.json({ continueProcessing: false });
}
