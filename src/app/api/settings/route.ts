import { NextRequest, NextResponse } from "next/server";

import { log } from "@/lib/logger";
import { getSettings, saveSettings } from "@/lib/settings-store";
import { settingsUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const logger = log("api settings");

export async function GET() {
  return NextResponse.json({ settings: await getSettings() });
}

export async function PUT(request: NextRequest) {
  const body = settingsUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }
  try {
    const settings = await saveSettings(body.data);
    return NextResponse.json({ settings });
  } catch (error) {
    logger.warn("settings rejected", { message: (error as Error).message });
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
