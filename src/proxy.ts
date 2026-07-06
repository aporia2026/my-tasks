/**
 * Route protection. Every page and API route requires a valid session,
 * except the login page, the login API, and static assets. Fails closed:
 * no cookie means no access.
 */

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

const logger = log("auth proxy");

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/request-link",
  "/api/auth/verify",
]);

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (PUBLIC_PATHS.has(path)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(env("AUTH_SECRET"), token);
  if (session) return NextResponse.next();

  logger.info("unauthenticated request", { path, hadCookie: Boolean(token) });
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.nextUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
