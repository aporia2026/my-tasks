"use client";

/**
 * Upload orchestrator: classifies a dropped file, runs audio extraction for
 * recordings, streams blobs to Vercel Blob, registers the attachment, and
 * reports human-readable progress the whole way.
 */

import { upload } from "@vercel/blob/client";

import { log } from "@/lib/logger";
import {
  extractAudioSegments,
  readMediaDuration,
  type ExtractedSegment,
} from "@/lib/client/extract-audio";

const logger = log("upload flow");

/** Direct-to-transcription fallback cap, safely under OpenAI's 25MB limit. */
const DIRECT_AUDIO_MAX_BYTES = 24 * 1024 * 1024;

/** Containers OpenAI transcription accepts without re-encoding. */
const DIRECT_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
]);

export type AttachmentKind = "audio" | "video" | "image" | "document";

export type UploadStage =
  | { stage: "preparing" }
  | { stage: "loading-ffmpeg" }
  | { stage: "extracting"; percent: number }
  | { stage: "uploading"; current: number; total: number }
  | { stage: "registering" };

export function classifyFile(mimeType: string, name: string): AttachmentKind {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    /\.(pdf|txt|md)$/i.test(name)
  ) {
    return "document";
  }
  return "document";
}

async function uploadBlob(pathname: string, data: Blob | File) {
  return upload(pathname, data, {
    access: "public",
    handleUploadUrl: "/api/upload",
    multipart: data.size > 8 * 1024 * 1024,
  });
}

interface RegisterPayload {
  taskId: string;
  kind: AttachmentKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  blob?: { url: string; pathname: string };
  segments?: Array<{
    idx: number;
    startSeconds: number;
    endSeconds: number;
    url: string;
    pathname: string;
  }>;
}

async function registerAttachment(payload: RegisterPayload) {
  const response = await fetch("/api/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Registering the upload failed.");
  }
}

async function uploadSegments(
  taskId: string,
  file: File,
  kind: AttachmentKind,
  segments: ExtractedSegment[],
  durationSeconds: number,
  onProgress: (stage: UploadStage) => void,
) {
  const uploaded: RegisterPayload["segments"] = [];
  for (const segment of segments) {
    onProgress({
      stage: "uploading",
      current: segment.idx + 1,
      total: segments.length,
    });
    const result = await uploadBlob(
      `tasks/${taskId}/audio/${segment.idx}.mp3`,
      segment.blob,
    );
    uploaded.push({
      idx: segment.idx,
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      url: result.url,
      pathname: result.pathname,
    });
  }

  onProgress({ stage: "registering" });
  await registerAttachment({
    taskId,
    kind,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    durationSeconds,
    segments: uploaded,
  });
}

/**
 * Full pipeline for one dropped file. Throws with a plain-language message
 * when something cannot be handled; the caller shows it as-is.
 */
export async function processFileUpload(
  taskId: string,
  file: File,
  onProgress: (stage: UploadStage) => void,
): Promise<AttachmentKind> {
  const kind = classifyFile(file.type, file.name);
  logger.info("upload started", {
    taskId,
    name: file.name,
    kind,
    sizeBytes: file.size,
  });
  onProgress({ stage: "preparing" });

  if (kind === "image" || kind === "document") {
    onProgress({ stage: "uploading", current: 1, total: 1 });
    const result = await uploadBlob(`tasks/${taskId}/${kind}/${file.name}`, file);
    onProgress({ stage: "registering" });
    await registerAttachment({
      taskId,
      kind,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      blob: { url: result.url, pathname: result.pathname },
    });
    logger.info("upload finished", { taskId, name: file.name, kind });
    return kind;
  }

  // Recording: extract in the browser, fall back to direct upload when the
  // file already fits transcription limits, otherwise fail honestly.
  try {
    const { segments, durationSeconds } = await extractAudioSegments(
      file,
      onProgress,
    );
    await uploadSegments(taskId, file, kind, segments, durationSeconds, onProgress);
    logger.info("upload finished", {
      taskId,
      name: file.name,
      kind,
      segments: segments.length,
    });
    return kind;
  } catch (error) {
    logger.warn("extraction failed, checking direct-upload fallback", {
      name: file.name,
      message: (error as Error).message,
    });
    const directEligible =
      file.size <= DIRECT_AUDIO_MAX_BYTES && DIRECT_AUDIO_TYPES.has(file.type);
    if (!directEligible) {
      throw new Error(
        "Audio extraction failed on this device and the file is too large to " +
          "send directly. Try a smaller file, or an mp3/m4a/wav under 24MB.",
      );
    }
    const durationSeconds = await readMediaDuration(file).catch(() => undefined);
    await uploadSegments(
      taskId,
      file,
      kind,
      [
        {
          idx: 0,
          blob: file,
          startSeconds: 0,
          endSeconds: durationSeconds ?? 0,
        },
      ],
      durationSeconds ?? 0,
      onProgress,
    );
    logger.info("direct upload fallback used", { taskId, name: file.name });
    return kind;
  }
}

/** Drives the server pipeline until it reports completion. */
export async function runProcessing(taskId: string): Promise<void> {
  logger.info("processing loop started", { taskId });
  for (let i = 0; i < 50; i++) {
    const response = await fetch(`/api/tasks/${taskId}/process`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? "Processing failed.");
    }
    const result = (await response.json()) as { continueProcessing: boolean };
    logger.info("processing tick", { taskId, continues: result.continueProcessing });
    if (!result.continueProcessing) return;
  }
  throw new Error("Processing did not finish after many attempts.");
}
