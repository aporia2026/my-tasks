import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

import { log } from "@/lib/logger";
import { MAX_UPLOAD_BYTES } from "@/lib/validation";

const logger = log("api upload");

const ALLOWED_CONTENT_TYPES = [
  "audio/*",
  "image/*",
  "application/pdf",
  "text/plain",
  "text/markdown",
];

/**
 * Issues short-lived client upload tokens for Vercel Blob. Session is
 * enforced by the proxy before this runs; uploads go browser-to-Blob
 * directly, bypassing the serverless body limit.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        logger.info("issuing upload token", { pathname });
        return {
          addRandomSuffix: true,
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Registration happens via POST /api/attachments from the client,
        // which also works in local dev where this callback cannot fire.
        logger.info("upload completed", { pathname: blob.pathname });
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("upload token failed", { message: (error as Error).message });
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
