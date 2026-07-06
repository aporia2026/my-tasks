import { NextRequest, NextResponse } from "next/server";

import { createSessionToken, registerLoginAttempt } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db/repo/users";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

const logger = log("auth login");

// Valid-shaped hash of nothing real. Verifying against it when no user (or no
// password) is found keeps response timing the same whether the email exists,
// so the endpoint does not leak which addresses have accounts.
const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

export async function POST(request: NextRequest) {
  if (!registerLoginAttempt()) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const body = loginSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Enter your email and password." },
      { status: 400 },
    );
  }

  const user = await findUserByEmail(body.data.email);
  const matches = await verifyPassword(
    body.data.password,
    user?.passwordHash ?? DUMMY_HASH,
  );
  logger.info("password login attempt", { ok: Boolean(user?.passwordHash) && matches });
  if (!user || !user.passwordHash || !matches) {
    return NextResponse.json(
      { error: "Wrong email or password." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(env("AUTH_SECRET"), {
    sub: user.id,
    role: user.role,
  });
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, token);
  return response;
}
