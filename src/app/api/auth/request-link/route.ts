import { NextRequest, NextResponse } from "next/server";

import { registerLoginAttempt } from "@/lib/auth";
import { issueSignInLink } from "@/lib/auth-link";
import { ensureAdminUser, findUserByEmail } from "@/lib/db/repo/users";
import { signInEmail } from "@/lib/emails";
import { log } from "@/lib/logger";
import { requestLinkSchema } from "@/lib/validation";

const logger = log("auth link");

export async function POST(request: NextRequest) {
  if (!registerLoginAttempt()) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const body = requestLinkSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return NextResponse.json({ error: "Enter your email." }, { status: 400 });
  }

  // Make sure the owner account exists before we look anyone up.
  await ensureAdminUser();
  const user = await findUserByEmail(body.data.email);

  // Only send to a known account, but always answer the same way so the form
  // never reveals which emails have access.
  if (user) {
    await issueSignInLink({
      userId: user.id,
      email: user.email,
      origin: request.nextUrl.origin,
      kind: "sign-in",
      template: signInEmail,
    });
  } else {
    logger.info("link requested for unknown email");
  }

  return NextResponse.json({ ok: true });
}
