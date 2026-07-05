/**
 * User settings: typed defaults, parsing, and DB access.
 * Stored as one JSON value per key in the settings table.
 */

import { z } from "zod";

export const settingsSchema = z.object({
  summaryModel: z.enum(["gpt-5.4-mini", "gpt-5.4-nano"]).default("gpt-5.4-mini"),
  transcriptionModel: z
    .enum(["gpt-4o-mini-transcribe", "gpt-4o-transcribe"])
    .default("gpt-4o-mini-transcribe"),
  tldrLength: z.enum(["short", "detailed"]).default("short"),
  mediaRetention: z
    .enum(["after_confirm", "days_30", "forever"])
    .default("after_confirm"),
  autoProcessOnUpload: z.boolean().default(true),
  confirmBeforeRegenerate: z.boolean().default(true),
  theme: z.enum(["system", "light", "dark"]).default("system"),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/** Merges stored rows over defaults; unknown keys and bad values are dropped. */
export function parseSettings(rows: Array<{ key: string; value: string }>): Settings {
  const candidate: Record<string, unknown> = {};
  for (const row of rows) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      candidate[row.key] = JSON.parse(row.value);
    } catch {
      // ignore unparseable values, the default wins
    }
  }
  const result = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...candidate });
  return result.success ? result.data : DEFAULT_SETTINGS;
}
