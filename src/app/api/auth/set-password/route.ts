import { NextRequest, NextResponse } from "next/server";

import { setUserPassword } from "@/lib/db/repo/users";
import { log } from "@/lib/logger";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/session";
import { MIN_PASSWORD_LENGTH, setPasswordSchema } from "@/lib/validation";

const logger = log("auth password");

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = setPasswordSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return NextResponse.json(
      { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const hash = await hashPassword(body.data.password);
  await setUserPassword(session.sub, hash);
  logger.info("password updated", { userId: session.sub });
  return NextResponse.json({ ok: true });
}
