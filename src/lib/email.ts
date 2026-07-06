/**
 * Outgoing email over SMTP (Nodemailer). Configured for a Gmail account with an
 * app password by default, but any SMTP host works via the SMTP_* env vars.
 * With no credentials the send is skipped and logged, so local development and
 * preview builds never fail on missing email config.
 *
 * Recipient addresses are kept out of the logs; only a short kind label goes in.
 */

import nodemailer, { type Transporter } from "nodemailer";

import { log } from "@/lib/logger";

const logger = log("email");

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

function smtpConfig(): SmtpConfig | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || "465"),
    user,
    pass,
  };
}

export function isEmailConfigured(): boolean {
  return smtpConfig() !== null;
}

let transporter: Transporter | null = null;

function getTransporter(config: SmtpConfig): Transporter {
  transporter ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: config.user, pass: config.pass },
  });
  return transporter;
}

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Short label for logs, e.g. "sign-in". Never the recipient address. */
  kind: string;
}

export async function sendEmail(input: EmailInput): Promise<void> {
  const config = smtpConfig();
  if (!config) {
    logger.warn("email skipped (SMTP not configured)", { kind: input.kind });
    return;
  }
  // Gmail requires the From address to be the authenticated account (a display
  // name is fine); EMAIL_FROM lets a custom SMTP host use its own address.
  const from = process.env.EMAIL_FROM || `My Tasks <${config.user}>`;
  try {
    const info = await getTransporter(config).sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    logger.info("email sent", { kind: input.kind, id: info.messageId });
  } catch (err) {
    logger.error("email failed", {
      kind: input.kind,
      message: (err as Error).message,
    });
  }
}
