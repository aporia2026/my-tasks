import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { log } from "@/lib/logger";

const logger = log("auth logout");

export async function POST() {
  logger.info("logout");
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
