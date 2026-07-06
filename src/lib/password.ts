/**
 * Password hashing with Node's built-in scrypt. Memory-hard, no native
 * dependency to build, and it runs on the Vercel Node runtime. The stored
 * format is "scrypt$<saltHex>$<hashHex>" so the salt travels with the hash.
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  // Length guard keeps timingSafeEqual from throwing on a malformed record.
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}
