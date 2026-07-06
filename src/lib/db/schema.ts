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

export const todoStatusEnum = pgEnum("todo_status", [
  "pending",
  "doing",
  "done",
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

export const userRoleEnum = pgEnum("user_role", ["admin", "requester"]);

export const userStatusEnum = pgEnum("user_status", ["invited", "active"]);

export const reviewStateEnum = pgEnum("review_state", [
  "none",
  "pending",
  "accepted",
  "declined",
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  // The user who owns this task. Requesters see only their own; the admin sees
  // all. No cascade delete: removing a user reassigns their tasks to the admin
  // (Phase 3), so nothing is silently lost.
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  notes: text("notes"),
  status: taskStatusEnum("status").notNull().default("inbox"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  // Review gate: admin's own tasks are "none" and skip the queue; a requester's
  // submission starts "pending" until the admin accepts or declines it.
  reviewState: reviewStateEnum("review_state").notNull().default("none"),
  declineReason: text("decline_reason"),
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

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: userRoleEnum("role").notNull().default("requester"),
  status: userStatusEnum("status").notNull().default("invited"),
  // Set only when the user chooses email + password; null means link-only.
  passwordHash: text("password_hash"),
  invitedBy: uuid("invited_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // SHA-256 of the emailed token; the raw token never touches the database.
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  // Removing a user takes their comments with them (their tasks reassign to the
  // admin, but authored comments do not, to avoid misattributing them).
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const todos = pgTable("todos", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // pending = not started, doing = the one currently being worked on (at most
  // one per task, enforced in the repo), done = completed.
  status: todoStatusEnum("status").notNull().default("pending"),
  // Stable ordering within a task; server-assigned, contiguous from 0.
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  owner: one(users, { fields: [tasks.ownerId], references: [users.id] }),
  attachments: many(attachments),
  comments: many(comments),
  todos: many(todos),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export const todosRelations = relations(todos, ({ one }) => ({
  task: one(tasks, { fields: [todos.taskId], references: [tasks.id] }),
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
export type User = typeof users.$inferSelect;
export type AuthToken = typeof authTokens.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Todo = typeof todos.$inferSelect;
