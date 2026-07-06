/**
 * The one rule that defines per-user isolation: admins may act on any row,
 * everyone else only on rows they own. Kept pure and separate so it is trivial
 * to test and so every repository function shares the exact same check.
 */

import type { Session } from "@/lib/auth";

/** The signed-in caller, narrowed to what ownership checks need. */
export type Caller = Pick<Session, "sub" | "role">;

export function ownsOrAdmin(caller: Caller, ownerId: string): boolean {
  return caller.role === "admin" || caller.sub === ownerId;
}
