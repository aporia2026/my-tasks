/**
 * Attachment access, gated by the owning task. An attachment is reachable only
 * if the caller owns its task (or is admin), so attachment routes cannot be
 * used to reach another user's files.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { ownsOrAdmin, type Caller } from "@/lib/db/repo/access";
import { attachments } from "@/lib/db/schema";

export async function getAccessibleAttachment(caller: Caller, id: string) {
  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, id),
    with: { segments: true, task: true },
  });
  if (!attachment) return null;
  if (!ownsOrAdmin(caller, attachment.task.ownerId)) return null;
  return attachment;
}
