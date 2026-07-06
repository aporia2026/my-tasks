/**
 * Mints a single-use magic-link token and delivers it, shared by the sign-in
 * and invite flows. In dev with no SMTP configured, the link is printed to the
 * server console instead of emailed so nobody is locked out. Never prints in
 * production.
 */

import { isEmailConfigured, sendEmail } from "@/lib/email";
import { isProduction } from "@/lib/env";
import { log } from "@/lib/logger";
import { createMagicToken } from "@/lib/magic-link";

const logger = log("auth link");

interface EmailBody {
  subject: string;
  html: string;
  text: string;
}

export async function issueSignInLink(opts: {
  userId: string;
  email: string;
  origin: string;
  kind: string;
  template: (url: string) => EmailBody;
}): Promise<void> {
  const token = await createMagicToken(opts.userId);
  const url = new URL(
    `/api/auth/verify?token=${encodeURIComponent(token)}`,
    opts.origin,
  ).toString();
  const body = opts.template(url);
  await sendEmail({
    to: opts.email,
    subject: body.subject,
    html: body.html,
    text: body.text,
    kind: opts.kind,
  });
  if (!isEmailConfigured() && !isProduction()) {
    logger.info("dev link (email not configured)", { kind: opts.kind, url });
  }
}
