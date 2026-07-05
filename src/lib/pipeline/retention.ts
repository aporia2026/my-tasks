/**
 * Media retention policy: which uploaded audio blobs may be deleted.
 *
 * Transcripts are permanent; source media is transit. Audio is never deleted
 * before the user confirms the AI summary, so a garbled transcript can
 * always be re-run from the source.
 */

export type RetentionPolicy = "after_confirm" | "days_30" | "forever";

export const RETENTION_DAYS = 30;

export interface RetentionInput {
  policy: RetentionPolicy;
  taskConfirmed: boolean;
  attachmentStatus: "uploaded" | "transcribing" | "transcribed" | "failed" | "cleaned";
  createdAt: Date;
  now?: Date;
}

export function isMediaDeletable(input: RetentionInput): boolean {
  const { policy, taskConfirmed, attachmentStatus, createdAt } = input;
  const now = input.now ?? new Date();

  if (attachmentStatus === "cleaned") return false; // nothing left to delete
  if (attachmentStatus !== "transcribed") return false; // source still needed
  if (!taskConfirmed) return false; // never before human confirmation

  switch (policy) {
    case "after_confirm":
      return true;
    case "days_30":
      return (
        now.getTime() - createdAt.getTime() >=
        RETENTION_DAYS * 24 * 60 * 60 * 1000
      );
    case "forever":
      return false;
  }
}
