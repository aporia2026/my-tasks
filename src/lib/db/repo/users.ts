/**
 * User lookups and the admin bootstrap. The address in ADMIN_EMAIL becomes the
 * single admin the first time it signs in; everyone else is created by an
 * invite from inside the app. All email comparisons run against the normalized
 * (trimmed, lower-cased) form so a stored address matches regardless of casing.
 */

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { tasks, users, type User } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

const logger = log("db users");

/** User fields safe to send to the client. Never selects password_hash. */
export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: User["role"];
  status: User["status"];
  createdAt: Date;
}

const safeUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  return row ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/**
 * Guarantees the owner account exists and is an active admin. Idempotent, so it
 * is safe to call on every sign-in attempt.
 */
export async function ensureAdminUser(): Promise<void> {
  const email = normalizeEmail(env("ADMIN_EMAIL"));
  await db
    .insert(users)
    .values({ email, role: "admin", status: "active" })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: "admin", status: "active" },
    });
}

/** Flips an invited user to active on their first successful sign-in. */
export async function activateUser(id: string): Promise<void> {
  await db.update(users).set({ status: "active" }).where(eq(users.id, id));
  logger.info("user activated", { userId: id });
}

export async function setUserPassword(
  id: string,
  passwordHash: string,
): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  logger.info("password set", { userId: id });
}

export async function listUsers(): Promise<SafeUser[]> {
  return db.select(safeUserColumns).from(users).orderBy(asc(users.createdAt));
}

/**
 * Invites a new requester by email. Returns null if the address already has an
 * account (invited or active), so the caller can report a clear conflict.
 */
export async function inviteUser(
  email: string,
  name: string | null,
  invitedBy: string,
): Promise<SafeUser | null> {
  const normalized = normalizeEmail(email);
  if (await findUserByEmail(normalized)) return null;
  const [created] = await db
    .insert(users)
    .values({
      email: normalized,
      name,
      role: "requester",
      status: "invited",
      invitedBy,
    })
    .returning(safeUserColumns);
  logger.info("user invited", { userId: created.id });
  return created;
}

/**
 * Removes a requester. Their tasks are reassigned to the admin first, so
 * nothing is lost. The admin account itself can never be removed.
 */
export async function removeUser(id: string): Promise<boolean> {
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target || target.role === "admin") return false;

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizeEmail(env("ADMIN_EMAIL"))))
    .limit(1);
  if (!admin) return false;

  await db.update(tasks).set({ ownerId: admin.id }).where(eq(tasks.ownerId, id));
  await db.delete(users).where(eq(users.id, id));
  logger.info("user removed", { userId: id, reassignedTo: admin.id });
  return true;
}
