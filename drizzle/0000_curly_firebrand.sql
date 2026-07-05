CREATE TYPE "public"."ai_status" AS ENUM('idle', 'processing', 'ready', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."attachment_kind" AS ENUM('audio', 'video', 'image', 'document');--> statement-breakpoint
CREATE TYPE "public"."attachment_status" AS ENUM('uploaded', 'transcribing', 'transcribed', 'failed', 'cleaned');--> statement-breakpoint
CREATE TYPE "public"."segment_status" AS ENUM('pending', 'transcribing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('inbox', 'todo', 'in_progress', 'done');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"duration_seconds" real,
	"blob_url" text,
	"blob_pathname" text,
	"status" "attachment_status" DEFAULT 'uploaded' NOT NULL,
	"error" text,
	"transcript" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleaned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attachment_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"start_seconds" real NOT NULL,
	"end_seconds" real NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"status" "segment_status" DEFAULT 'pending' NOT NULL,
	"transcript" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"status" "task_status" DEFAULT 'inbox' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp with time zone,
	"description" text,
	"tldr" text,
	"ai_status" "ai_status" DEFAULT 'idle' NOT NULL,
	"ai_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;