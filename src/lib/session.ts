/**
 * Server-side access to the current session. Reads and verifies the signed
 * cookie and fails closed (returns null) on anything unexpected. Route handlers
 * and server components read the current user through here.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  verifySessionToken,
  type Session,
} from "@/lib/auth";
import { env, isProduction } from "@/lib/env";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(env("AUTH_SECRET"), token);
}

export function isAdmin(session: Session | null): boolean {
  return session?.role === "admin";
}

/** Writes the signed session cookie onto a response (login and link verify). */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}
