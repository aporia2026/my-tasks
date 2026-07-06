import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The app's secrets live in .env.local (Next.js convention); fall back to .env.
// Loaded here so drizzle-kit sees DATABASE_URL the same way the app does.
config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
