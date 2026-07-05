import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  registerLoginAttempt,
  safeEqual,
} from "@/lib/auth";
import { env, isProduction } from "@/lib/env";
import { log } from "@/lib/logger";
import { loginSchema } from "@/lib/validation";

const logger = log("auth login");

export async function POST(request: NextRequest) {
  if (!registerLoginAttempt()) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const body = loginSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Passcode is required." }, { status: 400 });
  }

  const correct = await safeEqual(body.data.passcode, env("DASHBOARD_PASSCODE"));
  logger.info("login attempt", { correct });
  if (!correct) {
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  const token = await createSessionToken(env("AUTH_SECRET"));
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  return response;
}
