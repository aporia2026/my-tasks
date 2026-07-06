/**
 * Zod schemas validating every API boundary. Nothing from the client is
 * trusted; anything that fails parsing gets a 400 before touching the DB.
 */

import { z } from "zod";

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // per uploaded blob (audio chunk, image, doc)

/** Cap on sub-tasks accepted in one payload (create list or reorder). */
export const MAX_TODOS = 30;

const todoTitle = z.string().trim().min(1, "Sub-task can't be empty").max(300);

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  notes: z.string().trim().max(10_000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["inbox", "todo", "in_progress", "done"]).optional(),
  description: z.string().max(50_000).optional(),
  tldr: z.string().max(10_000).optional(),
  dueDate: z.iso.datetime({ offset: true }).nullable().optional(),
  todos: z.array(todoTitle).max(MAX_TODOS).optional(),
});

export const draftSchema = z.object({
  title: z.string().trim().min(1, "A title is required").max(300),
  details: z.string().trim().max(10_000).optional(),
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

export const todoCreateSchema = z.object({
  title: todoTitle,
});

export const todoUpdateSchema = z
  .object({
    title: todoTitle.optional(),
    status: z.enum(["pending", "doing", "done"]).optional(),
  })
  .refine((v) => v.title !== undefined || v.status !== undefined, {
    message: "Nothing to update",
  });

export const todoReorderSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(MAX_TODOS),
});

export const settingsUpdateSchema = z.record(z.string(), z.unknown());
