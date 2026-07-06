CREATE TYPE "public"."review_state" AS ENUM('none', 'pending', 'accepted', 'declined');--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "review_state" "review_state" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "decline_reason" text;