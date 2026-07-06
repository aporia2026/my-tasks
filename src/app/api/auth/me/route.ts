import { NextResponse } from "next/server";

import { findUserById } from "@/lib/db/repo/users";
import { getSession } from "@/lib/session";

/** The signed-in user's identity and role, for the client to branch its UI. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await findUserById(session.sub);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
