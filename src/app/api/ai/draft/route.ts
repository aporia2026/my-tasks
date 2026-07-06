import { NextRequest, NextResponse } from "next/server";

import { generateSummary } from "@/lib/ai";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings-store";
import { draftSchema } from "@/lib/validation";

const logger = log("api ai draft");

/**
 * Stateless draft of a description + TLDR from a title and typed details, used
 * by the manual "New task" form before a task (or any files) exists. Admin only,
 * so requesters cannot spend the OpenAI budget through it.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = draftSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const details = body.data.details?.trim();
  if (!details) {
    return NextResponse.json(
      { error: "Add some details for the AI to work from." },
      { status: 400 },
    );
  }

  try {
    const settings = await getSettings();
    const summary = await generateSummary(
      {
        title: body.data.title,
        notes: details,
        transcripts: [],
        imageUrls: [],
        documents: [],
      },
      settings,
    );
    logger.info("draft generated", { titleChars: body.data.title.length });
    return NextResponse.json(summary);
  } catch (error) {
    logger.error("draft failed", { message: (error as Error).message });
    return NextResponse.json(
      { error: "Could not generate a draft. Try again." },
      { status: 502 },
    );
  }
}
