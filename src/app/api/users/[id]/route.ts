import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { removeUser } from "@/lib/db/repo/users";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";

const logger = log("api users");

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const removed = await removeUser(id);
  if (!removed) {
    return NextResponse.json(
      { error: "That account cannot be removed." },
      { status: 400 },
    );
  }
  logger.info("user removed", { userId: id });
  return NextResponse.json({ ok: true });
}
