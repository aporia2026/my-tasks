/**
 * Single-user auth: one passcode, one HMAC-signed session cookie.
 *
 * The session token is "<expiresEpochMs>.<base64url hmac>". Web Crypto is
 * used throughout so the same code runs in the proxy (edge-compatible) and
 * in route handlers.
 */

import { log } from "@/lib/logger";

export const SESSION_COOKIE = "mt_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

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
  now: number = Date.now(),
): Promise<string> {
  const expires = String(now + SESSION_TTL_MS);
  const signature = await hmac(secret, expires);
  return `${expires}.${signature}`;
}

export async function verifySessionToken(
  secret: string,
  token: string | undefined,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expires = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d+$/.test(expires)) return false;
  if (Number(expires) <= now) {
    logger.info("session expired", { expiredAt: Number(expires) });
    return false;
  }
  const expected = await hmac(secret, expires);
  return safeEqual(signature, expected);
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
