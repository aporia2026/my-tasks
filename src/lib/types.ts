/**
 * Shared DTO types for API payloads consumed by client components.
 * Mirrors the Drizzle schema without importing server-only modules.
 */

export type TaskStatus = "inbox" | "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type AiStatus = "idle" | "processing" | "ready" | "confirmed" | "failed";
export type AttachmentKind = "audio" | "video" | "image" | "document";
export type AttachmentStatus =
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "failed"
  | "cleaned";
export type SegmentStatus = "pending" | "transcribing" | "done" | "failed";

export interface SegmentDto {
  id: string;
  idx: number;
  startSeconds: number;
  endSeconds: number;
  status: SegmentStatus;
  error: string | null;
  attempts: number;
}

export interface AttachmentDto {
  id: string;
  kind: AttachmentKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  blobUrl: string | null;
  status: AttachmentStatus;
  error: string | null;
  transcript: string | null;
  createdAt: string;
  segments?: SegmentDto[];
}

export interface TaskDto {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  description: string | null;
  tldr: string | null;
  aiStatus: AiStatus;
  aiError: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: AttachmentDto[];
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
