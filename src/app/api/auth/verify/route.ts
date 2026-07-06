import { NextRequest, NextResponse } from "next/server";

import { createSessionToken } from "@/lib/auth";
import { activateUser, findUserById } from "@/lib/db/repo/users";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { consumeMagicToken } from "@/lib/magic-link";
import { setSessionCookie } from "@/lib/session";

const logger = log("auth verify");

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/login", request.nextUrl.origin);

  const token = request.nextUrl.searchParams.get("token");
  const userId = token ? await consumeMagicToken(token) : null;
  const user = userId ? await findUserById(userId) : null;
  if (!user) {
    logger.info("verify rejected", { hadToken: Boolean(token) });
    loginUrl.searchParams.set("error", "link");
    return NextResponse.redirect(loginUrl);
  }

  // First sign-in from an invite promotes the account to active.
  if (user.status === "invited") await activateUser(user.id);

  const sessionToken = await createSessionToken(env("AUTH_SECRET"), {
    sub: user.id,
    role: user.role,
  });
  logger.info("signed in via link", { userId: user.id });
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  setSessionCookie(response, sessionToken);
  return response;
}
