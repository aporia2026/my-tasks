/**
 * Central access point for environment variables.
 * Server-only. Fails loudly at first use instead of deep inside a request.
 */

const REQUIRED = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "AUTH_SECRET",
  // The email that self-provisions as the admin/owner on first sign-in.
  "ADMIN_EMAIL",
] as const;

type RequiredKey = (typeof REQUIRED)[number];

export function env(key: RequiredKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/** Verifies every required variable at once; useful at startup. */
export function assertEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
