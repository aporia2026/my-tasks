import { NextRequest, NextResponse } from "next/server";

import { issueSignInLink } from "@/lib/auth-link";
import { inviteUser, listUsers } from "@/lib/db/repo/users";
import { inviteEmail } from "@/lib/emails";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { inviteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const logger = log("api users");

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const user = await inviteUser(
    body.data.email,
    body.data.name ?? null,
    session.sub,
  );
  if (!user) {
    return NextResponse.json(
      { error: "That email already has access." },
      { status: 409 },
    );
  }

  await issueSignInLink({
    userId: user.id,
    email: user.email,
    origin: request.nextUrl.origin,
    kind: "invite",
    template: inviteEmail,
  });
  logger.info("user invited", { userId: user.id });
  return NextResponse.json({ user }, { status: 201 });
}
