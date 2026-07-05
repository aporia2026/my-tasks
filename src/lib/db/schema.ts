import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const taskStatusEnum = pgEnum("task_status", [
  "inbox",
  "todo",
  "in_progress",
  "done",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
]);

export const aiStatusEnum = pgEnum("ai_status", [
  "idle",
  "processing",
  "ready",
  "confirmed",
  "failed",
]);

export const attachmentKindEnum = pgEnum("attachment_kind", [
  "audio",
  "video",
  "image",
  "document",
]);

export const attachmentStatusEnum = pgEnum("attachment_status", [
  "uploaded",
  "transcribing",
  "transcribed",
  "failed",
  "cleaned",
]);

export const segmentStatusEnum = pgEnum("segment_status", [
  "pending",
  "transcribing",
  "done",
  "failed",
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  notes: text("notes"),
  status: taskStatusEnum("status").notNull().default("inbox"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  description: text("description"),
  tldr: text("tldr"),
  aiStatus: aiStatusEnum("ai_status").notNull().default("idle"),
  aiError: text("ai_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  kind: attachmentKindEnum("kind").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  durationSeconds: real("duration_seconds"),
  blobUrl: text("blob_url"),
  blobPathname: text("blob_pathname"),
  status: attachmentStatusEnum("status").notNull().default("uploaded"),
  error: text("error"),
  transcript: text("transcript"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  cleanedAt: timestamp("cleaned_at", { withTimezone: true }),
});

export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  attachmentId: uuid("attachment_id")
    .notNull()
    .references(() => attachments.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  startSeconds: real("start_seconds").notNull(),
  endSeconds: real("end_seconds").notNull(),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  status: segmentStatusEnum("status").notNull().default("pending"),
  transcript: text("transcript"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const tasksRelations = relations(tasks, ({ many }) => ({
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one, many }) => ({
  task: one(tasks, { fields: [attachments.taskId], references: [tasks.id] }),
  segments: many(segments),
}));

export const segmentsRelations = relations(segments, ({ one }) => ({
  attachment: one(attachments, {
    fields: [segments.attachmentId],
    references: [attachments.id],
  }),
}));

export type Task = typeof tasks.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Segment = typeof segments.$inferSelect;
