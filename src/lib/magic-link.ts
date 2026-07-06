/**
 * Passwordless sign-in tokens. A random token is emailed to the user; only its
 * SHA-256 hash is stored, and each token is single-use and short-lived. This
 * doubles as the first-time-in flow and the forgot-password path.
 */

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { authTokens } from "@/lib/db/schema";
import { log } from "@/lib/logger";

const logger = log("auth link");
const TOKEN_TTL_MS = 1000 * 60 * 15; // 15 minutes
const TOKEN_BYTES = 32;
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createMagicToken(
  userId: string,
  now: number = Date.now(),
): Promise<string> {
  const raw = toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
  const tokenHash = await hashToken(raw);
  await db.insert(authTokens).values({
    userId,
    tokenHash,
    expiresAt: new Date(now + TOKEN_TTL_MS),
  });
  logger.info("magic token issued", { userId });
  return raw;
}

/** Verifies and consumes a token. Returns the user id, or null if unusable. */
export async function consumeMagicToken(
  raw: string,
  now: number = Date.now(),
): Promise<string | null> {
  const tokenHash = await hashToken(raw);
  const [row] = await db
    .select()
    .from(authTokens)
    .where(eq(authTokens.tokenHash, tokenHash))
    .limit(1);
  if (!row) return null;
  if (row.consumedAt || row.expiresAt.getTime() <= now) {
    logger.info("magic token rejected", {
      consumed: Boolean(row.consumedAt),
      expired: row.expiresAt.getTime() <= now,
    });
    return null;
  }
  // Single-use: only the update that flips a still-null consumedAt wins, so a
  // token replayed in a race is consumed exactly once.
  const consumed = await db
    .update(authTokens)
    .set({ consumedAt: new Date(now) })
    .where(and(eq(authTokens.id, row.id), isNull(authTokens.consumedAt)))
    .returning({ id: authTokens.id });
  if (consumed.length === 0) return null;
  return row.userId;
}
