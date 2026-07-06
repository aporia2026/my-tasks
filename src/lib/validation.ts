/**
 * Zod schemas validating every API boundary. Nothing from the client is
 * trusted; anything that fails parsing gets a 400 before touching the DB.
 */

import { z } from "zod";

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // per uploaded blob (audio chunk, image, doc)

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  notes: z.string().trim().max(10_000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  status: z.enum(["inbox", "todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.iso.datetime({ offset: true }).nullable().optional(),
  description: z.string().max(50_000).optional(),
  tldr: z.string().max(10_000).optional(),
});

const uploadedBlobSchema = z.object({
  url: z.url(),
  pathname: z.string().min(1),
});

export const attachmentRegisterSchema = z.object({
  taskId: z.uuid(),
  kind: z.enum(["audio", "video", "image", "document"]),
  originalName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  durationSeconds: z.number().positive().max(60 * 60 * 12).optional(),
  /** Whole-file blob for images/docs/small audio. */
  blob: uploadedBlobSchema.optional(),
  /** Chunked audio segments for recordings. */
  segments: z
    .array(
      uploadedBlobSchema.extend({
        idx: z.number().int().min(0),
        startSeconds: z.number().min(0),
        // 0 means "duration unknown" (direct-upload fallback path)
        endSeconds: z.number().min(0),
      }),
    )
    .max(50)
    .optional(),
});

export const MIN_PASSWORD_LENGTH = 8;

export const loginSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(200),
});

export const requestLinkSchema = z.object({
  email: z.email().max(320),
});

export const setPasswordSchema = z.object({
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

export const inviteSchema = z.object({
  email: z.email().max(320),
  name: z.string().trim().max(120).optional(),
});

export const declineSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment first").max(5000),
});

export const settingsUpdateSchema = z.record(z.string(), z.unknown());
