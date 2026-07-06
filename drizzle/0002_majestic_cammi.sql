-- Add task ownership. Done in three safe steps so the migration works whether
-- the tasks table is empty (fresh deploy) or already holds rows from the
-- earlier single-user version:
--   1. add the column nullable,
--   2. backfill any existing rows to the admin account,
--   3. enforce NOT NULL and the foreign key.
ALTER TABLE "tasks" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "tasks"
  SET "owner_id" = (
    SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "created_at" LIMIT 1
  )
  WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
