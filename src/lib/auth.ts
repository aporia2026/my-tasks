/**
 * Session primitives: an HMAC-signed cookie carrying the signed-in user's id
 * and role. The token is "<base64url payload>.<base64url hmac>" where the
 * payload is JSON of { sub, role, exp }. Web Crypto is used throughout so the
 * same code runs in the proxy and in route handlers.
 *
 * Sign-in itself (email + password, or an emailed magic link) lives in the
 * auth routes; this module only mints and verifies the resulting session.
 */

import { log } from "@/lib/logger";
import type { UserRole } from "@/lib/types";

export const SESSION_COOKIE = "mt_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/** Decoded session payload carried inside the signed cookie. */
export interface Session {
  sub: string; // user id
  role: UserRole;
  exp: number; // epoch ms
}

const logger = log("auth session");
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

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = base64.length % 4;
  const padded = remainder ? base64 + "=".repeat(4 - remainder) : base64;
  const binary =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return toBase64Url(new Uint8Array(signature));
}

/** Constant-time string comparison (compares SHA-256 digests). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

export async function createSessionToken(
  secret: string,
  session: { sub: string; role: UserRole },
  now: number = Date.now(),
): Promise<string> {
  const payload: Session = {
    sub: session.sub,
    role: session.role,
    exp: now + SESSION_TTL_MS,
  };
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmac(secret, encoded);
  return `${encoded}.${signature}`;
}

export async function verifySessionToken(
  secret: string,
  token: string | undefined,
  now: number = Date.now(),
): Promise<Session | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  // Verify the signature before trusting anything inside the payload.
  const expected = await hmac(secret, encoded);
  if (!(await safeEqual(signature, expected))) return null;

  let session: Session;
  try {
    session = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
  } catch {
    return null;
  }
  if (
    typeof session?.sub !== "string" ||
    (session.role !== "admin" && session.role !== "requester") ||
    typeof session.exp !== "number"
  ) {
    return null;
  }
  if (session.exp <= now) {
    logger.info("session expired", { expiredAt: session.exp });
    return null;
  }
  return session;
}

/**
 * In-memory login throttle. Per serverless instance, which is enough to slow
 * an online guesser on a single-user app; deliberate choice over external
 * rate-limit infrastructure.
 */
const WINDOW_MS = 1000 * 60 * 10;
const MAX_ATTEMPTS = 10;
let attempts: number[] = [];

export function registerLoginAttempt(now: number = Date.now()): boolean {
  attempts = attempts.filter((t) => now - t < WINDOW_MS);
  if (attempts.length >= MAX_ATTEMPTS) {
    logger.warn("login throttled", { attemptsInWindow: attempts.length });
    return false;
  }
  attempts.push(now);
  return true;
}

export function resetLoginAttempts(): void {
  attempts = [];
}
