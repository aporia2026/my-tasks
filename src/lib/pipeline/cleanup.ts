/**
 * Blob cleanup. Deletes stored media while keeping DB rows (and transcripts)
 * intact. Rows are updated first only after the delete succeeds, so a failed
 * delete never strands an untracked blob.
 */

import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import type { Attachment, Segment } from "@/lib/db/schema";
import { attachments, segments } from "@/lib/db/schema";
import { log } from "@/lib/logger";

const logger = log("api cleanup");

type AttachmentWithSegments = Attachment & { segments: Segment[] };

function mediaUrls(attachment: AttachmentWithSegments): string[] {
  const urls = attachment.segments.map((s) => s.blobUrl);
  if (attachment.blobUrl) urls.push(attachment.blobUrl);
  return urls.filter((u) => u.length > 0);
}

/** Deletes an attachment's media blobs and marks it cleaned. */
export async function cleanAttachmentMedia(
  attachment: AttachmentWithSegments,
): Promise<void> {
  const urls = mediaUrls(attachment);
  logger.info("cleaning attachment media", {
    attachmentId: attachment.id,
    blobCount: urls.length,
  });
  if (urls.length > 0) await del(urls);

  await db
    .update(attachments)
    .set({ status: "cleaned", blobUrl: null, cleanedAt: new Date() })
    .where(eq(attachments.id, attachment.id));
  await db
    .update(segments)
    .set({ blobUrl: "", blobPathname: "" })
    .where(eq(segments.attachmentId, attachment.id));
  logger.info("attachment media cleaned", { attachmentId: attachment.id });
}

/** Deletes all media for a task (used when the task itself is deleted). */
export async function deleteTaskMedia(
  taskAttachments: AttachmentWithSegments[],
): Promise<void> {
  const urls = taskAttachments.flatMap(mediaUrls);
  logger.info("deleting task media", { blobCount: urls.length });
  if (urls.length > 0) await del(urls);
}

/**
 * Lazy sweep for the "keep 30 days" retention policy: runs opportunistically
 * on dashboard loads instead of a cron, which is enough for one user.
 * Never throws; a failed sweep must not break the page that triggered it.
 */
export async function sweepExpiredMedia(): Promise<number> {
  const { isMediaDeletable } = await import("@/lib/pipeline/retention");
  const { getSettings } = await import("@/lib/settings-store");
  try {
    const settings = await getSettings();
    if (settings.mediaRetention !== "days_30") return 0;

    const candidates = await db.query.attachments.findMany({
      where: eq(attachments.status, "transcribed"),
      with: { segments: true, task: true },
    });
    let cleaned = 0;
    for (const attachment of candidates) {
      const isMedia = attachment.kind === "audio" || attachment.kind === "video";
      const deletable =
        isMedia &&
        isMediaDeletable({
          policy: settings.mediaRetention,
          taskConfirmed: attachment.task.aiStatus === "confirmed",
          attachmentStatus: attachment.status,
          createdAt: attachment.createdAt,
        });
      if (deletable) {
        await cleanAttachmentMedia(attachment);
        cleaned++;
      }
    }
    if (cleaned > 0) logger.info("retention sweep finished", { cleaned });
    return cleaned;
  } catch (error) {
    logger.warn("retention sweep failed", { message: (error as Error).message });
    return 0;
  }
}
