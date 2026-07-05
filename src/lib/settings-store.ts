/**
 * DB-backed settings access. Reads merge stored rows over defaults; writes
 * upsert one JSON value per key.
 */

import { db } from "@/lib/db";
import { settings as settingsTable } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import {
  parseSettings,
  settingsSchema,
  type Settings,
} from "@/lib/settings";

const logger = log("settings store");

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settingsTable);
  return parseSettings(rows);
}

export async function saveSettings(input: unknown): Promise<Settings> {
  const merged = settingsSchema.safeParse({
    ...(await getSettings()),
    ...(typeof input === "object" && input !== null ? input : {}),
  });
  if (!merged.success) {
    throw new Error(merged.error.issues[0]?.message ?? "Invalid settings");
  }

  for (const [key, value] of Object.entries(merged.data)) {
    await db
      .insert(settingsTable)
      .values({ key, value: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value: JSON.stringify(value) },
      });
  }
  logger.info("settings saved", { keys: Object.keys(merged.data) });
  return merged.data;
}
