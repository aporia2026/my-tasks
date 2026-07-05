"use client";

import { log } from "@/lib/logger";
import type { AttachmentDto } from "@/lib/types";

const logger = log("ui attachments");

const KIND_ICONS: Record<AttachmentDto["kind"], string> = {
  audio: "Audio",
  video: "Video",
  image: "Image",
  document: "Document",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function progressText(attachment: AttachmentDto): string | null {
  const segments = attachment.segments ?? [];
  if (segments.length === 0) return null;
  const done = segments.filter((s) => s.status === "done").length;
  if (attachment.status === "transcribing" || done < segments.length) {
    return `Transcribing part ${Math.min(done + 1, segments.length)} of ${segments.length}`;
  }
  return null;
}

export function AttachmentList({
  attachments,
  onChanged,
}: {
  attachments: AttachmentDto[];
  onChanged: () => void;
}) {
  async function retry(id: string) {
    logger.info("retrying attachment", { attachmentId: id });
    await fetch(`/api/attachments/${id}`, { method: "POST" });
    onChanged();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove "${name}" and its transcript from this task?`)) {
      return;
    }
    logger.info("deleting attachment", { attachmentId: id });
    await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    onChanged();
  }

  if (attachments.length === 0) return null;

  return (
    <ul className="space-y-2">
      {attachments.map((attachment) => {
        const progress = progressText(attachment);
        return (
          <li
            key={attachment.id}
            className="rounded-xl border border-line bg-surface px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {attachment.originalName}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {KIND_ICONS[attachment.kind]} · {formatBytes(attachment.sizeBytes)}
                  {attachment.status === "cleaned" &&
                    " · source media cleaned, transcript kept"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                {progress && <span className="text-amber-700">{progress}</span>}
                {attachment.status === "transcribed" && (
                  <span className="text-accent">Transcribed</span>
                )}
                {attachment.status === "failed" && (
                  <button
                    onClick={() => retry(attachment.id)}
                    className="rounded-lg border border-line px-2.5 py-1 font-medium hover:border-accent"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => remove(attachment.id, attachment.originalName)}
                  className="rounded-lg px-2 py-1 text-muted hover:text-red-600"
                  aria-label={`Remove ${attachment.originalName}`}
                >
                  Remove
                </button>
              </div>
            </div>
            {attachment.status === "failed" && attachment.error && (
              <p className="mt-2 text-xs text-red-600">{attachment.error}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
